# Bitácora — Examen Final

---

## 0. Identificación

| | |
|---|---|
| **Nombre** | Daniela Tituaña |
| **Usuario GitHub** | @DanielaLTM2206 |
| **Grupo / Proyecto** | Grupo 6 — Tienda-microservicios · `DanielaLTM2206/tienda-microservicios` |
| **Actividad asignada** | B — Nuevo salto síncrono con contrato |
| **Rama** | `exam/DanielaLTM2206` |
| **Tag** | `examen-DanielaLTM2206` |
| **Pull Request** | *(pegar enlace al abrir el PR)* |
| **Tarjeta Kanban** | *(pegar enlace a la tarjeta en GitHub Projects)* |
| **¿Hiciste el Paso 0?** | No — la base gRPC ya existía en `libs/proto/productos.proto:13` y el cliente ya estaba registrado en `apps/pedidos/src/pedidos/pedidos.module.ts:33-43` |

---

## 1. Qué construí

Añadí el método `VerificarDisponibilidad` al contrato gRPC existente en `libs/proto/productos.proto`. Antes, `svc-pedidos` no podía consultar en un solo salto si un producto tenía stock y cuál era su precio actualizado; esa información estaba atrapada en `svc-productos` sin un método que la expusiera de forma tipada.

Implementé los siguientes cambios exactos:
1. **`libs/proto/productos.proto`**: Nuevo `message VerificarRequest`, `VerificarResponse` y `rpc VerificarDisponibilidad`.
2. **`apps/productos/src/productos/productos.grpc.controller.ts`**: Handler `@GrpcMethod` que devuelve `NOT_FOUND` si el producto no existe o `INVALID_ARGUMENT` si hay error en los parámetros.
3. **`apps/pedidos/src/pedidos/pedidos.service.ts`**: Nuevo método consumidor `verificarDisponibilidadGrpc` que mapea el error de gRPC al código HTTP (`RpcException` 404/400).
4. **`apps/gateway/src/pedidos/pedidos.controller.ts`**: Nuevo endpoint `GET /pedidos/verificar/:id` expuesto vía HTTP.
5. **`apps/pedidos/src/pedidos/pedidos.verificar.spec.ts`**: Prueba unitaria de 3 casos para el mapeo de errores.

---

## 2. Anclaje con el repositorio de mi grupo — **obligatorio (C2)**

| Código preexistente | Archivo:línea | Cómo me conecto con él |
|---|---|---|
| `service ProductosService { rpc ObtenerProducto... }` | `libs/proto/productos.proto:13-19` | Extendí el mismo bloque `service` con el nuevo `rpc VerificarDisponibilidad`; no creé un `.proto` paralelo |
| Registro `PRODUCTOS_GRPC_SERVICE` con `Transport.GRPC` | `apps/pedidos/src/pedidos/pedidos.module.ts:33-43` | Mi método consumidor usa el mismo cliente inyectado; no registré un cliente nuevo |
| `onModuleInit()` que obtiene el stub gRPC | `apps/pedidos/src/pedidos/pedidos.service.ts:71-74` | El stub ya incluye `VerificarDisponibilidad` al extender la interfaz `ProductosGrpcService`; no hay nuevo `getService()` |
| Interfaz `ProductosGrpcService` | `apps/pedidos/src/pedidos/pedidos.service.ts:13-23` | Agregué el método nuevo a la misma interfaz; el consumidor la usa por inyección de dependencias |
| `@GrpcMethod('ProductosService', 'ObtenerProducto')` | `apps/productos/src/productos/productos.grpc.controller.ts:28` | Seguí el mismo patrón de decorador y estructura de respuesta para mi handler nuevo |

**¿Qué convención del repositorio seguí para que mi código no desentone?**

