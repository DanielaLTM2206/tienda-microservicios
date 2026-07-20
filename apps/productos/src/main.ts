import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllRpcExceptionsFilter } from './filters/rpc-exception.filter';

/**
 * svc-productos arranaca con DOS transportes simultáneos:
 *   1. TCP  :3002 — camino síncrono legado (Avance 1, se conserva)
 *   2. gRPC :5000 — nuevo camino con contrato productos.proto (Avance 2)
 *
 * NestJS permite múltiples transportes mediante connectMicroservice().
 * Patrón: Hybrid Application (HTTP + Microservice).
 */
async function bootstrap() {
  // Crear aplicación híbrida (puede tener múltiples transportes)
  const app = await NestFactory.create(AppModule);

  // Transporte 1: TCP — se conserva para compatibilidad con Avance 1
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: parseInt(process.env.TCP_PORT ?? '3002'),
    },
  });

  // Transporte 2: gRPC — nuevo en Avance 2
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'productos',
      protoPath: join(__dirname, 'proto', 'productos.proto'),
      url: `0.0.0.0:${process.env.GRPC_PORT ?? '5000'}`,
    },
  });

  // Estrategia consistente de manejo de excepciones en TODOS los transportes:
  // los errores cruzan TCP/gRPC como objeto estructurado, no como Error genérico
  app.useGlobalFilters(new AllRpcExceptionsFilter());

  // init() dispara los hooks de ciclo de vida (onModuleInit → seed de datos).
  // Sin esto, en una app híbrida que nunca llama listen(), el seed no corre.
  await app.init();
  await app.startAllMicroservices();
  console.log(`🟢 svc-productos escuchando en TCP :${process.env.TCP_PORT ?? '3002'}`);
  console.log(`🟣 svc-productos escuchando en gRPC :${process.env.GRPC_PORT ?? '5000'}`);
}
bootstrap();
