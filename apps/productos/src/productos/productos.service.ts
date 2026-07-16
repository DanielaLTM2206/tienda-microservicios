import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Producto } from './producto.entity';

/**
 * Servicio de Productos.
 * Principio SRP: gestiona únicamente operaciones CRUD de productos.
 * Principio OCP: fácilmente extensible para agregar nuevas operaciones sin modificar las existentes.
 * Implementa OnModuleInit para sembrar datos de prueba (seed) al arrancar.
 */
@Injectable()
export class ProductosService implements OnModuleInit {
  private readonly logger = new Logger(ProductosService.name);

  constructor(
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
  ) {}

  /** Sembrar productos de prueba si la tabla está vacía */
  async onModuleInit() {
    const count = await this.productoRepo.count();
    if (count === 0) {
      const seeds = [
        { nombre: 'Laptop Pro', precio: 1299.99, disponible: true },
        { nombre: 'Mouse Inalámbrico', precio: 29.99, disponible: true },
        { nombre: 'Teclado Mecánico', precio: 89.99, disponible: true },
        { nombre: 'Monitor 4K', precio: 449.99, disponible: false },
      ];
      await this.productoRepo.save(seeds);
      this.logger.log('Datos de prueba sembrados en productos');
    }
  }

  /** Retorna todos los productos — llamado en el segundo salto TCP desde svc-pedidos */
  async findAll(): Promise<Producto[]> {
    this.logger.log('Consultando todos los productos desde PostgreSQL');
    // Simular ligera latencia de DB para que sea medible
    return this.productoRepo.find();
  }

  /** Retorna un producto por ID */
  async findOne(id: number): Promise<Producto | null> {
    this.logger.log(`Consultando producto id=${id}`);
    try {
      return await this.productoRepo.findOneBy({ id });
    } catch (err) {
      // Manejo de excepción en capa de servicio — no tumba el microservicio
      this.logger.error(`Error buscando producto ${id}: ${err.message}`);
      return null;
    }
  }
}
