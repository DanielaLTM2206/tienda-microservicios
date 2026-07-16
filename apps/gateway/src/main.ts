import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Patrón: Exception Filter global → SRP (separar el manejo de errores del flujo normal)
  app.useGlobalFilters(new AllExceptionsFilter());

  app.setGlobalPrefix('api');
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`API Gateway corriendo en http://localhost:${port}/api`);
}
bootstrap();
