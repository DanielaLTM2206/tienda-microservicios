import {
  Controller,
  Get,
  Post,
  Body,
  Inject,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout, catchError, throwError } from 'rxjs';

/**
 * Patrón: Proxy — el Gateway delega la lógica al microservicio pedidos.
 * No contiene lógica de negocio, solo enrutamiento y manejo de errores.
 * Principio SRP: solo maneja rutas HTTP relacionadas con pedidos.
 */
@Controller('pedidos')
export class PedidosController {
  private readonly logger = new Logger(PedidosController.name);

  constructor(
    @Inject('PEDIDOS_SERVICE') private readonly pedidosClient: ClientProxy,
  ) {}

  /**
   * GET /api/pedidos
   * Camino SÍNCRONO: Gateway → svc-pedidos (TCP) → svc-productos (TCP)
   * La latencia se ACUMULA en cada salto.
   */
  @Get()
  async findAll() {
    this.logger.log('[SINCRONO] GET /api/pedidos -> svc-pedidos (TCP)');
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
   * Camino SÍNCRONO: crea un pedido y valida el producto (2 saltos TCP).
   */
  @Post()
  async create(@Body() body: { productoId: number; cantidad: number }) {
    this.logger.log('[SINCRONO] POST /api/pedidos -> svc-pedidos (TCP) -> svc-productos (TCP)');
    try {
      const result = await firstValueFrom(
        this.pedidosClient.send({ cmd: 'create_pedido' }, body).pipe(
          timeout(5000),
          catchError(() =>
            throwError(
              () =>
                new HttpException(
                  'Error en cadena sincrona - uno de los servicios no responde',
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
   * Camino ASÍNCRONO: Gateway → svc-pedidos (TCP) → Redis PUBLISH → svc-notificaciones
   * El emisor NO espera al consumidor → no hay acoplamiento temporal.
   */
  @Post('notificar')
  async notificar(@Body() body: { mensaje: string }) {
    this.logger.log('[ASINCRONO] POST /api/pedidos/notificar -> svc-pedidos -> Redis');
    try {
      const result = await firstValueFrom(
        this.pedidosClient.send({ cmd: 'publicar_evento' }, body).pipe(
          timeout(5000),
          catchError(() =>
            throwError(
              () =>
                new HttpException('Error publicando evento', HttpStatus.BAD_GATEWAY),
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
