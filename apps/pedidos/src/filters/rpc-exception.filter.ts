import { Catch, RpcExceptionFilter as NestRpcExceptionFilter, ArgumentsHost, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { throwError, Observable } from 'rxjs';
import * as Sentry from '@sentry/node';

/**
 * AllRpcExceptionsFilter — UNICO filtro de la capa RPC de svc-pedidos.
 *
 * Patrón: Exception Filter (NestJS). Principio SRP: centraliza el manejo de
 * errores y lo separa del flujo de negocio.
 *
 * Decisión de diseño: un solo filtro con @Catch() (sin argumentos) en lugar de
 * dos filtros (uno @Catch(RpcException) + uno genérico). @Catch() ya recibe TODA
 * excepción, y dentro se distingue el caso RpcException del Error inesperado.
 * Un segundo filtro específico seria codigo muerto: nunca se registraria porque
 * este ya cubre el mismo caso, y Nest aplica el primero que coincide.
 *
 * Se registra globalmente en main.ts, de modo que ninguna excepción tumbe el
 * microservicio y el llamador siempre reciba { statusCode, message, ... }.
 *
 * Sentry — decisión de diseño:
 *   Las RpcException estructuradas son errores de negocio controlados
 *   (ej: "producto no existe", "cantidad inválida"). NO las reportamos a Sentry
 *   porque son casos esperados. Solo capturamos excepciones inesperadas (5xx) para
 *   mantener el panel limpio y útil.
 */
@Catch()
export class AllRpcExceptionsFilter implements NestRpcExceptionFilter<Error> {
  private readonly logger = new Logger(AllRpcExceptionsFilter.name);

  catch(exception: any, host: ArgumentsHost): Observable<any> {
    // RpcException ya trae un error estructurado — se propaga tal cual
    // para que el llamador conserve la identidad del error (statusCode, origen)
    if (exception instanceof RpcException) {
      const error = exception.getError();
      this.logger.error(
        `[AllRpcExceptionsFilter] RpcException: ${JSON.stringify(error)}`,
      );
      // RpcExceptions son errores controlados de negocio — NO van a Sentry
      return throwError(() =>
        typeof error === 'object' ? error : { statusCode: 500, message: error },
      );
    }

    const message = exception?.message ?? 'Error desconocido';
    this.logger.error(`[AllRpcExceptionsFilter] Excepción capturada: ${message}`);

    // Excepción no controlada en svc-pedidos: la capturamos en Sentry con contexto
    Sentry.withScope((scope) => {
      scope.setTag('service', 'svc-pedidos');
      scope.setTag('transport', 'TCP');
      scope.setExtra('statusCode', 500);
      scope.setExtra('message', message);
      Sentry.captureException(exception instanceof Error ? exception : new Error(message));
    });

    // Retorna el error como mensaje estructurado — el servicio SIGUE VIVO
    return throwError(() => ({
      statusCode: 500,
      message,
      timestamp: new Date().toISOString(),
    }));
  }
}
