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
   *
   * Examen final (Actividad A): se propagan también `jti` y `exp`.
   *   - `jti` identifica la sesión y es la clave que se guarda al revocar.
   *   - `exp` permite calcular el TTL de la entrada de revocación, para que
   *     Redis la olvide justo cuando el token deja de ser válido por sí solo.
   * Sin estos dos campos en req.user, ni el logout ni el guard podrían operar.
   */
  async validate(payload: {
    sub: number;
    username: string;
    rol: string;
    jti?: string;
    exp?: number;
  }) {
    return {
      userId: payload.sub,
      username: payload.username,
      rol: payload.rol,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}
