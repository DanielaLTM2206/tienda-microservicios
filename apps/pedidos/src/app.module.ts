import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PedidosModule } from './pedidos/pedidos.module';
import { Pedido } from './pedidos/pedido.entity';

/**
 * AppModule de svc-pedidos — Avance 3 (refactor C1).
 *
 * Los tres clientes de transporte (TCP, gRPC, RMQ) se registran
 * ÚNICAMENTE en PedidosModule, que es el módulo que los inyecta
 * (principio de responsabilidad única y eliminación de código muerto).
 *
 * Principio DIP: depende de abstracciones (TypeOrmModule, PedidosModule),
 * no de clases concretas de transporte.
 */
@Module({
  imports: [
    // Conexión a PostgreSQL vía TypeORM
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432'),
      username: process.env.DB_USER ?? 'app',
      password: process.env.DB_PASS ?? 'app',
      database: process.env.DB_NAME ?? 'app',
      entities: [Pedido],
      synchronize: true,
    }),

    PedidosModule,
  ],
})
export class AppModule {}

