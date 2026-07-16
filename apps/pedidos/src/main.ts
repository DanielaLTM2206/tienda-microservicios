import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  // Escucha por TCP — camino síncrono petición-respuesta
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
  await app.listen();
  console.log(`🟢 svc-pedidos escuchando en TCP :${process.env.TCP_PORT ?? '3001'}`);
}
bootstrap();
