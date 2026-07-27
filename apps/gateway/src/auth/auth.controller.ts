import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

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
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login
   *
   * Recibe { username, password }, valida credenciales y devuelve:
   *   { access_token, expires_in, usuario: { username, rol } }
   *
   * Responde 200 OK en éxito; 401 Unauthorized con mensaje claro en error.
   * @HttpCode(200) evita el 201 por defecto de NestJS en rutas POST.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
