import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductosModule } from './productos/productos.module';
import { Producto } from './productos/producto.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432'),
      username: process.env.DB_USER ?? 'app',
      password: process.env.DB_PASS ?? 'app',
      database: process.env.DB_NAME ?? 'app',
      entities: [Producto],
      synchronize: true,
    }),
    ProductosModule,
  ],
})
export class AppModule {}
