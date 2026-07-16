import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PedidosController } from './pedidos.controller';

/**
 * Principio SRP: este módulo solo gestiona la delegación de peticiones de pedidos.
 */
@Module({
  imports: [
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
  ],
  controllers: [PedidosController],
})
export class PedidosModule {}
