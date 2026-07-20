import { Catch, RpcExceptionFilter as NestRpcExceptionFilter, ArgumentsHost, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { throwError, Observable } from 'rxjs';

/**
 * AllRpcExceptionsFilter — captura CUALQUIER excepción en los handlers
 * TCP/gRPC de svc-productos y la convierte en un error estructurado.
 *
 * Sin este filtro, los errores cruzan el transporte como Error genérico
 * y pierden identidad: el llamador no puede saber qué servicio falló ni
 * con qué código. Con él, svc-pedidos recibe { statusCode, message, origen }.
 */
@Catch()
export class AllRpcExceptionsFilter implements NestRpcExceptionFilter<Error> {
  private readonly logger = new Logger(AllRpcExceptionsFilter.name);

  catch(exception: any, host: ArgumentsHost): Observable<any> {
    if (exception instanceof RpcException) {
      const error = exception.getError();
      this.logger.error(
        `[AllRpcExceptionsFilter] RpcException: ${JSON.stringify(error)}`,
      );
      return throwError(() =>
        typeof error === 'object' ? error : { statusCode: 500, message: error },
      );
    }

    const message = exception?.message ?? 'Error desconocido';
    this.logger.error(`[AllRpcExceptionsFilter] Excepción capturada: ${message}`);
    return throwError(() => ({
      statusCode: 500,
      message,
      origen: 'svc-productos',
      timestamp: new Date().toISOString(),
    }));
  }
}
