import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Inject,
  HttpException,
  HttpStatus,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout, catchError, throwError } from 'rxjs';

/**
 * Patrón: Proxy — el Gateway delega la lógica al microservicio pedidos.
 * Principio SRP: solo maneja rutas HTTP relacionadas con pedidos.
 *
 * Avance 2 — agrega:
 *   GET  /api/pedidos/producto/:id/grpc  → demuestra comunicación gRPC
 *   POST /api/pedidos/stock              → publica manualmente en RabbitMQ
 */
@Controller('pedidos')
export class PedidosController {
  private readonly logger = new Logger(PedidosController.name);

  constructor(
    @Inject('PEDIDOS_SERVICE') private readonly pedidosClient: ClientProxy,
  ) {}

  // ── Avance 1 (se conservan) ──────────────────────────────────────────────

  /**
   * GET /api/pedidos
   * Camino SÍNCRONO: Gateway → svc-pedidos (TCP) → svc-productos (TCP)
   */
  @Get()
  async findAll() {
    this.logger.log('[TCP] GET /api/pedidos → svc-pedidos');
    try {
      const result = await firstValueFrom(
        this.pedidosClient.send({ cmd: 'get_pedidos' }, {}).pipe(
          timeout(5000),
          catchError((err) =>
            throwError(
              () =>
                new HttpException(
                  'svc-pedidos no responde - acoplamiento temporal demostrado',
                  HttpStatus.SERVICE_UNAVAILABLE,
                ),
            ),
          ),
        ),
      );
      return result;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        `Error al contactar svc-pedidos: ${err.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * POST /api/pedidos
   * Camino SÍNCRONO: crea un pedido (valida producto TCP, notifica Redis + RabbitMQ)
   */
  @Post()
  async create(@Body() body: { productoId: number; cantidad: number }) {
    this.logger.log('[TCP] POST /api/pedidos → svc-pedidos → svc-productos');
    try {
      const result = await firstValueFrom(
        this.pedidosClient.send({ cmd: 'create_pedido' }, body).pipe(
          timeout(5000),
          catchError(() =>
            throwError(
              () =>
                new HttpException(
                  'Error en cadena síncrona - uno de los servicios no responde',
                  HttpStatus.SERVICE_UNAVAILABLE,
                ),
            ),
          ),
        ),
      );
      return result;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        `Error al crear pedido: ${err.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * POST /api/pedidos/notificar
   * Camino ASÍNCRONO (Redis): publica evento en Redis vía svc-pedidos
   */
  @Post('notificar')
  async notificar(@Body() body: { mensaje: string }) {
    this.logger.log('[Redis] POST /api/pedidos/notificar → svc-pedidos → Redis');
    try {
      const result = await firstValueFrom(
        this.pedidosClient.send({ cmd: 'publicar_evento' }, body).pipe(
          timeout(5000),
          catchError(() =>
            throwError(
              () =>
                new HttpException('Error publicando evento Redis', HttpStatus.BAD_GATEWAY),
            ),
          ),
        ),
      );
      return result;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(err.message, HttpStatus.BAD_GATEWAY);
    }
  }

  // ── Avance 2 (nuevos) ────────────────────────────────────────────────────

  /**
   * GET /api/pedidos/producto/:id/grpc
   * Demuestra la comunicación gRPC:
   * Gateway (HTTP) → svc-pedidos (TCP) → svc-productos (gRPC)
   *
   * Con id=999 o cualquier id inexistente → muestra error CONTROLADO sin caída.
   */
  @Get('producto/:id/grpc')
  async obtenerProductoGrpc(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`[gRPC] GET /api/pedidos/producto/${id}/grpc`);
    try {
      const result = await firstValueFrom(
        this.pedidosClient
          .send({ cmd: 'get_producto_grpc' }, { id })
          .pipe(
            timeout(6000),
            catchError((err) =>
              throwError(
                () =>
                  new HttpException(
                    `Error en comunicación gRPC: ${err.message}`,
                    HttpStatus.BAD_GATEWAY,
                  ),
              ),
            ),
          ),
      );
      return result;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        `Error al consultar producto por gRPC: ${err.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * POST /api/pedidos/stock
   * Publica manualmente un evento en RabbitMQ (útil para probar el flujo PUB/SUB).
   * Flujo: Gateway (HTTP) → svc-pedidos (TCP) → RabbitMQ → svc-notificaciones
   */
  @Post('stock')
  async publicarStock(
    @Body()
    body: {
      productoId: number;
      productoNombre: string;
      cantidadVendida: number;
      pedidoId: number;
    },
  ) {
    this.logger.log('[RabbitMQ] POST /api/pedidos/stock → svc-pedidos → RabbitMQ');
    try {
      const result = await firstValueFrom(
        this.pedidosClient
          .send({ cmd: 'publicar_stock' }, { ...body, tipo: 'stock_actualizar' })
          .pipe(
            timeout(5000),
            catchError((err) =>
              throwError(
                () =>
                  new HttpException(
                    `Error publicando en RabbitMQ: ${err.message}`,
                    HttpStatus.BAD_GATEWAY,
                  ),
              ),
            ),
          ),
      );
      return result;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(err.message, HttpStatus.BAD_GATEWAY);
    }
  }
}
