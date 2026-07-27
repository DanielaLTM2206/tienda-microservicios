import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable, lastValueFrom, isObservable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TokenRevocationService } from '../token-revocation.service';

/**
 * JwtAuthGuard — Avance 3, Criterio C2 (AUTENTICACIÓN de la petición).
 *
 * Se registra como APP_GUARD en AppModule, así que corre ANTES de cada handler
 * HTTP del Gateway. Extiende AuthGuard('jwt'), que delega en la JwtStrategy de
 * Passport: verifica la firma con JWT_SECRET y rechaza tokens expirados.
 *
 * Comportamiento:
 *   - Ruta marcada con @Public()  → pasa sin validar nada.
 *   - Token válido                → inyecta req.user y continúa.
 *   - Sin token / inválido / expirado → 401 Unauthorized con motivo concreto.
 *
 * Diferencia con un middleware (pregunta típica del jurado):
 *   Un middleware corre antes del enrutamiento y NO conoce el handler destino,
 *   por lo que no puede leer metadatos como @Public() o @Roles(). Un Guard corre
 *   después de resolver la ruta, recibe el ExecutionContext y puede decidir con
 *   base en esos metadatos. Además, el Guard es la pieza que Nest define para
 *   responder "¿esta petición puede continuar?" devolviendo un booleano.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly revocacion: TokenRevocationService,
  ) {
    super();
  }

  /**
   * Examen final (Actividad A): se añade un SEGUNDO paso de validacion.
   *
   *   1. Passport verifica firma y expiracion (comportamiento previo).
   *   2. NUEVO: se comprueba que el `jti` no este en la lista de revocados.
   *
   * El orden importa: primero la firma, porque no tiene sentido consultar
   * Redis por el `jti` de un token que ni siquiera es autentico — eso
   * permitiria a un anonimo generar trafico contra el almacen.
   *
   * PRINCIPIOS APLICADOS:
   *
   *   OCP (Open/Closed) — el guard se EXTIENDE con un paso nuevo sin
   *   modificar el anterior: la llamada a super.canActivate() (firma y
   *   expiracion) queda intacta, y el paso 2 se encadena despues. Por eso
   *   los casos de prueba del comportamiento previo siguen pasando.
   *
   *   DIP (Dependency Inversion) — este guard no conoce Redis. Depende de
   *   TokenRevocationService, inyectado por el contenedor de Nest. La
   *   decision de donde vive la lista de revocados no le afecta.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // getAllAndOverride: el decorador del handler gana sobre el del controlador
    const esPublica = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (esPublica) {
      return true;
    }

    // Paso 1 — validacion de firma y expiracion (Passport), como antes
    const resultado = super.canActivate(context);
    const autenticado = isObservable(resultado)
      ? await lastValueFrom(resultado as Observable<boolean>)
      : await resultado;

    if (!autenticado) {
      return false;
    }

    // Paso 2 — la sesion no debe estar revocada
    const request = context.switchToHttp().getRequest();
    const jti = request.user?.jti;

    if (!jti) {
      // Token firmado correctamente pero emitido antes de que existiera el
      // claim `jti`: no se puede saber si su sesion fue cerrada, asi que se
      // rechaza en vez de asumir que sigue viva.
      this.logger.warn('401 — token valido pero sin claim jti (token antiguo)');
      throw new UnauthorizedException(
        'No autorizado: el token no incluye identificador de sesion (jti). Vuelve a iniciar sesion.',
      );
    }

    if (await this.revocacion.estaRevocado(jti)) {
      // Mensaje DISTINGUIBLE del de "token invalido o expirado": el token es
      // autentico y esta vigente, lo que ocurre es que su sesion se cerro.
      this.logger.warn(`401 — token revocado jti=${jti}`);
      throw new UnauthorizedException(
        'Sesion cerrada: este token fue revocado mediante logout',
      );
    }

    return true;
  }

  /**
   * Se ejecuta con el resultado de la JwtStrategy.
   * Traduce el motivo real del fallo a un 401 informativo, en vez del
   * "Unauthorized" genérico de Passport, para que la demo muestre por qué
   * fue rechazada la petición.
   */
  handleRequest<TUser = any>(err: any, user: any, info: any): TUser {
    if (err || !user) {
      const request = info?.message ?? '';
      let motivo = 'token ausente o mal formado';

      if (info?.name === 'TokenExpiredError') {
        motivo = 'el token JWT expiró';
      } else if (info?.name === 'JsonWebTokenError') {
        motivo = 'la firma del token JWT no es válida';
      } else if (request) {
        motivo = request;
      }

      this.logger.warn(`401 — acceso denegado: ${motivo}`);
      throw err ?? new UnauthorizedException(`No autorizado: ${motivo}`);
    }

    return user;
  }
}
