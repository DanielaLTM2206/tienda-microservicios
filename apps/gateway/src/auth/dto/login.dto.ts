import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO para POST /api/auth/login.
 * class-validator garantiza que ambos campos sean strings no vacíos
 * antes de llegar al servicio (ValidationPipe global en main.ts).
 */
export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'El username no puede estar vacío' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña no puede estar vacía' })
  password: string;
}
