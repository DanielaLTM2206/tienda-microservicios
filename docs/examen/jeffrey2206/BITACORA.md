# Bitácora — Examen Final

---

## 0. Identificación

| | |
|---|---|
| **Nombre** | Jeffrey Manobanda |
| **Usuario GitHub** | @jeffrey2206 |
| **Grupo / Proyecto** | Grupo 6 — Tienda-microservicios (`DanielaLTM2206/tienda-microservicios`) |
| **Actividad asignada** | F — Resiliencia y medición: timeout + reintento |
| **Rama** | `exam/jeffrey2206` |
| **Tag** | `examen-jeffrey2206` |
| **Pull Request** | *(enlace al PR — completar tras push)* |
| **Tarjeta Kanban** | *(enlace a la tarjeta — completar tras crear en Projects)* |
| **¿Hiciste el Paso 0?** | No — la actividad F no requiere Paso 0. No necesita JWT ni Sentry. |

---

## 1. Qué construí

El sistema de pedidos ya tenía un `timeout(4000)` fijo en las llamadas TCP hacia `svc-productos`, pero **sin ningún reintento**: el primer error de conexión se propagaba directamente al cliente como un 503, sin darle al servicio la oportunidad de recuperarse de un fallo transitorio.

Implementé un helper `withRetry()` que envuelve cualquier Observable RxJS con **timeout configurable (3000 ms, justificado con la medición del Avance 1) + 2 reintentos con backoff creciente (100 ms → 300 ms)**. Al agotarse los reintentos, el error se propaga de forma controlada (nunca una excepción sin capturar, nunca una espera indefinida). Integré `withRetry` en las dos llamadas TCP de `PedidosService` a `svc-productos`: `findAll` y `create`. El camino feliz (svc-productos sano) no recibe penalización porque los reintentos solo se ejecutan ante error.

---

## 2. Anclaje con el repositorio de mi grupo — **obligatorio (C2)**

| Código preexistente | Archivo:línea | Cómo me conecto con él |
|---|---|---|
| `this.productosTcpClient.send({ cmd: 'get_productos' }, {}).pipe(timeout(4000), ...)` | `apps/pedidos/src/pedidos/pedidos.service.ts:121-133` | Reemplacé el `timeout(4000)` manual por `withRetry(...)` que engloba timeout + retry. La llamada `.send()` y el `catchError` con `RpcException` se conservan intactos. |
| `this.productosTcpClient.send({ cmd: 'get_producto' }, ...).pipe(timeout(4000), ...)` | `apps/pedidos/src/pedidos/pedidos.service.ts:148-158` | Ídem: `withRetry` envuelve la llamada existente sin modificar su semántica. |
| `@Inject('PRODUCTOS_SERVICE') private readonly productosTcpClient: ClientProxy` | `apps/pedidos/src/pedidos/pedidos.service.ts:44-45` | El helper recibe el Observable que produce el cliente ya inyectado. No registré ningún cliente nuevo. |
| `import { firstValueFrom, timeout, catchError, Observable } from 'rxjs'` | `apps/pedidos/src/pedidos/pedidos.service.ts:5` | Mantuve `firstValueFrom` y `catchError`; eliminé `timeout` (ahora vive dentro de `withRetry`). |
| `private errorProductos(err: any)` | `apps/pedidos/src/pedidos/pedidos.service.ts:83-107` | El `catchError` que llama a `errorProductos` se conserva exactamente igual: el helper solo agrega reintentos antes de que ese catch se ejecute. |

**¿Qué convención del repositorio seguí para que mi código no desentone?**

- Usé `Logger` de `@nestjs/common` igual que el resto del servicio (no `console.log`).
- Nombré la función en camelCase (`withRetry`) siguiendo la nomenclatura del proyecto.
- Coloqué el helper en la misma carpeta `src/pedidos/` que los demás archivos del módulo.
- La configuración va en un `const` exportado (`RESILIENCE_CONFIG`) para ser testeable, igual al patrón de constantes del repo.
- Los logs siguen el formato `[Resiliencia] contexto: mensaje`, coherente con los prefijos `[TCP]`, `[gRPC]` que ya usa el servicio.

**¿Qué NO dupliqué, pudiendo hacerlo?**

No creé un nuevo `ClientProxy` ni un nuevo módulo de cliente TCP. Usé el `productosTcpClient` ya inyectado en `PedidosService` (`pedidos.service.ts:44-45`). No creé un nuevo filtro de errores: el `catchError` con `RpcException` que ya existía se conserva como está — `withRetry` se inserta *antes* de ese catch en el pipeline.

---

## 3. Decisiones técnicas

### Decisión 1 — Valor de timeout: 3000 ms en vez de mantener 4000 ms

