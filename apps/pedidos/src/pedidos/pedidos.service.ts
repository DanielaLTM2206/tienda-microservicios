import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy, ClientGrpc, RpcException } from '@nestjs/microservices';
import { firstValueFrom, timeout, catchError, Observable } from 'rxjs';
import Redis from 'ioredis';
import { Pedido } from './pedido.entity';

/**
 * Interfaz que describe el stub gRPC generado por NestJS a partir de productos.proto.
 * Principio ISP: la interfaz declara solo los métodos que svc-pedidos necesita.
 */
interface ProductosGrpcService {
  ObtenerProducto(data: { id: number }): Observable<{
    id: number;
    nombre: string;
    precio: number;
    disponible: boolean;
    encontrado: boolean;
    error: string;
  }>;
  ListarProductos(data: Record<string, never>): Observable<{ productos: any[] }>;
}

/**
 * Servicio de Pedidos — Avance 2.
 * Mantiene los caminos TCP y Redis del Avance 1 e incorpora:
 *   - Camino gRPC: consulta svc-productos usando el contrato productos.proto.
 *   - Camino RabbitMQ: publica eventos de stock en la cola stock_actualizar.
 *
 * Principio SRP: gestiona ÚNICAMENTE la lógica de pedidos.
 * Principio DIP: depende de abstracciones (ClientProxy, ClientGrpc, Repository).
 */
@Injectable()
export class PedidosService implements OnModuleInit {
  private readonly logger = new Logger(PedidosService.name);
  private readonly redis: Redis;
  private productosGrpcStub: ProductosGrpcService;

