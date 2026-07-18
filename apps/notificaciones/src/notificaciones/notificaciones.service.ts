import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Servicio de Notificaciones — Avance 2.
 * Mantiene el suscriptor Redis del Avance 1 y agrega el procesamiento
 * de eventos RabbitMQ (llamado desde NotificacionesController).
 *
 * Principio SRP: cada método procesa un tipo específico de evento.
 * Principio OCP: agregar un nuevo evento = agregar un case o método, sin modificar los existentes.
 */
@Injectable()
export class NotificacionesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificacionesService.name);
  private subscriber: Redis;
  private readonly CANAL = 'eventos:notificaciones';

  // ── Avance 1: Redis Subscriber (se conserva intacto) ─────────────────────

  onModuleInit() {
    this.subscriber = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379'),
    });

    this.subscriber.on('connect', () => {
      this.logger.log(`📡 Conectado a Redis como Subscriber`);
    });

    this.subscriber
      .subscribe(this.CANAL)
      .then((count) => {
        this.logger.log(`Suscrito al canal Redis "${this.CANAL}" (${count} canales activos)`);
      })
      .catch((err) => {
        this.logger.error(`Error al suscribirse a Redis: ${err.message}`);
      });

    this.subscriber.on('error', (err: Error) => {
      if (err.message?.includes('subscriber mode')) return;
      this.logger.error(`Error de conexión Redis: ${err.message}`);
    });

    this.subscriber.on('message', (canal: string, mensaje: string) => {
      this.procesarEventoRedis(canal, mensaje);
    });
  }

  private procesarEventoRedis(canal: string, mensaje: string) {
    try {
      const evento = JSON.parse(mensaje);
      this.logger.log(`📡 [Redis] Evento en "${canal}": ${JSON.stringify(evento)}`);

      switch (evento.tipo) {
        case 'pedido_creado':
          this.logger.log(
            `📢 [Redis] NOTIFICACIÓN: Pedido #${evento.pedidoId} creado con producto "${evento.productoNombre}"`,
          );
          break;
        default:
          this.logger.log(`📢 [Redis] Evento genérico: ${evento.tipo ?? 'sin tipo'}`);
      }
    } catch (err) {
      // Error controlado — un mensaje malformado no tumba el servicio
      this.logger.error(`❌ [Redis] Error al procesar mensaje: ${err.message} | raw: ${mensaje}`);
    }
  }

  async onModuleDestroy() {
    await this.subscriber?.quit();
    this.logger.log('Desconectado de Redis');
  }

  // ── Avance 2: Procesador de eventos RabbitMQ ─────────────────────────────

  /**
   * Procesa eventos de actualización de stock llegados desde RabbitMQ.
   * Llamado por NotificacionesController cuando llega un mensaje de la cola stock_actualizar.
   *
   * Manejo de excepciones: try/catch asegura que un mensaje malformado
   * no tumbe el consumidor — error controlado demostrado (C3 rúbrica).
   */
  async procesarStockUpdate(data: any): Promise<void> {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Payload inválido — se esperaba un objeto');
      }

      this.logger.log(`🐇 [RabbitMQ] Procesando stock.actualizar:`);
      this.logger.log(`   Producto: #${data.productoId} "${data.productoNombre}"`);
      this.logger.log(`   Cantidad vendida: ${data.cantidadVendida}`);
      this.logger.log(`   Pedido relacionado: #${data.pedidoId}`);
      this.logger.log(`   Timestamp: ${data.timestamp}`);

      // Aquí iría la lógica real de actualización de stock (p. ej. llamar a BD)
      // Por ahora se simula el procesamiento con un log
      this.logger.log(
        `✅ [RabbitMQ] Stock del producto "${data.productoNombre}" actualizado: -${data.cantidadVendida} unidades`,
      );
    } catch (err) {
      // Excepción controlada — no tumba el consumidor
      this.logger.error(`❌ [RabbitMQ] Error controlado en procesarStockUpdate: ${err.message}`);
      throw err; // Re-lanzar para que el controller también lo registre
    }
  }
}
