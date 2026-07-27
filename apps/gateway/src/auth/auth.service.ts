import { Injectable, UnauthorizedException, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import { LoginDto } from './dto/login.dto';

/**
 * Interfaz interna del usuario en memoria.
 * El campo passwordHash nunca se expone al cliente.
 */
interface Usuario {
  id: number;
  username: string;
  passwordHash: string;
  rol: 'admin' | 'cliente';
}

/** Definición de credenciales de seed (texto plano solo en arranque, nunca sale de aquí). */
const SEED_USUARIOS = [
  { id: 1, username: 'admin',   password: 'admin123',   rol: 'admin'   as const },
  { id: 2, username: 'cliente', password: 'cliente123', rol: 'cliente' as const },
];

/**
 * AuthService — Avance 3, Criterio C1.
 *
 * Implementa el patrón Strategy de autenticación:
 *   1. Hashea las contraseñas seed con bcrypt en el arranque (onModuleInit)
 *   2. Valida credenciales contra el store en memoria
 *   3. Emite un JWT firmado con la clave del entorno
 *
 * Principio SRP: solo se ocupa de autenticación; la autorización
 * (Guards, decoradores @Public/@Roles) la gestionan los compañeros.
 */
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  /** Store inicializado en onModuleInit tras hashear las contraseñas. */
  private usuarios: Usuario[] = [];

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Hashea las contraseñas seed con bcrypt (salt 10) una sola vez al arrancar.
   * De esta forma las contraseñas en texto plano no persisten en memoria.
   */
  async onModuleInit(): Promise<void> {
    const SALT_ROUNDS = 10;
    this.usuarios = await Promise.all(
      SEED_USUARIOS.map(async (u) => ({
        id: u.id,
        username: u.username,
        passwordHash: await bcrypt.hash(u.password, SALT_ROUNDS),
        rol: u.rol,
      })),
    );
    this.logger.log('Usuarios en memoria inicializados con bcrypt');
  }

  /**
   * Valida las credenciales y devuelve el token JWT + metadatos.
   * Lanza UnauthorizedException (HTTP 401) si las credenciales son incorrectas.
   *
   * El mensaje de error es uniforme para evitar enumeración de usuarios.
   */
  async login(dto: LoginDto): Promise<{
    access_token: string;
    expires_in: string;
    usuario: { username: string; rol: string };
  }> {
    const usuario = this.usuarios.find((u) => u.username === dto.username);

    // bcrypt.compare devuelve false (no lanza) si el hash no coincide
    const passwordValida =
      usuario != null && (await bcrypt.compare(dto.password, usuario.passwordHash));

    if (!passwordValida) {
      this.logger.warn(`Intento de login fallido para username: "${dto.username}"`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const expiresIn = process.env.JWT_EXPIRES_IN ?? '1h';

    const payload = {
      sub: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
    };

    const access_token = await this.jwtService.signAsync(payload, {
      expiresIn: expiresIn as StringValue,
    });

    this.logger.log(`Login exitoso → username: "${usuario.username}", rol: "${usuario.rol}"`);

    return {
      access_token,
      expires_in: expiresIn,
      usuario: { username: usuario.username, rol: usuario.rol },
    };
  }
}
