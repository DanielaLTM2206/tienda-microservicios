import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { PedidosModule } from './pedidos/pedidos.module';
import { Pedido } from './pedidos/pedido.entity';

/**
 * AppModule de svc-pedidos — Avance 2.
 * Registra TRES clientes de transporte:
 *   1. TCP  → svc-productos (Avance 1, se conserva)
 *   2. gRPC → svc-productos (Avance 2, nuevo)
 *   3. RMQ  → RabbitMQ (Avance 2, segundo transporte)
 *
 * Principio DIP: depende de abstracciones (ClientsModule), no de clases concretas.
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

    // Cliente 1: TCP → svc-productos (Avance 1, se conserva)
    ClientsModule.register([
      {
        name: 'PRODUCTOS_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.SVC_PRODUCTOS_HOST ?? 'localhost',
          port: parseInt(process.env.SVC_PRODUCTOS_PORT ?? '3002'),
        },
      },
    ]),

    // Cliente 2: gRPC → svc-productos (Avance 2)
    ClientsModule.register([
      {
        name: 'PRODUCTOS_GRPC_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'productos',
          protoPath: join(__dirname, 'proto', 'productos.proto'),
          url: `${process.env.GRPC_PRODUCTOS_URL ?? 'localhost:5000'}`,
        },
      },
    ]),

    // Cliente 3: RabbitMQ → segundo transporte asíncrono (Avance 2)
    ClientsModule.register([
      {
        name: 'RABBITMQ_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672'],
          queue: 'stock_actualizar',
          queueOptions: { durable: true },
        },
      },
    ]),

    PedidosModule,
  ],
})
export class AppModule {}
