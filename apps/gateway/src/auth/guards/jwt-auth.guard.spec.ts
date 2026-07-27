import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenRevocationService } from '../token-revocation.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Prueba del comportamiento NUEVO del examen (Actividad A):
 * el JwtAuthGuard rechaza un token cuyo `jti` esta en la lista de revocados
 * y acepta uno que no lo esta.
 *
 * POR QUE FALLA SIN EL CAMBIO:
 *   Antes del examen, JwtAuthGuard.canActivate solo delegaba en
 *   super.canActivate (firma y expiracion). Con la firma valida devolvia
 *   `true` SIEMPRE, sin mirar la lista de revocados. El caso
 *   "rechaza un token revocado" devolvia true en vez de lanzar 401,
 *   por lo que ese test falla contra la version anterior del guard.
 */
describe('JwtAuthGuard — revocacion de sesion (Actividad A)', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let revocacion: jest.Mocked<Pick<TokenRevocationService, 'estaRevocado'>>;
  let request: any;

  /** Prototipo del AuthGuard('jwt') de Passport, del que hereda JwtAuthGuard. */
  const passportProto = Object.getPrototypeOf(JwtAuthGuard.prototype);

  /** ExecutionContext minimo con la request que el guard va a inspeccionar. */
  const contextoFalso = (): ExecutionContext =>
    ({
      getHandler: () => function handler() {},
      getClass: () => class Controlador {},
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    revocacion = { estaRevocado: jest.fn() };
    guard = new JwtAuthGuard(
      reflector,
      revocacion as unknown as TokenRevocationService,
    );

    // Passport ya valido firma y expiracion: aisla la prueba al paso nuevo.
    jest.spyOn(passportProto, 'canActivate').mockResolvedValue(true);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    request = { user: { username: 'admin', rol: 'admin', jti: 'jti-123', exp: 9999999999 } };
  });

  afterEach(() => jest.restoreAllMocks());

  it('RECHAZA con 401 un token cuyo jti fue revocado', async () => {
    revocacion.estaRevocado.mockResolvedValue(true);

    await expect(guard.canActivate(contextoFalso())).rejects.toThrow(
      UnauthorizedException,
    );
    expect(revocacion.estaRevocado).toHaveBeenCalledWith('jti-123');
  });

  it('el mensaje del 401 distingue "revocado" de "token invalido o expirado"', async () => {
    revocacion.estaRevocado.mockResolvedValue(true);

    await expect(guard.canActivate(contextoFalso())).rejects.toThrow(
      /revocado/i,
    );
  });

  it('ACEPTA un token vigente cuyo jti NO fue revocado', async () => {
    revocacion.estaRevocado.mockResolvedValue(false);

    await expect(guard.canActivate(contextoFalso())).resolves.toBe(true);
  });

  it('NO consulta la lista en rutas marcadas con @Public()', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((clave) => (clave === IS_PUBLIC_KEY ? true : undefined));

    await expect(guard.canActivate(contextoFalso())).resolves.toBe(true);
    expect(revocacion.estaRevocado).not.toHaveBeenCalled();
  });

  it('RECHAZA un token valido pero sin claim jti (emitido antes del cambio)', async () => {
    request = { user: { username: 'admin', rol: 'admin' } };

    await expect(guard.canActivate(contextoFalso())).rejects.toThrow(
      UnauthorizedException,
    );
    expect(revocacion.estaRevocado).not.toHaveBeenCalled();
  });
});
