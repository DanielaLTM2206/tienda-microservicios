import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';
import Redis from 'ioredis';
import { Pedido } from './pedido.entity';

/**
 * Servicio de Pedidos — contiene la lógica de negocio.
 * Principio SRP: solo gestiona operaciones de pedidos.
 * Principio DIP: depende de abstracciones (Repository, ClientProxy), inyectadas por NestJS.
 *
 * Implementa DOS caminos de comunicación:
 *   1. SÍNCRONO (TCP): llama a svc-productos y ESPERA respuesta (latencia acumulada).
 *   2. ASÍNCRONO (Redis PUBLISH): publica un evento SIN ESPERAR al consumidor (desacoplado).
 */
@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);
  private readonly redis: Redis;

  constructor(
    @InjectRepository(Pedido)
    private readonly pedidoRepo: Repository<Pedido>,
    @Inject('PRODUCTOS_SERVICE')
    private readonly productosClient: ClientProxy,
  ) {
    // Conexión directa a Redis para publicar eventos (camino asíncrono)
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379'),
    });

    this.redis.on('connect', () =>
      this.logger.log('Conectado a Redis (Publisher)'),
    );
    this.redis.on('error', (err) =>
      this.logger.error(`Error Redis: ${err.message}`),
    );
  }

  /**
   * Obtener todos los pedidos + consultar svc-productos por cada uno (cadena síncrona TCP).
   * Demuestra ACUMULACIÓN DE LATENCIA: tiempo total = latencia pedidos + latencia productos.
   */
  async findAll(): Promise<any[]> {
    this.logger.log('[SINCRONO] Consultando pedidos y productos por TCP...');

    // Salto 1: consultar la BD local
    const pedidos = await this.pedidoRepo.find();

    // Salto 2: llamar svc-productos por TCP (segundo salto de la cadena)
    let productos: any[] = [];
    try {
      productos = await firstValueFrom(
        this.productosClient
          .send({ cmd: 'get_productos' }, {})
          .pipe(
            timeout(4000),
            // Si svc-productos no responde → acoplamiento temporal: el pedido también falla
            catchError((err) => {
              this.logger.error(`svc-productos no responde: ${err.message}`);
              throw new Error('svc-productos no disponible (acoplamiento temporal)');
            }),
          ),
      );
    } catch (err) {
      throw err;
    }

    return pedidos.map((p) => ({
      ...p,
      producto: productos.find((prod: any) => prod.id === p.productoId) ?? null,
    }));
  }

  /**
   * Crear pedido validando el producto (cadena síncrona: 2 saltos TCP).
   */
  async create(data: { productoId: number; cantidad: number }): Promise<Pedido> {
    this.logger.log(`[SINCRONO] Crear pedido -> verificar svc-productos por TCP`);

    // Salto 1 (TCP): verificar que el producto existe
    let producto: any;
    try {
      producto = await firstValueFrom(
        this.productosClient
          .send({ cmd: 'get_producto', }, { id: data.productoId })
          .pipe(
            timeout(4000),
            catchError((err) => {
              this.logger.error(`svc-productos no responde: ${err.message}`);
              throw new Error('svc-productos no disponible - pedido no creado (acoplamiento temporal)');
            }),
          ),
      );
    } catch (err) {
      throw err;
    }

    if (!producto) {
      throw new Error(`Producto ${data.productoId} no encontrado`);
    }

    // Salto 2: guardar en BD local
    const pedido = this.pedidoRepo.create({
      productoId: data.productoId,
      cantidad: data.cantidad,
      estado: 'confirmado',
    });
    const saved = await this.pedidoRepo.save(pedido);

    this.logger.log(`Pedido ${saved.id} creado con producto "${producto.nombre}"`);

    // Publicar evento asíncrono a notificaciones (sin bloquear)
    await this.publicarEvento({
      tipo: 'pedido_creado',
      pedidoId: saved.id,
      productoNombre: producto.nombre,
    });

    return saved;
  }

  /**
   * Publicar evento en Redis — camino ASÍNCRONO.
   * El emisor NO espera a svc-notificaciones → desacoplamiento temporal.
   * Si svc-notificaciones está caído, el pedido IGUAL se procesa.
   */
  async publicarEvento(data: any): Promise<{ ok: boolean; canal: string }> {
    const canal = 'eventos:notificaciones';
    const payload = JSON.stringify({
      ...data,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`[ASINCRONO] Publicando en Redis canal "${canal}"`);

    try {
      await this.redis.publish(canal, payload);
      this.logger.log(`Evento publicado sin bloquear al emisor`);
    } catch (err) {
      // El emisor no falla aunque Redis esté caído — manejo de excepciones en capa de servicios
      this.logger.error(`Error publicando en Redis: ${err.message}`);
    }

    return { ok: true, canal };
  }
}
