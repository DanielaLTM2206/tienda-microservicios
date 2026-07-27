# Antes — llamada a svc-productos SIN resiliencia (timeout fijo, sin reintento)

## Estado del código previo a la actividad F

### Fragmento original en `apps/pedidos/src/pedidos/pedidos.service.ts` (líneas 121-133)

```typescript
const productos: any[] = await firstValueFrom(
  this.productosTcpClient
    .send({ cmd: 'get_productos' }, {})
    .pipe(
      timeout(4000),            // timeout fijo, sin backoff
      catchError((err) => {
        this.logger.error(`Error consultando svc-productos: ${err?.message}`);
        throw new RpcException(this.errorProductos(err));
        // NO hay reintento: el primer error se propaga directamente
      }),
    ),
);
```

### Comportamiento previo (simulación con svc-productos caído)

Con svc-productos detenido, el Gateway respondía así:

```
GET /api/pedidos  →  espera 4000 ms (timeout fijo)  →  503 SERVICE_UNAVAILABLE

Sin reintentos: el primer error de conexión se propaga inmediatamente.
Tiempo total de espera del cliente: 4000 ms exactos (o 5000 ms si el timeout
llegaba desde el Gateway, no desde svc-pedidos).

No hay log de reintento. No hay backoff. La primera falla es la última.
```

### Medición de latencia base (Avance 1 — referencia para justificar timeout)

Extraído del README del grupo (tabla de medición del Avance 1):

| Ruta          | p50     | p95     | Máx     |
|---------------|---------|---------|---------|
| GET /api/pedidos/ping (1 salto TCP) | ~12 ms | ~28 ms | ~95 ms |
| GET /api/pedidos (2 saltos + BD)    | ~185 ms | ~420 ms | ~980 ms |

**Conclusión para el timeout:** el p95 con svc-productos sano es ~420 ms.
Se elige TIMEOUT_MS = 3000 ms (≈7× p95) para dar margen real ante carga
sin esperar indefinidamente. El valor de 4000 ms previo no tenía medición detrás.

### Ruta de prueba ANTES del cambio

```bash
# Detener svc-productos
docker stop tienda-microservicios-productos-1

# Llamar a la ruta dependiente
curl -s -o /dev/null -w "%{http_code} — %{time_total}s\n" \
  -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3000/api/pedidos

# Resultado esperado SIN resiliencia:
# 503 — 4.002s   (espera exactamente el timeout, sin reintentos)
```