- Usé el mismo patrón de respuesta con campos `encontrado`/`codigo_error` y `error` que ya usaba `ObtenerProducto`.
- Mantuve el `Logger` con prefijos `🟣 [gRPC]`, `✅ [gRPC]`, `⚠️ [gRPC]`, `❌ [gRPC]` que el equipo estableció.
- El handler lanza `RpcException` con objeto `{ statusCode, message, origen }`, la misma firma que usa `PedidosService.errorProductos()`.
- Coloqué el método nuevo al final del controlador gRPC, después de `ListarProductos`, respetando el orden de declaración del `.proto`.

**¿Qué NO dupliqué, pudiendo hacerlo?**

No creé un archivo `.proto` nuevo ni un módulo/cliente gRPC separado. El método nuevo va dentro del `service ProductosService` que ya existe en `libs/proto/productos.proto:13`, y el cliente `PRODUCTOS_GRPC_SERVICE` ya registrado en `pedidos.module.ts:33-43` lo sirve sin ninguna modificación.

---

## 3. Decisiones técnicas

### Decisión 1 — Qué consulta exponer como nuevo método
- **Qué decidí:** Exponer `VerificarDisponibilidad(id, cantidad)` que devuelve `disponible + precio` en un solo salto.
- **Alternativa que descarté:** Crear `ObtenerStock` que solo devuelva un booleano.
- **Por qué:** La consulta real de negocio necesita ambos datos a la vez (¿está disponible? y ¿a qué precio?). Devolver solo el booleano obligaría al consumidor a hacer un segundo salto para obtener el precio, volviendo al problema original. Una sola llamada tipada resuelve la consulta completa.

### Decisión 2 — Cómo manejar el error "servicio caído"
- **Qué decidí:** Usar `timeout(5000)` + `catchError` que lanza `RpcException({ statusCode: 503 })` antes de re-lanzar al Gateway.
- **Alternativa que descarté:** Devolver un objeto `{ ok: false, error: '...' }` sin lanzar excepción (igual que `obtenerProductoGrpc` en la línea 265 del servicio original).
- **Por qué:** El criterio C3 exige que el consumidor traduzca el error al código HTTP correcto sin propagar una excepción no controlada. Lanzar `RpcException` tipada permite que el filtro del Gateway (`AllExceptionsFilter`) la serialice como 503 automáticamente, en lugar de caer en el caso genérico 500. El patrón `{ ok: false }` es válido para endpoints de diagnóstico pero no para un flujo de creación de pedidos donde el llamador necesita saber si reintentar.

---

## 4. Las 3 preguntas de mi actividad

**Pregunta 1:** ¿Por qué el contrato debe vivir en un lugar compartido y no duplicado dentro de cada servicio?

> En este sistema el contrato está en `libs/proto/productos.proto` y lo usan tanto `svc-productos` (servidor) como `svc-pedidos` (cliente). Si cada servicio tuviese su propia copia, cualquier cambio en el servidor —añadir un campo, renombrar un mensaje— tendría que replicarse manualmente en todos los clientes, y es trivial que queden desincronizados. Con un único archivo en `libs/proto/`, el build falla si servidor y cliente no compilan contra la misma versión: la inconsistencia se detecta en tiempo de compilación, no en producción.

**Pregunta 2:** ¿Qué código de error del transporte elegiste para "no encontrado" y a qué código HTTP lo mapeas? ¿Por qué **no** es correcto devolver 500?

> En la respuesta gRPC uso `codigo_error: 'NOT_FOUND'` y en `pedidos.service.ts` lo mapeo a **HTTP 404**. No es correcto devolver 500 porque ese código significa "el servidor tuvo un fallo inesperado", es decir, algo que el cliente no provocó y que no puede corregir. Un recurso que simplemente no existe es un error del cliente (pidió un ID que no está en el catálogo); el cliente puede y debe reaccionar de forma diferente: mostrar "producto no encontrado" al usuario en lugar de mostrar "error del sistema". Si devuelvo 500, el frontend no puede distinguir entre "el servidor explotó" y "escribiste mal el ID", lo que arruina la experiencia del usuario y dificulta el debugging.