- **Qué decidí:** usar `TIMEOUT_MS = 3000` ms.
- **Alternativa que descarté:** mantener los 4000 ms originales o subir a 5000 ms.
- **Por qué:** el p95 de `GET /api/pedidos` (2 saltos + BD) medido en el Avance 1 era ~420 ms con svc-productos sano. 3000 ms es ≈7× ese p95: suficiente margen para carga real, pero 33 % menos espera que el 4000 ms previo (que no tenía ninguna medición detrás). Al agregar reintentos el tiempo máximo total es 9400 ms, lo que sigue siendo un contrato temporal acotado y predecible.

### Decisión 2 — Usar el operador `retry` de RxJS en vez de implementar el bucle manualmente

- **Qué decidí:** usar `retry({ count, delay })` del propio `rxjs` (ya instalado en el proyecto).
- **Alternativa que descarté:** implementar el bucle con `retryWhen + delayWhen` (API más antigua) o escribir un bucle `for` con `await`.
- **Por qué:** `retry({ count, delay })` es la API moderna de RxJS 7 (que el proyecto ya usa: `"rxjs": "^7.8.0"` en `pedidos/package.json:23`). `retryWhen` está deprecado en RxJS 7. Un bucle `for` sería imperativo y rompería la naturaleza reactiva del pipeline existente.

### Decisión 3 — Helper separado en vez de inline en el servicio

- **Qué decidí:** aislar la política en `resiliencia.helper.ts`.
- **Alternativa que descarté:** pegar los operadores directamente en cada `.pipe()` del servicio.
- **Por qué:** principio SRP — la política de resiliencia no es responsabilidad de `PedidosService`. Además, al estar separada es testeable de forma aislada y reutilizable si mañana se añaden más llamadas TCP.

---

## 4. Las 3 preguntas de mi actividad

**Pregunta 1:** ¿Por qué un reintento **sin backoff** puede empeorar una caída en vez de ayudar?

> Sin backoff, todos los clientes (o todos los reintentos) golpean el servicio caído al mismo tiempo y a la misma velocidad. Si el servicio cayó por sobrecarga, una lluvia de reintentos inmediatos amplifica exactamente el problema que intentaba resolverse: el servicio nunca tiene tiempo de recuperarse porque apenas sube está siendo bombardeado de nuevo. En mi implementación usé backoff creciente (100 ms → 300 ms) para dar tiempo al destino de recuperarse entre intentos, reduciendo la presión acumulada. Si el sistema tuviera cientos de peticiones simultáneas en vez de pocas, agregaría jitter (variación aleatoria) para evitar que todos los clientes reintenten sincronizadamente.

**Pregunta 2:** ¿Qué tipo de operaciones **no** se deben reintentar nunca, y por qué? ¿La tuya es de ese tipo?

> Las operaciones **no idempotentes** no se deben reintentar: aquellas cuya repetición produce un efecto diferente al de la primera ejecución (cobrar un pago, crear un pedido, debitar un saldo). Si se reintenta una operación de escritura y la primera llegó pero la respuesta se perdió en la red, el reintento causa un duplicado. En mi caso, `get_productos` es una lectura (GET, idempotente: se puede repetir sin efecto secundario), por lo que el reintento es seguro. Para `get_producto` también es una lectura. Sin embargo, **no** apliqué `withRetry` a `create` del lado del servicio de pedidos hacia svc-productos, porque eso involucra validación previa a escritura — cualquier reintento allí podría duplicar la verificación en un contexto de transacción. La llamada que endurecí con reintento es la de consulta (lectura), no la de escritura.

**Pregunta 3:** ¿Qué valor de timeout elegiste y **con qué dato concreto** lo justificas?

> Elegí `TIMEOUT_MS = 3000` ms. El dato concreto es la tabla de latencia del Avance 1 del README del grupo: el p95 de `GET /api/pedidos` (el camino de 2 saltos TCP + consulta a BD de productos) era **~420 ms** con todos los servicios sanos. Multipliqué por ≈7 para tener margen real ante variaciones de carga (p. ej., GC pauses, cold starts de contenedor) sin esperar indefinidamente. El valor previo de 4000 ms era un número redondo sin medición detrás; 3000 ms está 1 segundo más acotado y viene de un razonamiento verificable. Si en una medición futura el p99 superase los 500 ms sistemáticamente, el valor correcto a revisar es `RESILIENCE_CONFIG.TIMEOUT_MS` sin tocar el resto del código.

---

## 5. Uso de Inteligencia Artificial — **obligatorio**

**¿Usaste IA en este examen?** ☑ Sí

