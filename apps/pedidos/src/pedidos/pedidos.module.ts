import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { Pedido } from './pedido.entity';

/**
 * Módulo de Pedidos.
 * Registra los tres clientes de transporte que usa PedidosService:
 *   - PRODUCTOS_SERVICE (TCP)
 *   - PRODUCTOS_GRPC_SERVICE (gRPC)
 *   - RABBITMQ_SERVICE (RMQ)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Pedido]),

    // TCP (Avance 1)
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

    // gRPC (Avance 2)
    ClientsModule.register([
      {
        name: 'PRODUCTOS_GRPC_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'productos',
          protoPath: join(__dirname, '..', 'proto', 'productos.proto'),
          url: `${process.env.GRPC_PRODUCTOS_URL ?? 'localhost:5000'}`,
        },
      },
    ]),

    // RabbitMQ (Avance 2 — segundo transporte)
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
  ],
  controllers: [PedidosController],
  providers: [PedidosService],
})
export class PedidosModule {}
