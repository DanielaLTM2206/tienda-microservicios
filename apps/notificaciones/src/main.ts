import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * svc-notificaciones: NO expone TCP ni HTTP.
 * Solo se suscribe a Redis y procesa eventos de manera autónoma.
 * Esto demuestra el DESACOPLAMIENTO TEMPORAL: puede estar caído sin afectar el emisor.
 */
async function bootstrap() {
  // Levantamos como aplicación standalone (sin transporte de red propio)
  // El servicio escucha Redis internamente desde NotificacionesService
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('svc-notificaciones iniciado - suscrito a Redis pub/sub');
  console.log('   Canal: eventos:notificaciones');
  console.log('   Este servicio puede caerse sin afectar al emisor (desacoplamiento temporal)');
}
bootstrap();
