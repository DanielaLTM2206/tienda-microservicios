import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

/**
 * Sentry se inicializa ANTES de crear la app Nest para capturar también
 * los errores que ocurran durante el bootstrap (conexiones, módulos, etc.).
 * Si SENTRY_DSN no está definido o está vacío, el bloque no se ejecuta
 * y el sistema arranca normalmente sin ninguna dependencia de Sentry.
 */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    serverName: 'gateway',
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 1.0,
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Patrón: Exception Filter global → SRP (separar el manejo de errores del flujo normal)
  app.useGlobalFilters(new AllExceptionsFilter());

  // ValidationPipe global — Avance 3, Criterio C1.
  // whitelist:          elimina propiedades no declaradas en los DTOs
  // forbidNonWhitelisted: lanza 400 si llegan propiedades extra (fail-fast)
  // transform:          convierte automáticamente tipos primitivos (string → number, etc.)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS habilitado para el frontend en desarrollo (localhost:4000)
  app.enableCors({
    origin: ['http://localhost:4000', 'http://127.0.0.1:4000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.setGlobalPrefix('api');
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`API Gateway corriendo en http://localhost:${port}/api`);
}
bootstrap();

