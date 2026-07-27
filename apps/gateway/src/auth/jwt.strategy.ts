import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * Estrategia Passport-JWT.
 *
 * - Extrae el token del header Authorization: Bearer <token>
 * - Valida la firma con JWT_SECRET y rechaza tokens expirados.
 * - El payload resultante queda disponible en req.user para cualquier Guard.
 *
 * Principio SRP: solo se ocupa de validar/extraer el JWT; no toca la lógica
 * de negocio ni de autorización (eso lo hacen los Guards de los compañeros).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,                      // rechaza tokens expirados
      secretOrKey: process.env.JWT_SECRET ?? 'cambiar_en_produccion',
    });
  }

  /**
   * NestJS llama a este método SOLO si la firma ya fue verificada.
   * Mapea el payload a un objeto usuario limpio que queda en req.user.
   */
  async validate(payload: { sub: number; username: string; rol: string }) {
    return {
      userId: payload.sub,
      username: payload.username,
      rol: payload.rol,
    };
  }
}
