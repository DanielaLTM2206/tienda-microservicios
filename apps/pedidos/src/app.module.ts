import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PedidosModule } from './pedidos/pedidos.module';
import { Pedido } from './pedidos/pedido.entity';

/**
 * AppModule de svc-pedidos.
 * Principio DIP: depende de abstracciones (ClientsModule, TypeOrmModule), no de clases concretas.
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
      synchronize: true, // Solo para desarrollo — en prod usar migraciones
    }),
    // Cliente TCP hacia svc-productos (segundo salto de la cadena síncrona)
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
    PedidosModule,
  ],
})
export class AppModule {}
