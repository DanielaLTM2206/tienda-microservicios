import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Rol } from '../decorators/roles.decorator';

/**
 * RolesGuard — Avance 3, Criterio C2 (AUTORIZACIÓN por rol).
 *
 * Segundo APP_GUARD, registrado DESPUÉS de JwtAuthGuard. El orden importa:
 * Nest ejecuta los guards globales en el orden en que se declaran, así que
 * cuando este corre, JwtAuthGuard ya validó el token y colocó req.user.
 *
 * Comportamiento:
 *   - Handler sin @Roles()          → pasa (basta con estar autenticado).
 *   - Rol del usuario en la lista   → pasa.
 *   - Rol insuficiente              → 403 Forbidden indicando el rol requerido.
 *
 * Autenticación vs autorización (pregunta típica del jurado):
 *   401 = no sé quién eres        → lo resuelve JwtAuthGuard
 *   403 = sé quién eres, pero no tienes permiso → lo resuelve este guard
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sin @Roles() la ruta no exige rol concreto: con estar autenticado basta
    if (!rolesRequeridos || rolesRequeridos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const usuario = request.user as { username: string; rol: Rol } | undefined;

    // Defensa en profundidad: si la ruta pide rol pero está marcada @Public(),
    // no hay usuario y no se puede autorizar a nadie.
    if (!usuario) {
      this.logger.warn('403 — ruta con @Roles() sin usuario autenticado');
      throw new ForbiddenException(
        'Acceso denegado: la ruta requiere un rol pero la petición no está autenticada',
      );
    }

    if (!rolesRequeridos.includes(usuario.rol)) {
      this.logger.warn(
        `403 — "${usuario.username}" (rol "${usuario.rol}") intentó acceder a una ruta de [${rolesRequeridos.join(', ')}]`,
      );
      throw new ForbiddenException(
        `Acceso denegado: se requiere rol [${rolesRequeridos.join(', ')}] y tu rol es "${usuario.rol}"`,
      );
    }

    return true;
  }
}
