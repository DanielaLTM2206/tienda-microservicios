import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificacionesService } from './notificaciones.service';

/**
 * Controlador RabbitMQ de svc-notificaciones.
 * Escucha el evento 'stock.actualizar' en la cola 'stock_actualizar'.
 *
 * Patrón: Publisher/Subscriber — svc-pedidos publica, este servicio consume.
 * Principio SRP: solo maneja el enrutamiento de eventos RabbitMQ.
 *
 * Diferencia con Redis (Avance 1):
 *   - Redis: canal volátil, sin garantía de entrega si el consumidor está caído.
 *   - RabbitMQ: cola durable, mensajes persisten hasta ser procesados (garantía de entrega).
 */
@Controller()
export class NotificacionesController {
  private readonly logger = new Logger(NotificacionesController.name);

  constructor(private readonly notificacionesService: NotificacionesService) {}

  /**
   * Consume mensajes de la cola 'stock_actualizar' publicados por svc-pedidos.
   * @EventPattern mapea el routing key / event pattern de RabbitMQ.
   *
   * Manejo de excepciones: el try/catch en el servicio garantiza que
   * un mensaje malformado NO tumbe el consumidor.
   */
  @EventPattern('stock.actualizar')
  async handleStockActualizar(@Payload() data: any) {
    this.logger.log(`🐇 [RabbitMQ] Evento recibido: stock.actualizar`);
    try {
      await this.notificacionesService.procesarStockUpdate(data);
    } catch (err) {
      // Manejo de excepción en capa de servicios — el consumidor SIGUE VIVO
      this.logger.error(`❌ [RabbitMQ] Error procesando evento: ${err.message}`);
    }
  }
}
