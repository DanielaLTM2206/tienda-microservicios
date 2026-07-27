import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

/**
 * Patrón: Exception Filter (NestJS)
 * Principio SRP: maneja SOLO la transformación de errores a respuestas HTTP.
 * Captura cualquier excepción (incluyendo timeouts de microservicios TCP).
 *
 * Sentry — decisión de diseño:
 *   Solo reportamos errores 5xx (errores del servidor / excepciones no controladas).
 *   Los errores 4xx (401 sin token, 403 sin rol, 400 de validación, 404 de recurso)
 *   son errores del CLIENTE, esperados y que el negocio controla conscientemente.
 *   Reportarlos llenaría el panel de Sentry de ruido y oscultaría los problemas reales.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    // BUG FIX (Avance 3): el filtro anterior usaba exception.message, que para las
    // excepciones del ValidationPipe devuelve solo "Bad Request Exception".
    // El detalle real vive en exception.getResponse(), que retorna un objeto
    // { statusCode, message: string[], error } donde message es el array de strings
    // con los mensajes del class-validator. getResponse() también puede devolver un
    // string plano (HttpException simples), por lo que distinguimos ambos casos.
    let message: string | string[] = 'Error interno del servidor';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();

      if (typeof resp === 'string') {
        // HttpException creada con un string simple: new HttpException('msg', 400)
        message = resp;
      } else if (typeof resp === 'object' && resp !== null) {
        // ValidationPipe y otras HttpException con body estructurado:
        // { statusCode, message, error } — preservamos message (puede ser array)
        const body = resp as { message?: string | string[]; error?: string };
        message = body.message ?? exception.message;
      }
    } else if (exception instanceof Error) {
      // Detectar timeout de microservicio → acoplamiento temporal
      if (exception.message.includes('Connection refused') ||
          exception.message.includes('ECONNREFUSED') ||
          exception.message.includes('timeout')) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Microservicio no disponible (acoplamiento temporal demostrado)';
      } else {
        message = exception.message;
      }
    }

    this.logger.error(`[${request.method}] ${request.url} → ${status}: ${JSON.stringify(message)}`);

    // Sentry: solo capturar errores 5xx. Los 4xx son esperados del cliente.
    if (status >= 500) {
      Sentry.withScope((scope) => {
        scope.setTag('service', 'gateway');
        scope.setTag('transport', 'HTTP');
        scope.setExtra('url', request.url);
        scope.setExtra('method', request.method);
        scope.setExtra('statusCode', status);
        scope.setExtra('body', request.body);
        Sentry.captureException(exception);
      });
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
