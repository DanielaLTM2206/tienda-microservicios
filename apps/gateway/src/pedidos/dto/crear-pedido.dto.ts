import { IsInt, IsPositive } from 'class-validator';

/**
 * DTO para POST /api/pedidos.
 * Valida que productoId y cantidad sean enteros positivos
 * antes de reenviar la petición al microservicio.
 */
export class CrearPedidoDto {
  @IsInt({ message: 'productoId debe ser un número entero' })
  @IsPositive({ message: 'productoId debe ser un entero positivo' })
  productoId: number;

  @IsInt({ message: 'cantidad debe ser un número entero' })
  @IsPositive({ message: 'cantidad debe ser un entero positivo' })
  cantidad: number;
}
