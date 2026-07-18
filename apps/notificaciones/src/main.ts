import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

/**
 * svc-notificaciones — Avance 2.
 *
 * Ahora consume DOS fuentes de eventos:
 *   1. Redis PUB/SUB  — canal 'eventos:notificaciones' (Avance 1, se conserva)
 *      Implementado directamente con ioredis en NotificacionesService.
 *
 *   2. RabbitMQ queue — cola 'stock_actualizar' (Avance 2, nuevo)
 *      Implementado como microservicio NestJS con Transport.RMQ.
 *
 * Arquitectura híbrida: createApplicationContext (para Redis) + microservice (para RMQ).
 * Permite demostrar el SEGUNDO TRANSPORTE asíncrono (criterio C2 de la rúbrica).
 */
async function bootstrap() {
  // Crear la aplicación base (para que NotificacionesService maneje Redis internamente)
  const app = await NestFactory.create(AppModule);

  // Agregar transporte RabbitMQ como microservicio adicional (Avance 2)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672'],
      queue: 'stock_actualizar',
      queueOptions: { durable: true },
      // noAck: false → confirmación manual para garantizar entrega
      noAck: false,
    },
  });

  await app.startAllMicroservices();
  console.log('🟢 svc-notificaciones iniciado');
  console.log('   📡 Redis SUB → canal: eventos:notificaciones (Avance 1)');
  console.log('   🐇 RabbitMQ → cola: stock_actualizar (Avance 2)');
}
bootstrap();
