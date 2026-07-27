import { Controller, Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { TokenRevocationService } from './token-revocation.service';

/**
 * AuthController — Avance 3, Criterio C1.
 *
 * Expone el único endpoint público de autenticación:
 *   POST /api/auth/login
 *
 * El ValidationPipe global (main.ts) ya valida LoginDto antes de llegar aquí.
 * Principio SRP: solo orquesta la petición HTTP → AuthService → respuesta.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly revocacion: TokenRevocationService,
  ) {}

  /**
   * POST /api/auth/login
   *
   * Recibe { username, password }, valida credenciales y devuelve:
   *   { access_token, expires_in, usuario: { username, rol } }
   *
   * Responde 200 OK en éxito; 401 Unauthorized con mensaje claro en error.
   * @HttpCode(200) evita el 201 por defecto de NestJS en rutas POST.
   */
  // @Public() es imprescindible: sin él el JwtAuthGuard global exigiría un
  // token para pedir el token, dejando el sistema sin forma de autenticarse.
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * POST /api/auth/logout — Examen final, Actividad A.
   *
   * Cierre de sesion REAL del lado del servidor: revoca el token presentado.
   *
   * La ruta NO lleva @Public(), asi que el JwtAuthGuard global exige un token
   * valido. Eso resuelve el caso borde "logout sin token": el guard responde
   * 401 antes de llegar aqui, y un anonimo no puede revocar sesiones ajenas.
   *
   * Solo revoca el `jti` del token presentado, de modo que las demas sesiones
   * del mismo usuario (por ejemplo, otro navegador) siguen funcionando.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request) {
    const usuario = req.user as {
      username: string;
      jti: string;
      exp: number;
    };

    const { ttlSegundos } = await this.revocacion.revocar(
      usuario.jti,
      usuario.exp,
    );

    return {
      mensaje: 'Sesion cerrada. El token presentado ya no es valido.',
      jti: usuario.jti,
      revocado_por_segundos: ttlSegundos,
    };
  }
}
