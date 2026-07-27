import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

/**
 * AuthModule — Avance 3, Criterio C1.
 *
 * Registra PassportModule y JwtModule con registerAsync para leer
 * JWT_SECRET y JWT_EXPIRES_IN desde el entorno en tiempo de ejecución
 * (no en tiempo de compilación), siguiendo el principio de configuración
 * externalizada (12-Factor App, factor III).
 *
 * Exporta JwtModule y PassportModule para que otros módulos del Gateway
 * (p. ej. Guards de los compañeros) puedan inyectar JwtService sin
 * volver a importar este módulo completo.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET ?? 'cambiar_en_produccion',
        signOptions: {
          // El cast es necesario porque @types/jsonwebtoken exige StringValue
          // (tipo opaco de la librería 'ms') en lugar de string plano.
          expiresIn: (process.env.JWT_EXPIRES_IN ?? '1h') as StringValue,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtModule, PassportModule],
})
export class AuthModule {}
