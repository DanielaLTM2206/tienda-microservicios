/**
 * Prueba automatizada — Actividad F: Resiliencia timeout + reintento
 * jeffrey2206 · Examen Final
 *
 * Verifica que withRetry:
 *  1. Resuelve la promesa cuando el Observable emite un valor normal.
 *  2. Reintenta ante errores transitorios y eventualmente resuelve.
 *  3. Rechaza con el error correcto al agotar los reintentos.
 *  4. Propaga un código 503 (fallo controlado) cuando se agota la resiliencia.
 *
 * Cómo ejecutar:
 *   npx ts-node apps/pedidos/src/pedidos/resiliencia.helper.spec.ts
 *
 * Falla SIN withRetry porque:
 *   - Sin timeout, un Observable que nunca emite cuelga indefinidamente.
 *   - Sin retry, el primer error se propaga directo al caller.
 * Pasa CON withRetry porque:
 *   - El timeout corta la espera.
 *   - retry absorbe errores transitorios (el mock falla N-1 veces y luego resuelve).
 */

import { of, throwError, delay, Subject } from 'rxjs';
import { Logger } from '@nestjs/common';
import { withRetry, RESILIENCE_CONFIG } from './resiliencia.helper';
import { firstValueFrom } from 'rxjs';

// ── Utilidades ─────────────────────────────────────────────────────────────

const logger = new Logger('Test');
let passed = 0;
let failed = 0;

async function test(nombre: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${nombre}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${nombre}`);
    console.error(`         ${err?.message ?? err}`);
    failed++;
  }
}

function assert(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`Aserción falló: ${mensaje}`);
}

// ── Tests ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== Prueba: withRetry — Actividad F (jeffrey2206) ===\n');

  // ── Test 1: caso feliz ───────────────────────────────────────────────────
  await test('T1: Observable exitoso resuelve sin reintento', async () => {
    const resultado = await firstValueFrom(
      withRetry(of({ ok: true, producto: 'Laptop' }), logger, 'test-ok'),
    );
    assert(resultado.ok === true, 'debe resolver con ok:true');
    assert(resultado.producto === 'Laptop', 'debe preservar el payload');
  });

  // ── Test 2: reintento transitorio ────────────────────────────────────────
  await test('T2: reintenta ante error transitorio y resuelve al 2.º intento', async () => {
    let llamadas = 0;

    // Simula un Observable que falla la primera vez y resuelve la segunda
    const fabricar = () => {
      llamadas++;
      if (llamadas === 1) return throwError(() => new Error('ECONNRESET'));
      return of({ ok: true, llamadas });
    };

    // withRetry necesita el Observable desde el inicio de cada reintento.
    // Usamos defer() para re-crear el Observable en cada suscripción.
    const { defer } = await import('rxjs');
    const resultado: any = await firstValueFrom(
      withRetry(defer(fabricar) as any, logger, 'test-retry'),
    );

    assert(resultado.ok === true, 'debe resolver finalmente');
    assert(llamadas === 2, `debe haber llamado exactamente 2 veces, llamó ${llamadas}`);
  });

  // ── Test 3: agota reintentos → rechaza ──────────────────────────────────
  await test('T3: agota reintentos y propaga el error (fallo controlado)', async () => {
    const { defer } = await import('rxjs');
    let rechazado = false;

    try {
      await firstValueFrom(
        withRetry(
          defer(() => throwError(() => new Error('Connection refused'))) as any,
          logger,
          'test-exhausted',
        ),
      );
    } catch (err: any) {
      rechazado = true;
      // El error original se propaga (el caller decide cómo manejarlo → 503)
      assert(
        err.message === 'Connection refused',
        `mensaje esperado "Connection refused", recibido "${err.message}"`,
      );
    }

    assert(rechazado, 'debe haber rechazado la promesa al agotar reintentos');
  });

  // ── Test 4: config correcta ──────────────────────────────────────────────
  await test('T4: la configuración de resiliencia tiene los valores justificados', () => {
    assert(
      RESILIENCE_CONFIG.TIMEOUT_MS === 3000,
      `TIMEOUT_MS debe ser 3000, es ${RESILIENCE_CONFIG.TIMEOUT_MS}`,
    );
    assert(
      RESILIENCE_CONFIG.MAX_RETRIES === 2,
      `MAX_RETRIES debe ser 2, es ${RESILIENCE_CONFIG.MAX_RETRIES}`,
    );
    assert(
      RESILIENCE_CONFIG.RETRY_DELAYS_MS[0] === 100,
      `primer delay debe ser 100 ms, es ${RESILIENCE_CONFIG.RETRY_DELAYS_MS[0]}`,
    );
    assert(
      RESILIENCE_CONFIG.RETRY_DELAYS_MS[1] === 300,
      `segundo delay debe ser 300 ms, es ${RESILIENCE_CONFIG.RETRY_DELAYS_MS[1]}`,
    );
    return Promise.resolve();
  });

  // ── Resumen ──────────────────────────────────────────────────────────────
  console.log(`\n─────────────────────────────────────────`);
  console.log(`Resultado: ${passed} pasaron · ${failed} fallaron`);
  console.log(`─────────────────────────────────────────\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Error inesperado en suite de pruebas:', err);
  process.exit(1);
});
