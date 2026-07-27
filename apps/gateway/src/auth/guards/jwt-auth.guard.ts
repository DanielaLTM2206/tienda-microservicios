import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

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

  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // getAllAndOverride: el decorador del handler gana sobre el del controlador
    const esPublica = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (esPublica) {
      return true;
    }

    return super.canActivate(context);
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
