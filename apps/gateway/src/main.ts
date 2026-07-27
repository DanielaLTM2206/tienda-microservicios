import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

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

  app.setGlobalPrefix('api');
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`API Gateway corriendo en http://localhost:${port}/api`);
}
bootstrap();

