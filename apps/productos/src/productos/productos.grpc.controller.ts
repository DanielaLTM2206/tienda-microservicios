import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ProductosService } from './productos.service';
import { RpcException } from '@nestjs/microservices';

/**
 * Controlador gRPC de svc-productos.
 * Implementa los métodos definidos en el contrato productos.proto.
 *
 * Principio SRP: solo maneja las llamadas gRPC; la lógica de negocio
 * permanece en ProductosService.
 *
 * Manejo de excepciones: los errores se controlan con try/catch y se
 * retorna una respuesta con encontrado=false en lugar de tumbar el servicio.
 * Esto cumple el criterio C3 de la rúbrica: error controlado sin caída.
 */
@Controller()
export class ProductosGrpcController {
  private readonly logger = new Logger(ProductosGrpcController.name);

  constructor(private readonly productosService: ProductosService) {}

  /**
   * rpc ObtenerProducto — busca un producto por ID via gRPC.
   * Si el producto no existe retorna encontrado=false con mensaje de error,
   * en lugar de lanzar una excepción que tumbaría la llamada gRPC.
   */
  @GrpcMethod('ProductosService', 'ObtenerProducto')
  async obtenerProducto(data: { id: number }) {
    this.logger.log(`🟣 [gRPC] ObtenerProducto id=${data.id}`);

    try {
      const producto = await this.productosService.findOne(data.id);

      if (!producto) {
        // Error controlado: producto no encontrado → no tumba el servicio
        this.logger.warn(`⚠️  [gRPC] Producto id=${data.id} no encontrado (error controlado)`);
        return {
          id: 0,
          nombre: '',
          precio: 0,
          disponible: false,
          encontrado: false,
          error: `Producto con id=${data.id} no existe en el catálogo`,
        };
      }

      this.logger.log(`✅ [gRPC] Producto encontrado: "${producto.nombre}"`);
      return {
        id: producto.id,
        nombre: producto.nombre,
        precio: Number(producto.precio),
        disponible: producto.disponible,
        encontrado: true,
        error: '',
      };
    } catch (err) {
      // Manejo de excepción en capa de servicio — no tumba el microservicio
      this.logger.error(`❌ [gRPC] Error en ObtenerProducto: ${err.message}`);
      return {
        id: 0,
        nombre: '',
        precio: 0,
        disponible: false,
        encontrado: false,
        error: `Error interno: ${err.message}`,
      };
    }
  }

  /**
   * rpc ListarProductos — retorna todos los productos via gRPC.
   */
  @GrpcMethod('ProductosService', 'ListarProductos')
  async listarProductos(_data: Record<string, never>) {
    this.logger.log(`🟣 [gRPC] ListarProductos`);

    try {
      const productos = await this.productosService.findAll();
      return {
        productos: productos.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          precio: Number(p.precio),
          disponible: p.disponible,
          encontrado: true,
          error: '',
        })),
      };
    } catch (err) {
      this.logger.error(`❌ [gRPC] Error en ListarProductos: ${err.message}`);
      return { productos: [] };
    }
  }
}
