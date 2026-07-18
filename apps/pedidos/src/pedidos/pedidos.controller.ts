import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PedidosService } from './pedidos.service';

/**
 * Controlador TCP de svc-pedidos — Avance 2.
 * Agrega el handler get_producto_grpc para demostrar la comunicación gRPC.
 * Los handlers existentes (Avance 1) se conservan intactos.
 *
 * Principio OCP: se extendió agregando nuevos @MessagePattern sin modificar los existentes.
 */
@Controller()
export class PedidosController {
  private readonly logger = new Logger(PedidosController.name);

  constructor(private readonly pedidosService: PedidosService) {}

  // ── Avance 1 (se conservan) ──────────────────────────────────────────────

  @MessagePattern({ cmd: 'get_pedidos' })
  async findAll() {
    this.logger.log('📨 [TCP] Recibido: get_pedidos');
    try {
      return await this.pedidosService.findAll();
    } catch (err) {
      this.logger.error(`❌ Error en get_pedidos: ${err.message}`);
      throw err;
    }
  }

  @MessagePattern({ cmd: 'create_pedido' })
  async create(@Payload() data: { productoId: number; cantidad: number }) {
    this.logger.log(`📨 [TCP] Recibido: create_pedido ${JSON.stringify(data)}`);
    try {
      return await this.pedidosService.create(data);
    } catch (err) {
      this.logger.error(`❌ Error en create_pedido: ${err.message}`);
      throw err;
    }
  }

  @MessagePattern({ cmd: 'publicar_evento' })
  async publicarEvento(@Payload() data: any) {
    this.logger.log(`📨 [TCP] Recibido: publicar_evento`);
    return await this.pedidosService.publicarEvento(data);
  }

  // ── Avance 2 (nuevos) ────────────────────────────────────────────────────

  /**
   * Handler que usa gRPC internamente para obtener un producto.
   * El Gateway llama a svc-pedidos por TCP, y svc-pedidos llama a svc-productos por gRPC.
   * Demuestra: camino TCP → gRPC + manejo de error controlado.
   */
  @MessagePattern({ cmd: 'get_producto_grpc' })
  async obtenerProductoGrpc(@Payload() data: { id: number }) {
    this.logger.log(`📨 [TCP→gRPC] Recibido: get_producto_grpc id=${data.id}`);
    try {
      return await this.pedidosService.obtenerProductoGrpc(data.id);
    } catch (err) {
      // Manejo de excepción: error controlado que no tumba el servicio
      this.logger.error(`❌ Error en get_producto_grpc: ${err.message}`);
      return { ok: false, error: err.message, transporte: 'gRPC' };
    }
  }

  /**
   * Handler para publicar manualmente en RabbitMQ (útil para pruebas).
   */
  @MessagePattern({ cmd: 'publicar_stock' })
  async publicarStock(@Payload() data: any) {
    this.logger.log(`📨 [TCP→RabbitMQ] Recibido: publicar_stock`);
    try {
      return await this.pedidosService.publicarStockRabbitMQ(data);
    } catch (err) {
      this.logger.error(`❌ Error en publicar_stock: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }
}
