import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import Redis from 'ioredis';

/**
 * TokenRevocationService — Examen final, Actividad A.
 *
 * Lista de sesiones JWT revocadas (logout real del lado del servidor).
 *
 * POR QUE REDIS Y NO MEMORIA:
 *   El Gateway es el unico punto de entrada, pero nada impide escalarlo a
 *   varias replicas. Con un Set en memoria, el logout atendido por la replica
 *   A no lo verian las replicas B y C, y el token seguiria funcionando en
 *   ellas: la revocacion seria una loteria segun a que replica caiga la
 *   peticion. Redis ya esta levantado en los tres docker-compose del grupo
 *   (lo usan svc-pedidos como publisher y svc-notificaciones como subscriber),
 *   asi que reutilizarlo no agrega infraestructura nueva al sistema.
 *
 * POR QUE TTL Y NO GUARDAR PARA SIEMPRE:
 *   Pasada la expiracion del token, la propia JwtStrategy ya lo rechaza por
 *   `exp` (ignoreExpiration: false). Mantener el `jti` despues de ese momento
 *   no aporta seguridad y hace crecer la lista sin limite. Con el TTL alineado
 *   a `exp`, Redis libera la entrada exactamente cuando deja de ser necesaria.
 *
 * Convencion del repo: se sigue el mismo patron de cliente ioredis que
 * PedidosService y NotificacionesService (constructor + logger + cierre en
 * el hook de ciclo de vida).
 */
@Injectable()
export class TokenRevocationService implements OnModuleDestroy {
  private readonly logger = new Logger(TokenRevocationService.name);
  private readonly redis: Redis;

  /** Prefijo de la clave, para no colisionar con los canales de eventos. */
  private readonly PREFIJO = 'jwt:revocado:';

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379'),
      // Sin reintentos infinitos: si Redis no esta, se sabe rapido y el
      // guard aplica su politica de fallo (ver estaRevocado).
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });

    this.redis.on('connect', () =>
      this.logger.log('Conectado a Redis (lista de tokens revocados)'),
    );
    this.redis.on('error', (err) =>
      this.logger.error(`Error de Redis en la lista de revocados: ${err.message}`),
    );
  }

  /**
   * Revoca una sesion registrando su `jti` con TTL igual al tiempo de vida
   * que le quedaba al token.
   *
   * Es IDEMPOTENTE: llamar dos veces con el mismo token simplemente reescribe
   * la clave con el mismo TTL restante. No lanza ni duplica nada, que es el
   * caso borde "logout dos veces" de la actividad.
   *
   * @param jti identificador unico del token (claim `jti`)
   * @param exp expiracion del token en segundos epoch (claim `exp`)
   */
  async revocar(jti: string, exp: number): Promise<{ ttlSegundos: number }> {
    const ahora = Math.floor(Date.now() / 1000);
    // Minimo 1s: Redis rechaza EX <= 0. Si el token ya vencio, la entrada
    // sobra (la strategy ya lo rechaza), pero se guarda un instante para que
    // la respuesta del logout sea uniforme.
    const ttlSegundos = Math.max(exp - ahora, 1);

    try {
      await this.redis.set(`${this.PREFIJO}${jti}`, '1', 'EX', ttlSegundos);
      this.logger.log(`Sesion revocada jti=${jti} (TTL ${ttlSegundos}s)`);
      return { ttlSegundos };
    } catch (err) {
      this.logger.error(`No se pudo revocar jti=${jti}: ${err.message}`);
      // Si no se puede escribir, el logout NO puede reportar exito: el cliente
      // creeria que cerro sesion cuando el token sigue siendo valido.
      throw new ServiceUnavailableException(
        'No se pudo cerrar la sesion: el almacen de revocacion no esta disponible',
      );
    }
  }

  /**
   * Indica si una sesion fue revocada.
   *
   * POLITICA ANTE CAIDA DE REDIS: **falla cerrado** (rechaza la peticion).
   *   Fallar abierto dejaria pasar tokens ya revocados justo cuando el
   *   almacen no puede desmentirlos, que es el escenario que un atacante
   *   con un token robado querria provocar. Se acepta a cambio que Redis
   *   sea un punto unico de fallo para las rutas protegidas del Gateway;
   *   es un coste de disponibilidad asumido conscientemente a favor de la
   *   seguridad. Las rutas @Public (login y health) no pasan por aqui.
   */
  async estaRevocado(jti: string): Promise<boolean> {
    try {
      const existe = await this.redis.exists(`${this.PREFIJO}${jti}`);
      return existe === 1;
    } catch (err) {
      this.logger.error(
        `Redis no disponible al verificar jti=${jti}: ${err.message} — se rechaza la peticion (fail-closed)`,
      );
      throw new ServiceUnavailableException(
        'No se puede verificar el estado de la sesion en este momento',
      );
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit();
    this.logger.log('Desconectado de Redis (lista de tokens revocados)');
  }
}
