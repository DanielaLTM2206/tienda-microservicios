import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @Public() — Avance 3, Criterio C2.
 *
 * Marca una ruta como accesible SIN token JWT.
 *
 * El JwtAuthGuard está registrado de forma GLOBAL (APP_GUARD en AppModule),
 * por lo que la regla por defecto es "todo protegido". Este decorador es la
 * excepción explícita: se aplica solo a /api/auth/login y /api/health.
 *
 * Elegimos "denegar por defecto" en vez de proteger ruta por ruta porque
 * olvidar un @UseGuards deja un endpoint abierto sin que nadie lo note,
 * mientras que olvidar un @Public() rompe de inmediato y es evidente.
 *
 * Patrón: Decorator (metadatos leídos por el Guard mediante Reflector).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
