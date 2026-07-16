import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PedidosModule } from './pedidos/pedidos.module';
import { HealthModule } from './health/health.module';

/**
 * Patrón: API Gateway — punto único de entrada que delega a los microservicios.
 * Principio DIP: el módulo depende de la abstracción ClientsModule, no de implementaciones concretas.
 */
@Module({
  imports: [
    // Registro del cliente TCP hacia svc-pedidos (camino síncrono)
    ClientsModule.register([
      {
        name: 'PEDIDOS_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.SVC_PEDIDOS_HOST ?? 'localhost',
          port: parseInt(process.env.SVC_PEDIDOS_PORT ?? '3001'),
        },
      },
    ]),
    PedidosModule,
    HealthModule,
  ],
})
export class AppModule {}