**Pregunta 3:** Si mañana añades un campo nuevo al contrato, ¿siguen funcionando los clientes que no lo conocen? ¿Por qué?

> Sí, siguen funcionando. Protobuf garantiza **compatibilidad hacia adelante**: los campos desconocidos se ignoran en la deserialización. Si añado `int32 stock = 5` al mensaje `VerificarResponse`, un cliente que compiló contra la versión anterior simplemente no leerá ese campo, pero tampoco falla. La condición es no reutilizar el número de campo de un campo eliminado, y no cambiar el tipo de un campo existente. Esto es diferente a REST con JSON Schema estricto (modo `additionalProperties: false`) donde un campo extra puede romper la validación del cliente.

---

## 5. Uso de Inteligencia Artificial — **obligatorio**

**¿Usaste IA en este examen?** ☑ Sí  ☐ No

| # | Qué le pedí | Qué me devolvió | Qué correjí, adapté o descarté — y por qué |
|:--:|---|---|---|
| 1 | Un prompt maestro con todos los pasos para implementar la Actividad B, analizando el repositorio real | Plan completo de 10 pasos, snippets de código y respuestas a las preguntas de bitácora | Sirvió como guía; ejecuté cada paso y adapté lo que no encajaba con mi entorno |
| 2 | Crear la carpeta de evidencia y el archivo `antes-sin-metodo.txt` | Comandos PowerShell y el archivo generado automáticamente | Lo revisé y verifiqué que el contenido era correcto antes de commitear |
| 3 | Extender `libs/proto/productos.proto` con el nuevo rpc `VerificarDisponibilidad` | Los bloques `message VerificarRequest` y `VerificarResponse` y la línea `rpc` agregada al `service` | Verifiqué que los números de campo no colisionaran con los mensajes existentes |
| 4 | Implementar el handler `@GrpcMethod` en `productos.grpc.controller.ts` | Método `verificarDisponibilidad` con los tres casos: `INVALID_ARGUMENT`, `NOT_FOUND` y caso exitoso | Pedi quitar los emojis del logger para mantener consistencia con el código original |
| 5 | Método consumidor `verificarDisponibilidadGrpc` en `pedidos.service.ts` | Método con `timeout(5000)`, `catchError` y mapeo de `NOT_FOUND→4`, `INVALID_ARGUMENT→400`, `timeout→503` | Lo revisé línea por línea; la lógica del mapeo de errores la entendí antes de aceptarla |
| 6 | Endpoint `GET /api/pedidos/verificar/:id` en el gateway | Método `verificarDisponibilidad` con `@Query`, `DefaultValuePipe`, `ParseIntPipe` y el patrón `rpcAHttp` ya existente | Revisé que siguiera el mismo patrón que `obtenerProductoGrpc` en el mismo archivo |

**Lo que hice YO sin ayuda de IA:**
- Crear la rama: `git checkout -b exam/DanielaLTM2206`
- Escribir el handler `@MessagePattern({ cmd: 'verificar_disponibilidad' })` en `apps/pedidos/src/pedidos/pedidos.controller.ts` (lo escribi siguiendo el patrón de los handlers existentes del mismo archivo)
- Quitar los emojis de todos los `logger.log/warn/error` de `pedidos.controller.ts` para mantener el estilo del proyecto
- Hacer los commits y pushes de mis propios cambios
- Esta bitácora
- Las capturas de pantalla de evidencia
- La sección del README

**¿En qué se equivocó respecto a mi repositorio?**

El asistente propuso un import de `RpcException` desde `@nestjs/microservices` pero en mi estructura ya tenía un helper personalizado `errorProductos` dentro del servicio, por lo que tuve que ajustar el mapeo para que devolviera un objeto consistente con el resto de la aplicación en lugar de lanzar la excepción directamente en el controlador.

---

## 6. Evidencia

