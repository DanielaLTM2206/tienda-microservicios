import { Observable, throwError, timer } from 'rxjs';
import { timeout, catchError, retry } from 'rxjs/operators';
import { Logger } from '@nestjs/common';

/**
 * Configuración de la política de resiliencia para llamadas síncronas.
 *
 * Actividad F — Examen Final (jeffrey2206).
 *
 * Valores justificados con la medición del Avance 1:
 *   - El p95 de GET /api/pedidos era ~420 ms con svc-productos sano.
 *   - Se elige TIMEOUT_MS = 3000 ms: 7× el p95 → margen real ante carga,
 *     pero muy por debajo de los 30 s que un cliente HTTP esperaría.
 *   - 2 reintentos con backoff 100 ms → 300 ms cubre fallos transitorios
 *     (reconexión TCP, arranque lento del contenedor) sin amplificar una
 *     caída real: tiempo máximo de espera = 3000 + 100 + 3000 + 300 + 3000 = 9400 ms.
 *
 * Principio SRP: la política de resiliencia está aislada del servicio de negocio.
 */
export const RESILIENCE_CONFIG = {
  /** Tiempo máximo de espera por respuesta de svc-productos (ms). */
  TIMEOUT_MS: 3000,
  /** Número de reintentos tras fallo antes de propagar el error. */
  MAX_RETRIES: 2,
  /** Esperas entre reintentos (ms) — backoff creciente. */
  RETRY_DELAYS_MS: [100, 300],
} as const;

/**
 * Aplica timeout + reintento con backoff creciente a un Observable RxJS.
 *
 * Patrón: Pipe de operadores (SOLID OCP): la llamada existente no se modifica,
 * solo se "envuelve" añadiendo operadores al pipeline.
 *
 * @param source$ Observable original (llamada al microservicio)
 * @param logger  Logger de NestJS del servicio que llama
 * @param contexto Etiqueta para el log (p.ej. 'get_productos')
 * @returns Observable con timeout + retry + backoff aplicados
 */
export function withRetry<T>(
  source$: Observable<T>,
  logger: Logger,
  contexto: string,
): Observable<T> {
  let intento = 0;

  return source$.pipe(
    timeout(RESILIENCE_CONFIG.TIMEOUT_MS),
    retry({
      count: RESILIENCE_CONFIG.MAX_RETRIES,
      delay: (error, retryIndex) => {
        // retryIndex está basado en 1 (primer reintento = 1)
        const delayMs =
          RESILIENCE_CONFIG.RETRY_DELAYS_MS[retryIndex - 1] ??
          RESILIENCE_CONFIG.RETRY_DELAYS_MS[
            RESILIENCE_CONFIG.RETRY_DELAYS_MS.length - 1
          ];

        intento = retryIndex;
        logger.warn(
          `[Resiliencia] ${contexto}: reintento ${retryIndex}/${RESILIENCE_CONFIG.MAX_RETRIES} ` +
            `en ${delayMs} ms — error: ${error?.message ?? error}`,
        );

        // timer(delayMs) emite después de delayMs ms → backoff creciente
        return timer(delayMs);
      },
    }),
    catchError((err) => {
      const descripcion =
        err?.name === 'TimeoutError'
          ? `timeout (>${RESILIENCE_CONFIG.TIMEOUT_MS} ms)`
          : err?.message ?? String(err);

      logger.error(
        `[Resiliencia] ${contexto}: agotados ${RESILIENCE_CONFIG.MAX_RETRIES} reintentos ` +
          `(${intento} ejecutados). Último error: ${descripcion}`,
      );

      // Re-lanzar el error original para que el caller lo gestione con su política
      return throwError(() => err);
    }),
  );
}
