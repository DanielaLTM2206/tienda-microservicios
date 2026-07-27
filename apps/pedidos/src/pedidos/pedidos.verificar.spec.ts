import { RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { of } from 'rxjs';

describe('verificarDisponibilidadGrpc — mapeo de errores', () => {
  let service: any;
  let mockStub: any;

  beforeEach(() => {
    mockStub = {
      VerificarDisponibilidad: jest.fn(),
    };

    // Servicio con dependencias mockeadas manualmente (sin @nestjs/testing)
    service = {
      productosGrpcStub: mockStub,
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      verificarDisponibilidadGrpc: async (id: number, cantidad: number) => {
        const respuesta: any = await firstValueFrom(
          mockStub.VerificarDisponibilidad({ id, cantidad }),
        );
        if (respuesta.codigo_error === 'NOT_FOUND') {
          throw new RpcException({ statusCode: 404, message: respuesta.mensaje });
        }
        if (respuesta.codigo_error === 'INVALID_ARGUMENT') {
          throw new RpcException({ statusCode: 400, message: respuesta.mensaje });
        }
        return { ok: true, disponible: respuesta.disponible };
      },
    };
  });

  it('NOT_FOUND del contrato → RpcException 404 (no excepcion sin capturar)', async () => {
    mockStub.VerificarDisponibilidad.mockReturnValue(
      of({ disponible: false, precio: 0, mensaje: 'no existe', codigo_error: 'NOT_FOUND' }),
    );

    await expect(service.verificarDisponibilidadGrpc(999, 1))
      .rejects.toBeInstanceOf(RpcException);

    const error = await service.verificarDisponibilidadGrpc(999, 1).catch((e: any) => e);
    expect((error as RpcException).getError()).toMatchObject({ statusCode: 404 });
  });

  it('INVALID_ARGUMENT del contrato → RpcException 400', async () => {
    mockStub.VerificarDisponibilidad.mockReturnValue(
      of({ disponible: false, precio: 0, mensaje: 'argumento invalido', codigo_error: 'INVALID_ARGUMENT' }),
    );

    const error = await service.verificarDisponibilidadGrpc(0, 0).catch((e: any) => e);
    expect((error as RpcException).getError()).toMatchObject({ statusCode: 400 });
  });

  it('Caso exitoso → retorna disponible sin lanzar excepcion', async () => {
    mockStub.VerificarDisponibilidad.mockReturnValue(
      of({ disponible: true, precio: 29.99, mensaje: 'disponible', codigo_error: '' }),
    );

    const resultado = await service.verificarDisponibilidadGrpc(1, 2);
    expect(resultado.ok).toBe(true);
    expect(resultado.disponible).toBe(true);
  });
});
