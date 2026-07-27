# Después — llamada a svc-productos CON resiliencia (timeout + reintento + backoff)

## Estado del código DESPUÉS de la actividad F

### Nuevo helper: `apps/pedidos/src/pedidos/resiliencia.helper.ts`

```typescript
export const RESILIENCE_CONFIG = {
  TIMEOUT_MS: 3000,          // 7× el p95 medido (420 ms)
  MAX_RETRIES: 2,             // 2 reintentos ante fallos transitorios
  RETRY_DELAYS_MS: [100, 300], // backoff creciente: 100 ms → 300 ms
} as const;

export function withRetry<T>(
  source$: Observable<T>,
  logger: Logger,
  contexto: string,
): Observable<T> { ... }
```

### Integración en `pedidos.service.ts` (fragmento)

```typescript
const productos: any[] = await firstValueFrom(
  withRetry(
    this.productosTcpClient.send({ cmd: 'get_productos' }, {}),
    this.logger,
    'get_productos',
  ).pipe(
    catchError((err) => {
      this.logger.error(`Error consultando svc-productos: ${err?.message}`);
      throw new RpcException(this.errorProductos(err));
    }),
  ),
);
```

## Comportamiento DESPUÉS (con svc-productos caído)

```
GET /api/pedidos  →  intento 1 (timeout 3000ms) → falla
                  →  espera 100 ms (backoff)
                  →  intento 2 (timeout 3000ms) → falla
                  →  espera 300 ms (backoff)
                  →  intento 3 = MAX_RETRIES+1 agotado
                  →  503 SERVICE_UNAVAILABLE (controlado, nunca cuelga)

Tiempo máximo total: 3000 + 100 + 3000 + 300 + 3000 = 9400 ms
(vs. 4000 ms previos — el trade-off es mayor resiliencia ante fallos transitorios)
```

## Log real del servicio (simulado)

```
[PedidosService] [TCP] Consultando pedidos y productos...
[Resiliencia] get_productos: reintento 1/2 en 100 ms — error: Connection refused
[Resiliencia] get_productos: reintento 2/2 en 300 ms — error: Connection refused
[Resiliencia] get_productos: agotados 2 reintentos (2 ejecutados). Último error: Connection refused
[PedidosService] Error consultando svc-productos: Connection refused
→ HTTP 503: {"statusCode":503,"message":"svc-productos no responde (timeout) - acoplamiento temporal"}
```

## Comportamiento con svc-productos sano (camino feliz — NO empeora)

```
GET /api/pedidos  →  intento 1 (resuelto en ~185 ms)  →  200 OK
Sin reintentos = sin penalización en el camino feliz.
```

## Resultado de la prueba automatizada

```
=== Prueba: withRetry — Actividad F (jeffrey2206) ===

  ✅ PASS: T1: Observable exitoso resuelve sin reintento
  ✅ PASS: T2: reintenta ante error transitorio y resuelve al 2.º intento
  ✅ PASS: T3: agota reintentos y propaga el error (fallo controlado)
  ✅ PASS: T4: la configuración de resiliencia tiene los valores justificados

─────────────────────────────────────────
Resultado: 4 pasaron · 0 fallaron
─────────────────────────────────────────
```

## Tabla comparativa antes / después

| Métrica                        | ANTES (sin resiliencia) | DESPUÉS (con resiliencia) |
|-------------------------------|------------------------|--------------------------|
| Timeout por intento            | 4000 ms fijos          | 3000 ms (justificado)    |
| Reintentos ante falla          | 0                      | 2 con backoff            |
| Backoff entre reintentos       | —                      | 100 ms → 300 ms          |
| Tiempo máx. con destino caído  | 4000 ms                | 9400 ms (acotado)        |
| Respuesta al agotarse          | 503 (sin log)          | 503 + log detallado      |
| Fallos transitorios absorbidos | No                     | Sí (1 de 2 reintentos)   |
| Penalización camino feliz      | —                      | ~0 ms (no hay reintento) |

## Cómo reproducir

```bash
# 1. Levantar el sistema
docker-compose up -d

# 2. Obtener token de autenticación
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.access_token')

# 3. Verificar funcionamiento normal (ANTES de simular caída)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/pedidos

# 4. Simular caída de svc-productos
docker stop tienda-microservicios-productos-1

# 5. Llamar y observar los reintentos en el log de svc-pedidos
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/pedidos
# Esperar ~9400 ms → respuesta 503 con mensaje controlado

# 6. Ver logs de svc-pedidos con reintentos
docker logs tienda-microservicios-pedidos-1 --tail 20

# 7. Ejecutar la prueba automatizada
cd apps/pedidos
npx ts-node src/pedidos/resiliencia.helper.spec.ts
```
