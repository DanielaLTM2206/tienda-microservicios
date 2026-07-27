import { Module } from '@nestjs/common';
import { PedidosModule } from './pedidos/pedidos.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';

/**
 * Patrón: API Gateway — punto único de entrada que delega a los microservicios.
 * El cliente TCP hacia svc-pedidos se registra una sola vez, en PedidosModule
 * (que es quien lo usa).
 *
 * Avance 3: AuthModule agrega el endpoint POST /api/auth/login y la
 * JwtStrategy reutilizable por los Guards de autorización.
 */
@Module({
  imports: [PedidosModule, HealthModule, AuthModule],
})
export class AppModule {}
