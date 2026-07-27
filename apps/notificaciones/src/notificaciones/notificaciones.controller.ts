import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import * as Sentry from '@sentry/node';
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
   *
   * Sentry: si el procesamiento falla de forma inesperada, lo capturamos
   * con el payload del evento fallido para facilitar el diagnóstico.
   */
  @EventPattern('stock.actualizar')
  async handleStockActualizar(@Payload() data: any) {
    this.logger.log(`🐇 [RabbitMQ] Evento recibido: stock.actualizar`);
    try {
      await this.notificacionesService.procesarStockUpdate(data);
    } catch (err) {
      // Manejo de excepción en capa de servicios — el consumidor SIGUE VIVO
      this.logger.error(`❌ [RabbitMQ] Error procesando evento: ${err.message}`);

      // Captura en Sentry con el payload del evento fallido como contexto.
      // Esto permite diagnosticar si el problema es un mensaje malformado
      // (dato extra en el payload) o un error de infraestructura del servicio.
      Sentry.withScope((scope) => {
        scope.setTag('service', 'svc-notificaciones');
        scope.setTag('transport', 'RabbitMQ');
        scope.setExtra('event', 'stock.actualizar');
        scope.setExtra('payload', data);
        Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
      });
    }
  }
}
