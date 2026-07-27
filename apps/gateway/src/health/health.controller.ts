import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  /**
   * Ruta pública: el health check debe responder sin credenciales para que
   * Docker y el equipo puedan comprobar que el Gateway está vivo. No expone
   * datos del negocio, solo el estado del propio servicio.
   */
  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
    };
  }
}
