import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PedidosService } from './pedidos.service';

/**
 * Controlador TCP de svc-pedidos.
 * Principio SRP: solo maneja el enrutamiento de mensajes TCP.
 * Los @MessagePattern son el equivalente de @Get/@Post pero para transportes de microservicio.
 */
@Controller()
export class PedidosController {
  private readonly logger = new Logger(PedidosController.name);

  constructor(private readonly pedidosService: PedidosService) {}

  /** Recibe { cmd: 'get_pedidos' } del Gateway → inicia cadena síncrona */
  @MessagePattern({ cmd: 'get_pedidos' })
  async findAll() {
    this.logger.log('📨 Recibido: get_pedidos');
    try {
      return await this.pedidosService.findAll();
    } catch (err) {
      this.logger.error(`❌ Error en get_pedidos: ${err.message}`);
      throw err;
    }
  }

  /** Recibe { cmd: 'create_pedido' } con { productoId, cantidad } */
  @MessagePattern({ cmd: 'create_pedido' })
  async create(@Payload() data: { productoId: number; cantidad: number }) {
    this.logger.log(`📨 Recibido: create_pedido ${JSON.stringify(data)}`);
    try {
      return await this.pedidosService.create(data);
    } catch (err) {
      this.logger.error(`❌ Error en create_pedido: ${err.message}`);
      throw err;
    }
  }

  /** Recibe { cmd: 'publicar_evento' } → publica en Redis (asíncrono) */
  @MessagePattern({ cmd: 'publicar_evento' })
  async publicarEvento(@Payload() data: any) {
    this.logger.log(`📨 Recibido: publicar_evento`);
    return await this.pedidosService.publicarEvento(data);
  }
}
