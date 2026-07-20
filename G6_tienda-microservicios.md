# Retroalimentación — Avance 1 · Grupo 6

**Repositorio:** https://github.com/DanielaLTM2206/tienda-microservicios
**Estado evaluado:** tag `v1-avance1` (commit `c8476b3`, 2026-07-15)

---

## Nota

| Criterio | Nivel | Puntos |
|---|:--:|--:|
| C1. Arquitectura del MVP | 5 | 4.0 |
| C2. Medición de latencia y acoplamiento | 3 | 2.4 |
| C3. Buenas prácticas | 3 | 2.4 |
| C4. Proceso | 2 | 1.6 |
| C5. Documentación + diagrama | 3 | 2.4 |
| **Total** | **16 bruto** | **12.8 / 20** |

---

## Resumen: producto bueno, proceso ausente

El **producto técnico es sólido y honesto**. Hay 3 microservicios reales + gateway, la cadena síncrona de 2 saltos TCP es auténtica, el camino asíncrono es genuinamente fire-and-forget, y —esto es notable— las capturas de evidencia **coinciden dígito a dígito** con la tabla del README. Docker Desktop demuestra que el stack completo corrió. Su C1 es de las dos mejores del curso.

El **proceso de trabajo es la falla grave**, y les cuesta más puntos que cualquier defecto técnico.

---

## El problema central: el flujo Git documentado no ocurrió

Su README describe un GitHub Flow con PRs revisados. La verificación:

- Las 5 ramas remotas (`feat/gateway-setup`, `feat/ms-pedidos`, `feat/ms-productos`, `feat/ms-notificaciones`, `docs/readme-avance1`) **apuntan todas al mismo commit inicial `daa2fec`**. Ninguna tiene un solo commit propio.
- `git log --merges` = **0**. No hubo ningún PR mergeado, contra lo afirmado en README:114 y el diagrama de README:127-135.
- Al corte del Avance 1 hay **2 commits de una sola autora**. Stiven Molina no tiene commits en toda la historia; Jeffrey aparece solo en el Avance 2.
- Los "ejemplos de commits" de README:117-125 **no existen** en el historial.
- El commit `daa2fec`, etiquetado `chore(repo): configuracion inicial del monorepo y dependencias`, introduce **52 archivos y 6923 líneas**: el proyecto entero bajo una etiqueta `chore`.
- Todo el proyecto tiene **3 commits en total**, incluido el Avance 2.

Crear las ramas y luego subir todo en un commit a `main` produce exactamente esta huella. El evaluador la ve en segundos con `git log --graph --all`. Es un problema de integridad, no de forma — y es la razón por la que C4 y C5 no suben.

---

## Análisis por criterio

### C1 — Arquitectura · Nivel 5
| Componente | Transporte | Verificado en |
|---|---|---|
| gateway (HTTP :3000) | `Transport.TCP` → pedidos | `apps/gateway/src/pedidos/pedidos.module.ts:10-19` |
| svc-pedidos (TCP :3001) | Servidor TCP + cliente → productos | `apps/pedidos/src/main.ts:10-14` |
| svc-productos (TCP :3002) | Servidor TCP, `@MessagePattern` | `apps/productos/src/main.ts:9-14` |
| svc-notificaciones | Redis SUBSCRIBE | `apps/notificaciones/src/main.ts:12` |

Cadena real: `pedidos.service.ts:56-67` hace `firstValueFrom(productosClient.send({cmd:'get_productos'}))` con `await` genuino. **No es fachada.** Camino asíncrono correcto: `pedidos.service.ts:141` usa `redis.publish()` y el consumidor se suscribe con `subscriber.on('message')` — no cayeron en el error clásico de usar `send()`.

Compose con healthchecks en `db` y `redis`, `depends_on: condition: service_healthy`, hostnames Docker correctos. `docs/svc-productos apagado.png` prueba los 6 contenedores levantados.

*Matiz para el Avance 2:* usan ioredis crudo en vez de `Transport.REDIS` + `@EventPattern`. Funciona, pero no ejercitaron el mecanismo de transporte de Nest que van a necesitar con RabbitMQ.

### C2 — Medición · Nivel 3
Tabla de ambos caminos respaldada por capturas que coinciden exactamente (sync 3.98/5.00/184.00; async 2.21/3.00/57.00). Prueba de caída con 3 capturas.

**No llega a 5** porque la acumulación de latencia se *afirma* pero no se *mide*: no hay descomposición por salto (1 salto vs 2 saltos). Peor, el ejemplo numérico del análisis —"~10 ms por salto → ~30 ms" (README:225)— **contradice sus propias mediciones de 3.98 ms**. Y el endpoint "asíncrono" atraviesa igual un salto TCP síncrono (gateway → pedidos), así que 2.21 ms no es latencia de publicación pura.