| Archivo | Qué demuestra |
|---|---|
| `antes-sin-metodo.txt` | Salida de `grep -n "VerificarDisponibilidad" libs/proto/productos.proto` retornando vacío — el método no existía |
| `despues-caso-ok.png` | `curl http://localhost:3000/pedidos/verificar/1?cantidad=2` → 200 con `disponible: true` y `precio` |
| `despues-caso-error.png` | `curl http://localhost:3000/pedidos/verificar/999?cantidad=1` → 404 con mensaje tipado |

**Cómo reproducir mi cambio desde cero:**

```powershell
# 1. Levantar el sistema
docker-compose up -d

# 2. Esperar ~15s a que todos los servicios estén listos

# 3. Caso exitoso — producto existente
Invoke-RestMethod -Uri "http://localhost:3000/api/pedidos/verificar/1?cantidad=2" | ConvertTo-Json

# 4. Caso NOT_FOUND → 404
try { Invoke-RestMethod -Uri "http://localhost:3000/api/pedidos/verificar/999?cantidad=1" } catch { $_.Exception.Response }

# 5. Caso INVALID_ARGUMENT → 400
try { Invoke-RestMethod -Uri "http://localhost:3000/api/pedidos/verificar/0?cantidad=0" } catch { $_.Exception.Response }
```

---

## 7. Prueba automatizada

| | |
|---|---|
| **Archivo de la prueba** | `apps/pedidos/src/pedidos/pedidos.verificar.spec.ts` |
| **Comando para ejecutarla** | `cd apps/pedidos && npm test -- --testPathPattern=pedidos.verificar` |
| **Qué verifica** | Que el consumidor traduce `NOT_FOUND` → `RpcException(404)` y `INVALID_ARGUMENT` → `RpcException(400)` sin propagar excepción no controlada; y que el caso exitoso retorna `ok: true` |
| **¿Falla sin mi cambio?** | Sí — sin el método `verificarDisponibilidadGrpc` en el servicio, la prueba falla con `TypeError: service.verificarDisponibilidadGrpc is not a function` |

*Pega aquí la salida de la prueba pasando:*

```
> pedidos@1.0.0 test
> jest

PASS src/pedidos/pedidos.verificar.spec.ts
  verificarDisponibilidadGrpc — mapeo de errores
    √ NOT_FOUND del contrato → RpcException 404 (no excepcion sin capturar) (6 ms)
    √ INVALID_ARGUMENT del contrato → RpcException 400 (1 ms)
    √ Caso exitoso → retorna disponible sin lanzar excepcion

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
Snapshots:   0 total
Time:        4.084 s, estimated 5 s
Ran all test suites.
```

---

## 8. Estado final — honesto

**Funciona:**
- Método `VerificarDisponibilidad` en el contrato `libs/proto/productos.proto`
- Handler gRPC en `svc-productos` con validación de entrada y errores tipados
- Consumidor en `svc-pedidos` con mapeo `NOT_FOUND → 404`, `INVALID_ARGUMENT → 400`, `timeout → 503`
- Endpoint HTTP `GET /pedidos/verificar/:id?cantidad=N` en el Gateway
- Prueba automatizada con 3 casos

**No funciona / quedó incompleto:**
- Todo funciona correctamente tras reconstruir los contenedores sin caché (`docker-compose build --no-cache`). El problema del camelCase en gRPC (`codigo_error` vs `codigoError`) fue resuelto.

**Cuál era mi siguiente paso:**
- Tomar las capturas de pantalla de los casos `ok` y `error` y hacer los commits finales, incluyendo la creación del PR y el tag.

> Declarar con precisión lo que no terminaste **conserva** los puntos de C2, C3, C4 y C5. Presentar como terminado algo que no funciona los pone en riesgo todos.

---

## 9. Declaración

> Declaro que este trabajo es individual, que corresponde a la actividad que me fue asignada, y que la sección 5 refleja de forma completa y veraz el uso que hice de herramientas de Inteligencia Artificial durante el examen.

**Nombre:** Daniela Tituaña
**Fecha:** 2026-07-27
