import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Roles disponibles en el sistema (los emite AuthService dentro del JWT). */
export type Rol = 'admin' | 'cliente';

/**
 * @Roles('admin') — Avance 3, Criterio C2.
 *
 * Declara qué roles pueden ejecutar un handler. Lo lee RolesGuard vía Reflector.
 * Sin este decorador, una ruta autenticada la puede usar cualquier rol.
 *
 * Diferencia clave con @Public():
 *   @Public()        → no exige AUTENTICACIÓN  (¿quién eres?)   → 401 si falta
 *   @Roles('admin')  → exige AUTORIZACIÓN      (¿qué puedes?)   → 403 si no alcanza
 *
 * Patrón: Decorator + Strategy de autorización basada en roles (RBAC).
 */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