### C3 — Buenas prácticas · Nivel 3
Tabla que nombra 7 patrones mapeados a archivos concretos (README:141-149), respaldados por el código: `AllExceptionsFilter` global en el gateway, `timeout()+catchError()` en las cadenas RxJS, try/catch en capa de servicio.

**No llega a 5** porque no usan `RpcException` ni filtro del lado microservicio: los errores cruzan TCP como `Error` genérico y pierden identidad. La prueba está en su propia captura — con `svc-productos` caído, la respuesta dice *"svc-pedidos no responde"* (mensaje hardcodeado en `gateway/src/pedidos/pedidos.controller.ts:43`), **culpando al servicio equivocado**. El DIP declarado también es débil: inyectan clases concretas del framework, no abstracciones propias.

### C4 — Proceso · Nivel 2
Ver la sección anterior. Hay tablero Kanban real (8 tarjetas en "Hecho", issues #1-#8) y las ramas existen, lo que evita el nivel 1. Todo lo demás está descrito arriba.

Detalle adicional: el board aparece **privado** en `docs/kanban-avance1.png`, así que el enlace de README:110 no será accesible. Y todas las tarjetas están en "Hecho" (0 en Por Hacer / En proceso), lo que sugiere carga retroactiva.

### C5 — Documentación · Nivel 3
README completo: dominio, diagrama ASCII legible, stack, rutas, patrones, mediciones con capturas, análisis redactado, enlace + captura de Kanban. **No llega a 5** porque documenta un proceso Git que no ocurrió, y README:248 declara `v1-avance1` como *"por publicar"* cuando el tag ya existe.

---

## Qué hacer ahora

**Prioridad 1 — antes de escribir código del Avance 2**
1. **Cambiar los 4 servicios a contexto de build raíz**: `build: { context: ., dockerfile: apps/<svc>/Dockerfile }` y ajustar los `COPY` a rutas `apps/<svc>/...`. Hoy usan `build: ./apps/<svc>` (`docker-compose.yml:53,70,82,108`), lo que limita el contexto a la carpeta del servicio: **un `proto/` en la raíz no se puede copiar a las imágenes**. Con gRPC, o duplican el `.proto` en cada app (contratos que divergen) o no compila.
2. Crear `libs/proto/` en la raíz con los `.proto` compartidos y añadir `paths` en el `tsconfig.json` raíz. Hoy no existe `libs/`, `proto/` ni `shared/`.
3. Añadir `@grpc/grpc-js`, `@grpc/proto-loader` y `amqplib` a los `package.json`; agregar el servicio `rabbitmq` con healthcheck al compose (hoy no está).
4. Introducir `RpcException` en pedidos/productos y un `RpcExceptionFilter` — el Avance 2 evalúa manejo de excepciones a través de los transportes, y el patrón actual pierde el tipo de error al cruzar el límite.

**Prioridad 2 — corregir el proceso (recupera C4 de 2 a 3–5)**
5. Trabajar el Avance 2 con **una rama por tarea, commits incrementales y PRs reales mergeados**, revisados por otro integrante. El commit `888b7e4` del Avance 2 ya repite el antipatrón del commit gigante: si vuelve a pasar, C4 se queda en 2 otra vez.
6. Asegurar commits de los **tres** integrantes con su propia identidad.
7. Vincular cada tarjeta del Kanban a su issue/PR y **hacer público el board**.
8. Corregir README:114 y README:127-135 para que describan lo que realmente pasó, o eliminar la afirmación de PRs.

**Prioridad 3 — deuda técnica**
9. **Separar las bases de datos.** `apps/pedidos/src/app.module.ts:20` y `apps/productos/src/app.module.ts:14` apuntan ambos a `DB_NAME: app` en la misma instancia, ambos con `synchronize: true`. README:102 dice "cada uno su propio schema", pero comparten el schema `public`: dos procesos sincronizando esquema contra la misma BD al arrancar es una condición de carrera.
10. Medir latencia de 1 salto vs 2 saltos y añadir la comparación a la tabla — **convierte C2 en un 5 con poco esfuerzo** y corrige de paso la contradicción de README:225.
11. Corregir la atribución de error de `gateway/src/pedidos/pedidos.controller.ts:43`.
12. Eliminar el `ClientsModule` duplicado en `gateway/src/app.module.ts:13-22` (registrado también, y sí usado, en `pedidos.module.ts`).
13. Copiar `package-lock.json` en los Dockerfiles y usar `npm ci` en vez de `npm install`: hoy los builds no son reproducibles.
14. Añadir `.env.example`, actualizar README:248 y corregir el handle de GitHub de README:11 (`@jeffrey-manobanda` vs el real `jeffrey2206`).
