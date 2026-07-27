import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { AllRpcExceptionsFilter } from './filters/rpc-exception.filter';

/**
 * svc-pedidos — Avance 2 + Avance 3 (Sentry).
 * Escucha en TCP :3001 (igual que Avance 1).
 * Aplica AllRpcExceptionsFilter globalmente para que ningún error tumbe el servicio.
 *
 * Sentry se inicializa ANTES de crear el microservicio para capturar errores
 * de bootstrap. Sin SENTRY_DSN el bloque se omite y el servicio arranca normal.
 */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    serverName: 'svc-pedidos',
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 1.0,
  });
}

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: parseInt(process.env.TCP_PORT ?? '3001'),
      },
    },
  );

  // Estrategia consistente de manejo de excepciones (C3 rúbrica)
  app.useGlobalFilters(new AllRpcExceptionsFilter());

  await app.listen();
  console.log(`🟢 svc-pedidos escuchando en TCP :${process.env.TCP_PORT ?? '3001'}`);
  console.log(`   → gRPC client hacia svc-productos :${process.env.GRPC_PRODUCTOS_URL ?? 'localhost:5000'}`);
  console.log(`   → RabbitMQ publisher → cola stock_actualizar`);
}
bootstrap();