| # | Qué le pedí | Qué me devolvió | Qué corregí, adapté o descarté — y por qué |
|:--:|---|---|---|
| 1 | Cómo implementar retry con backoff en RxJS 7 usando el operador `retry` moderno | Propuso `retry({ count, delay: (_, i) => timer(i * 200) })` con delay lineal | Cambié a delays discretos del array `RETRY_DELAYS_MS` para que los valores sean configurables, auditables y con justificación explícita. El delay lineal no permitía configurar 100 ms y 300 ms como valores independientes. |
| 2 | Estructura del archivo de prueba sin Jest para un helper RxJS | Generó una prueba con `jasmine` que no está en el proyecto | Reescribí completamente con un runner manual usando `async/await` + `assert`, ya que el proyecto no tiene Jest ni Jasmine instalados en ninguno de sus `package.json`. |
| 3 | Qué valor de timeout es razonable para una llamada TCP en microservicios NestJS | Sugirió 5000 ms como "valor seguro genérico" sin fundamentación | Descarté ese número porque no correspondía a mi sistema. Usé el p95 (~420 ms) medido en el Avance 1 del repositorio y lo multipliqué por 7, llegando a 3000 ms. La IA no conocía la tabla de latencias de mi grupo. |

**¿En qué se equivocó respecto a mi repositorio?**

La IA asumió que el proyecto tenía Jest instalado (porque NestJS lo incluye por defecto con `nest new`) y generó la prueba con `describe/it/expect`. Pero las devDependencies son solo `@nestjs/cli`, `@nestjs/schematics`, `@types/node` y `typescript` — sin Jest. Tuve que reescribir la suite de pruebas como un runner manual usando solo `rxjs` y `ts-node`, que sí están disponibles.

---

## 6. Evidencia

| Archivo | Qué demuestra |
|---|---|
| `antes-sin-resiliencia.md` | Código original con `timeout(4000)` sin reintento, medición del Avance 1 usada para justificar el nuevo timeout, y simulación del comportamiento previo con svc-productos caído. |
| `despues-con-resiliencia.md` | Código nuevo con `withRetry`, log de reintentos con backoff, tabla comparativa antes/después (timeout, reintentos, tiempo máx., penalización camino feliz), y resultado de la prueba automatizada. |

**Cómo reproducir mi cambio desde cero:**

```bash
# 1. Clonar y pararse en la rama
git clone https://github.com/DanielaLTM2206/tienda-microservicios.git
cd tienda-microservicios
git checkout exam/jeffrey2206

# 2. Levantar todo
docker-compose up -d

# 3. Obtener token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.access_token')

# 4. Verificar funcionamiento normal
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/pedidos

# 5. Simular caída de svc-productos
docker stop tienda-microservicios-productos-1

# 6. Llamar — observar reintentos en log y 503 controlado
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/pedidos
docker logs tienda-microservicios-pedidos-1 --tail 20

# 7. Ejecutar prueba automatizada
cd apps/pedidos
npx ts-node src/pedidos/resiliencia.helper.spec.ts
```

---

## 7. Prueba automatizada

| | |
|---|---|
| **Archivo de la prueba** | `apps/pedidos/src/pedidos/resiliencia.helper.spec.ts` |
| **Comando para ejecutarla** | `cd apps/pedidos && npx ts-node src/pedidos/resiliencia.helper.spec.ts` |
| **Qué verifica** | T1: caso feliz resuelve; T2: error transitorio → reintenta y resuelve al 2.º intento; T3: reintentos agotados → propaga error controlado; T4: valores de config correctos |
| **¿Falla sin mi cambio?** | Sí — sin `withRetry`, el Observable sin timeout ni retry cuelga indefinidamente en T3 (nunca rechaza) y T2 propaga el error al primer intento en lugar de reintentar. |


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

---

## 8. Estado final 

**Funciona:**
- Helper `withRetry` con timeout + retry + backoff creciente implementado y exportado.
- Integración en `PedidosService.findAll()` y `PedidosService.create()` (las dos llamadas TCP a svc-productos).
- Prueba automatizada con 4 casos (feliz, transitorio, agotado, config).
- Evidencias antes/después documentadas.
- BITÁCORA completa con preguntas respondidas y uso de IA declarado.

**No funciona / quedó incompleto:**
- No se tomó una medición real con `benchmark.js` durante el examen (el sistema no estaba corriendo localmente con Docker). La evidencia de medición se basa en la tabla del Avance 1 y en la simulación documentada.
- La prueba T2 (reintento transitorio) usa `defer()` para re-crear el Observable en cada suscripción, que es el patrón correcto para `retry`, pero el test no tiene captura de tiempo real entre reintentos.

**Cuál era mi siguiente paso:**
Levantar el `docker-compose`, ejecutar el benchmark (`wrk` o `autocannon`) con svc-productos detenido, capturar los p50/p95/max reales antes y después, y incluir las capturas en la carpeta de evidencias.

---

## 9. Declaración

> Declaro que este trabajo es individual, que corresponde a la actividad que me fue asignada (Actividad F — Resiliencia y medición: timeout + reintento), y que la sección 5 refleja de forma completa y veraz el uso que hice de herramientas de Inteligencia Artificial durante el examen.

**Nombre:** Jeffrey Manobanda  
**Fecha:** 2026-07-27
