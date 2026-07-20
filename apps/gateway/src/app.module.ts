import { Module } from '@nestjs/common';
import { PedidosModule } from './pedidos/pedidos.module';
import { HealthModule } from './health/health.module';

/**
 * Patrón: API Gateway — punto único de entrada que delega a los microservicios.
 * El cliente TCP hacia svc-pedidos se registra una sola vez, en PedidosModule
 * (que es quien lo usa).
 */
@Module({
  imports: [PedidosModule, HealthModule],
})
export class AppModule {}
