import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PedidosModule } from './pedidos/pedidos.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

/**
 * Patrón: API Gateway — punto único de entrada que delega a los microservicios.
 * El cliente TCP hacia svc-pedidos se registra una sola vez, en PedidosModule
 * (que es quien lo usa).
 *
 * Avance 3: AuthModule agrega el endpoint POST /api/auth/login y la
 * JwtStrategy reutilizable por los Guards de autorización.
 *
 * Los dos guards se registran con APP_GUARD, es decir, de forma GLOBAL:
 * la política del Gateway es "denegar por defecto" y abrir con @Public().
 *
 * EL ORDEN IMPORTA: Nest ejecuta los guards globales en el orden declarado.
 *   1. JwtAuthGuard → valida el JWT y coloca req.user  (401 si falla)
 *   2. RolesGuard   → compara req.user.rol con @Roles() (403 si falla)
 * Invertirlos dejaría a RolesGuard sin req.user y siempre respondería 403.
 */
@Module({
  imports: [PedidosModule, HealthModule, AuthModule],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
