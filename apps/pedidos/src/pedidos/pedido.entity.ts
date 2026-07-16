import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Entidad Pedido — TypeORM mapea esta clase a la tabla "pedidos" en PostgreSQL.
 * Principio SRP: solo describe la estructura de datos de un pedido.
 */
@Entity('pedidos')
export class Pedido {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  productoId: number;

  @Column()
  cantidad: number;

  @Column({ default: 'pendiente' })
  estado: string;

  @CreateDateColumn()
  creadoEn: Date;
}
