import { Catch, RpcExceptionFilter as NestRpcExceptionFilter, ArgumentsHost, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { throwError, Observable } from 'rxjs';

/**
 * RpcExceptionFilter — Estrategia de manejo de excepciones para la capa RPC.
 *
 * Principio SRP: centraliza el manejo de errores, separándolo del flujo de negocio.
 * Patrón: Exception Filter (NestJS) — captura errores no controlados en los handlers TCP.
 *
 * Este filter evita que una excepción no manejada tumbe el microservicio,
 * retornando un error estructurado al llamador.
 */
@Catch(RpcException)
export class RpcExceptionFilter implements NestRpcExceptionFilter<RpcException> {
  private readonly logger = new Logger(RpcExceptionFilter.name);

  catch(exception: RpcException, host: ArgumentsHost): Observable<any> {
    const error = exception.getError();
    this.logger.error(`[RpcExceptionFilter] Error capturado: ${JSON.stringify(error)}`);
    return throwError(() => error);
  }
}

/**
 * AllRpcExceptionsFilter — captura CUALQUIER excepción (no solo RpcException).
 * Se aplica globalmente en svc-pedidos para garantizar que ningún error tumbe el servicio.
 */
@Catch()
export class AllRpcExceptionsFilter implements NestRpcExceptionFilter<Error> {
  private readonly logger = new Logger(AllRpcExceptionsFilter.name);

  catch(exception: any, host: ArgumentsHost): Observable<any> {
    const message = exception?.message ?? 'Error desconocido';
    this.logger.error(`[AllRpcExceptionsFilter] Excepción capturada: ${message}`);
    // Retorna el error como mensaje estructurado — el servicio SIGUE VIVO
    return throwError(() => ({
      statusCode: 500,
      message,
      timestamp: new Date().toISOString(),
    }));
  }
}
