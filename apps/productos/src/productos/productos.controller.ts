import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { ProductosService } from './productos.service';

/**
 * Controlador TCP de svc-productos.
 * Recibe mensajes del svc-pedidos (segundo salto de la cadena síncrona).
 * Si este servicio se cae → TODO el flujo síncrono falla (acoplamiento temporal).
 *
 * Los errores se relanzan como RpcException estructurada para que crucen
 * el transporte TCP sin perder identidad (quién falló y con qué código).
 */
@Controller()
export class ProductosController {
  private readonly logger = new Logger(ProductosController.name);

  constructor(private readonly productosService: ProductosService) {}

  @MessagePattern({ cmd: 'get_productos' })
  async findAll() {
    this.logger.log('📨 Recibido: get_productos (salto 2 de cadena síncrona)');
    try {
      return await this.productosService.findAll();
    } catch (err) {
      this.logger.error(`❌ Error en get_productos: ${err.message}`);
      throw new RpcException({
        statusCode: 500,
        message: `svc-productos: ${err.message}`,
        origen: 'svc-productos',
      });
    }
  }

  @MessagePattern({ cmd: 'get_producto' })
  async findOne(@Payload() data: { id: number }) {
    this.logger.log(`📨 Recibido: get_producto id=${data.id}`);
    try {
      return await this.productosService.findOne(data.id);
    } catch (err) {
      this.logger.error(`❌ Error en get_producto: ${err.message}`);
      throw new RpcException({
        statusCode: 500,
        message: `svc-productos: ${err.message}`,
        origen: 'svc-productos',
      });
    }
  }
}