  constructor(
    @InjectRepository(Pedido)
    private readonly pedidoRepo: Repository<Pedido>,

    @Inject('PRODUCTOS_SERVICE')
    private readonly productosTcpClient: ClientProxy,

    @Inject('PRODUCTOS_GRPC_SERVICE')
    private readonly productosGrpcClient: ClientGrpc,

    @Inject('RABBITMQ_SERVICE')
    private readonly rabbitmqClient: ClientProxy,
  ) {
    // Conexión directa a Redis para publicar eventos (camino asíncrono Avance 1)
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
   * OnModuleInit: obtener el stub gRPC a partir del cliente registrado.
   * Debe hacerse DESPUÉS de que los módulos estén listos.
   */
  onModuleInit() {
    this.productosGrpcStub =
      this.productosGrpcClient.getService<ProductosGrpcService>('ProductosService');
    this.logger.log('Stub gRPC de ProductosService inicializado');
  }

  /**
   * Normaliza el error recibido de svc-productos conservando su identidad:
   * - TimeoutError → svc-productos no responde (503, acoplamiento temporal)
   * - error estructurado del filtro de svc-productos → se reenvía tal cual
   * - cualquier otro → 502 con el detalle disponible
   */
  private errorProductos(err: any): {
    statusCode: number;
    message: string;
    origen: string;
  } {
    if (err?.name === 'TimeoutError') {
      return {
        statusCode: 503,
        message: 'svc-productos no responde (timeout) - acoplamiento temporal',
        origen: 'svc-productos',
      };
    }
    if (err?.message) {
      return {
        statusCode: typeof err.statusCode === 'number' ? err.statusCode : 502,
        message: err.message,
        origen: err.origen ?? 'svc-productos',
      };
    }
    return {
      statusCode: 502,
      message: 'Error desconocido al contactar svc-productos',
      origen: 'svc-productos',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CAMINOS AVANCE 1 (se conservan intactos)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * [CAMINO A — TCP] Obtener todos los pedidos + consultar svc-productos (cadena síncrona).
   */
  async findAll(): Promise<any[]> {
    this.logger.log('[TCP] Consultando pedidos y productos...');

    const pedidos = await this.pedidoRepo.find();

    const productos: any[] = await firstValueFrom(
      this.productosTcpClient
        .send({ cmd: 'get_productos' }, {})
        .pipe(
          timeout(4000),
          catchError((err) => {
            this.logger.error(`Error consultando svc-productos: ${err?.message}`);
            // Propagar el error SIN perder identidad: si svc-productos ya
            // envió un error estructurado, se reenvía tal cual
            throw new RpcException(this.errorProductos(err));
          }),
        ),
    );

    return pedidos.map((p) => ({
      ...p,
      producto: productos.find((prod: any) => prod.id === p.productoId) ?? null,
    }));
  }

  /**
   * [CAMINO A — TCP] Crear pedido validando el producto.
   * Al crearlo también publica en Redis (Avance 1) y en RabbitMQ (Avance 2).
   */
  async create(data: { productoId: number; cantidad: number }): Promise<Pedido> {
    this.logger.log(`[TCP] Crear pedido → verificar svc-productos`);

    const producto: any = await firstValueFrom(
      this.productosTcpClient
        .send({ cmd: 'get_producto' }, { id: data.productoId })
        .pipe(
          timeout(4000),
          catchError((err) => {
            this.logger.error(`Error consultando svc-productos: ${err?.message}`);
            throw new RpcException(this.errorProductos(err));
          }),
        ),
    );

    if (!producto) {
      // Error de negocio con identidad: 404, no un Error genérico
      throw new RpcException({
        statusCode: 404,
        message: `Producto ${data.productoId} no encontrado - pedido no creado`,
        origen: 'svc-productos',
      });
    }

    const pedido = this.pedidoRepo.create({
      productoId: data.productoId,
      cantidad: data.cantidad,
      estado: 'confirmado',
    });
    const saved = await this.pedidoRepo.save(pedido);

    this.logger.log(`Pedido ${saved.id} creado con producto "${producto.nombre}"`);

    // Publicar en Redis (Avance 1 — se conserva)
    await this.publicarEvento({
      tipo: 'pedido_creado',
      pedidoId: saved.id,
      productoNombre: producto.nombre,
    });

    // Publicar en RabbitMQ (Avance 2 — segundo transporte)
    await this.publicarStockRabbitMQ({
      tipo: 'stock_actualizar',
      productoId: data.productoId,
      productoNombre: producto.nombre,
      cantidadVendida: data.cantidad,
      pedidoId: saved.id,
    });

    return saved;
  }

  /**
   * [CAMINO B — Redis PUBLISH] Publicar evento asíncrono (Avance 1).
   * El emisor NO espera → desacoplamiento temporal.
   */
  async publicarEvento(data: any): Promise<{ ok: boolean; canal: string }> {
    const canal = 'eventos:notificaciones';
    const payload = JSON.stringify({
      ...data,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`[Redis] Publicando en canal "${canal}"`);

    try {
      await this.redis.publish(canal, payload);
      this.logger.log(`Evento Redis publicado sin bloquear al emisor`);
    } catch (err) {
      // Excepción controlada — el emisor no falla aunque Redis esté caído
      this.logger.error(`Error publicando en Redis: ${err.message}`);
    }

    return { ok: true, canal };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CAMINOS AVANCE 2 (nuevos)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * [CAMINO C — gRPC] Obtener un producto usando el contrato productos.proto.
   * Demuestra: comunicación gRPC + manejo de excepción controlada (C1 + C3 rúbrica).
   *
   * Si el producto no existe → retorna error controlado SIN tumbar el servicio.
   * Si gRPC no está disponible → try/catch captura y retorna error descriptivo.
   */
  async obtenerProductoGrpc(id: number): Promise<any> {
    this.logger.log(`[gRPC] ObtenerProducto id=${id}`);

    try {
      const respuesta = await firstValueFrom(
        this.productosGrpcStub.ObtenerProducto({ id }).pipe(
          timeout(5000),
          catchError((err) => {
            this.logger.error(`[gRPC] Timeout o error de transporte: ${err.message}`);
            throw new Error(`gRPC no disponible: ${err.message}`);
          }),
        ),
      );

      if (!respuesta.encontrado) {
        // Error de negocio controlado — no tumba el servicio
        this.logger.warn(`[gRPC] Error controlado: ${respuesta.error}`);
        return {
          ok: false,
          transporte: 'gRPC',
          error: respuesta.error,
        };
      }

      this.logger.log(`[gRPC] ✅ Producto encontrado: "${respuesta.nombre}"`);
      return {
        ok: true,
        transporte: 'gRPC',
        producto: respuesta,
      };
    } catch (err) {
      // Excepción de infraestructura controlada — no tumba el servicio
      this.logger.error(`[gRPC] ❌ Error capturado (servicio sigue vivo): ${err.message}`);
      return {
        ok: false,
        transporte: 'gRPC',
        error: err.message,
      };
    }
  }

  /**
   * [CAMINO D — RabbitMQ] Publicar evento de actualización de stock.
   * Patrón PUB/SUB: svc-pedidos publica → svc-notificaciones consume.
   * Segundo transporte asíncrono, distinto al Redis del Avance 1.
   */
  async publicarStockRabbitMQ(data: {
    tipo: string;
    productoId: number;
    productoNombre: string;
    cantidadVendida: number;
    pedidoId: number;
  }): Promise<{ ok: boolean; cola: string }> {
    const cola = 'stock_actualizar';
    this.logger.log(`[RabbitMQ] Publicando en cola "${cola}"`);

    try {
      // emit() = fire-and-forget (no espera respuesta) → asíncrono
      this.rabbitmqClient.emit('stock.actualizar', {
        ...data,
        timestamp: new Date().toISOString(),
      });
      this.logger.log(`[RabbitMQ] ✅ Mensaje publicado en cola "${cola}"`);
    } catch (err) {
      // Excepción controlada — el emisor no falla aunque RabbitMQ esté caído
      this.logger.error(`[RabbitMQ] Error publicando: ${err.message}`);
    }

    return { ok: true, cola };
  }
}
