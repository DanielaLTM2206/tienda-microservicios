import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductosController } from './productos.controller';
import { ProductosGrpcController } from './productos.grpc.controller';
import { ProductosService } from './productos.service';
import { Producto } from './producto.entity';

/**
 * Módulo de Productos.
 * Registra DOS controllers:
 *   - ProductosController: maneja mensajes TCP (Avance 1).
 *   - ProductosGrpcController: maneja llamadas gRPC (Avance 2).
 * Principio OCP: se extendió agregando el nuevo controller sin modificar el existente.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Producto])],
  controllers: [ProductosController, ProductosGrpcController],
  providers: [ProductosService],
})
export class ProductosModule {}
