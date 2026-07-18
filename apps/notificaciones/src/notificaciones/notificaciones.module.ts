import { Module } from '@nestjs/common';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';

/**
 * Módulo de Notificaciones — Avance 2.
 * Registra el nuevo controller RabbitMQ junto al service que ya manejaba Redis.
 * Principio OCP: se extendió sin modificar el código de Avance 1.
 */
@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
})
export class NotificacionesModule {}
