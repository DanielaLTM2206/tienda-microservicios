import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Entidad Producto.
 * Principio SRP: describe únicamente la estructura de un producto.
 */
@Entity('productos')
export class Producto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column('decimal', { precision: 10, scale: 2 })
  precio: number;

  @Column({ default: true })
  disponible: boolean;
}
