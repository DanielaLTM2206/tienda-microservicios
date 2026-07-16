import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Servicio de Notificaciones — Patrón SUBSCRIBER del Pub/Sub.
 * Principio SRP: solo recibe y procesa eventos, no conoce al emisor.
 * Principio OCP: para soportar nuevos tipos de eventos basta agregar un case, sin modificar lo existente.
 *
 * DESACOPLAMIENTO TEMPORAL demostrado:
 * - Si este servicio se cae, svc-pedidos sigue funcionando.
 * - Si se vuelve a levantar, simplemente empieza a recibir nuevos eventos.
 * - Los dos servicios NO necesitan estar vivos al mismo tiempo.
 */
@Injectable()
export class NotificacionesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificacionesService.name);
  private subscriber: Redis;
  private readonly CANAL = 'eventos:notificaciones';

  onModuleInit() {
    this.subscriber = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379'),
    });

    this.subscriber.on('connect', () => {
      this.logger.log(`Conectado a Redis como Subscriber`);
    });

    // Suscribirse directamente — ioredis encola el comando hasta que la conexión esté lista.
    // Esto evita el error "subscriber mode" que ocurre al llamar subscribe() dentro del evento connect.
    this.subscriber
      .subscribe(this.CANAL)
      .then((count) => {
        this.logger.log(`Suscrito al canal "${this.CANAL}" (${count} canales activos)`);
      })
      .catch((err) => {
        this.logger.error(`Error al suscribirse: ${err.message}`);
      });

    this.subscriber.on('error', (err: Error) => {
      // Ignorar el error cosmético de ioredis cuando la conexión ya está en modo suscriptor
      if (err.message?.includes('subscriber mode')) return;
      this.logger.error(`Error de conexión Redis: ${err.message}`);
    });

    // Procesar mensajes recibidos — Patrón Publisher/Subscriber
    this.subscriber.on('message', (canal: string, mensaje: string) => {
      this.procesarEvento(canal, mensaje);
    });
  }

  private procesarEvento(canal: string, mensaje: string) {
    try {
      const evento = JSON.parse(mensaje);
      this.logger.log(`Evento recibido en "${canal}": ${JSON.stringify(evento)}`);

      // Patrón OCP: solo agregar cases para nuevos tipos de evento
      switch (evento.tipo) {
        case 'pedido_creado':
          this.logger.log(
            `NOTIFICACION: Pedido #${evento.pedidoId} creado con producto "${evento.productoNombre}"`,
          );
          break;

        default:
          this.logger.log(`Evento generico procesado: ${evento.tipo ?? 'sin tipo'}`);
      }
    } catch (err) {
      // Manejo de excepción en capa de servicio — un mensaje malformado no tumba el servicio
      this.logger.error(`Error al procesar mensaje: ${err.message} | raw: ${mensaje}`);
    }
  }

  async onModuleDestroy() {
    await this.subscriber?.quit();
    this.logger.log('Desconectado de Redis');
  }
}
