import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Patrón: Exception Filter (NestJS)
 * Principio SRP: maneja SOLO la transformación de errores a respuestas HTTP.
 * Captura cualquier excepción (incluyendo timeouts de microservicios TCP).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
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

    this.logger.error(`[${request.method}] ${request.url} → ${status}: ${message}`);

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
