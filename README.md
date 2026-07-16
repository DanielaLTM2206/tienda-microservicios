# ShopMS - Sistema de Gestion de Pedidos con Microservicios

> MVP de arquitectura de microservicios - Arquitectura de Software - 7.o semestre - Entrega por avances.

## Equipo

| Integrante | Rol | GitHub |
|---|---|---|
| Daniela Tituaña | Backend / Arquitectura | @daniela-tituana |
| Stiven Molina | Transportes / Comunicacion | @stiven-molina |
| Jeffrey Manobanda | Documentacion / QA | @jeffrey-manobanda |

---

## Descripcion del MVP

ShopMS es un sistema de gestion de pedidos construido con arquitectura de microservicios. El dominio es intencionalmente simple (Pedidos, Productos, Notificaciones) para que el esfuerzo se concentre en la arquitectura de comunicacion y no en la logica de negocio.

El sistema permite crear y consultar pedidos, validar productos y notificar eventos de manera asincrona, demostrando dos modelos de comunicacion contrastantes: sincrono (bloquea, acumula latencia) y asincrono (no bloquea, desacopla en el tiempo).

- **MS 1 - Pedidos (svc-pedidos):** gestiona el ciclo de vida de los pedidos; inicia la cadena sincrona TCP y publica eventos en Redis.
- **MS 2 - Productos (svc-productos):** catalogo de productos; es el segundo salto de la cadena sincrona TCP. Si cae, el flujo sincrono falla.
- **MS 3 - Notificaciones (svc-notificaciones):** suscrito a Redis; procesa eventos de forma completamente desacoplada.
- **API Gateway:** unico punto de entrada HTTP; traduce peticiones REST a mensajes TCP y las enruta al servicio correcto.

## Stack

- **Framework:** NestJS 10 (TypeScript)
- **Sincrono:** TCP (transporte nativo de NestJS) - **Eventos:** Redis PUB/SUB (ioredis) - **2.o transporte:** RabbitMQ (Tarea 2) - **Contrato:** gRPC (Tarea 2)
- **Seguridad:** JWT + Guard (Tarea 3) - **Observabilidad:** Sentry (Tarea 3)
- **BD:** PostgreSQL 16 - **Contenedores:** Docker Compose - **Estructura:** monorepo (npm workspaces)

## Como ejecutar

```bash
# Clonar el repositorio
git clone <url-del-repo>
cd microservicios-avance1

# Levantar todo el sistema (construye y arranca los 4 servicios + BD + Redis)
docker compose up -d --build

# Verificar que todos los servicios estan corriendo
docker compose ps

# Probar el sistema
curl http://localhost:3000/api/health
curl http://localhost:3000/api/pedidos
```

**Rutas disponibles:**

| Metodo | Ruta | Flujo | Descripcion |
|---|---|---|---|
| GET | `/api/health` | Directo | Health check del gateway |
| GET | `/api/pedidos` | Sincrono TCP x2 | Lista pedidos + info de productos |
| POST | `/api/pedidos` | Sincrono TCP x2 | Crear pedido (body: `{"productoId": 1, "cantidad": 2}`) |
| POST | `/api/pedidos/notificar` | Asincrono Redis | Publicar evento (body: `{"mensaje": "hola"}`) |

---

## Arquitectura

### Diagrama - Avance 1

```
+---------------------------------------------------------------------+
|                         CLIENTE (curl / Postman)                     |
+------------------------------+--------------------------------------+
                               | HTTP :3000
                               v
+---------------------------------------------------------------------+
|                    API GATEWAY (gateway:3000)                        |
|  Patron: Proxy - enruta sin logica de negocio                       |
|  Exception Filter global -> errores HTTP coherentes                  |
+--------------------+--------------------+---------------------------+
                     |                    |
        CAMINO A     |                    |  CAMINO B
      SINCRONO TCP   |                    |  ASINCRONO REDIS
                     |                    |
                     v                    v
+----------------------------+    +----------------------------+
|  svc-pedidos (TCP :3001)   |    |  svc-pedidos (TCP :3001)   |
|  MS A - Inicia cadena      |    |  MS A - Publica evento     |
+-----------+----------------+    +--------------+-------------+
            |                                    |
            | TCP (2o salto)                     | Redis PUBLISH
            | Latencia Acumulada                 | No Bloquea
            v                                    v
+----------------------------+    +----------------------------+
| svc-productos (TCP :3002)  |    |    Redis (canal eventos)   |
|  MS B - Catálogo productos |    +--------------+-------------+
|  Si cae -> TODO falla      |                   | SUBSCRIBE
+----------------------------+                   v
                                  +----------------------------+
                                  |  svc-notificaciones        |
                                  |  MS C - Consumidor eventos |
                                  |  Si cae -> flujo continua  |
                                  +----------------------------+

Infraestructura compartida:
  PostgreSQL <- svc-pedidos, svc-productos (cada uno su propio schema/tabla)
  Redis      <- svc-pedidos (PUBLISH), svc-notificaciones (SUBSCRIBE)
```

---

## Metodologia

- **Kanban:** [GitHub Projects - ShopMS Board](https://github.com/users/DanielaLTM2206/projects/1/views/1)
  
  ![Tablero Kanban](docs/kanban-avance1.png)
  
- **Ramificacion:** GitHub Flow - main protegida, ramas `feat/...`, `fix/...`, `docs/...`, PRs revisados por otro integrante, tags por avance.
- **Commits semanticos:** Conventional Commits.

**Ejemplos de commits:**
```
feat(gateway): agregar rutas HTTP y cliente TCP hacia svc-pedidos
feat(pedidos): implementar cadena sincrona TCP con svc-productos
feat(notificaciones): suscribir a canal Redis eventos:notificaciones
fix(pedidos): controlar timeout de svc-productos con catchError
docs(readme): agregar diagrama de arquitectura avance 1
chore(docker): configurar health checks en docker-compose
```

**Estrategia de ramificacion:**
```
main <- feat/gateway-setup (PR)
     <- feat/ms-pedidos     (PR)
     <- feat/ms-productos   (PR)
     <- feat/ms-notificaciones (PR)
     <- docs/readme-avance1  (PR)
     <- tag v1-avance1
```

---

## Patrones y principios SOLID aplicados

| Patron / Principio | Donde se aplica | Descripcion |
|---|---|---|
| **API Gateway** | `apps/gateway` | Punto unico de entrada; oculta la topologia interna |
| **Proxy** | `gateway/pedidos.controller.ts` | Delega peticiones sin logica de negocio |
| **Publisher/Subscriber** | `pedidos.service.ts` + `notificaciones.service.ts` | Redis PUB/SUB desacopla emisor y consumidor |
| **Exception Filter** | `gateway/filters/all-exceptions.filter.ts` | Captura todos los errores y devuelve HTTP coherente |
| **SRP** (Single Responsibility) | Todos los modulos | Cada clase tiene UNA razon para cambiar |
| **DIP** (Dependency Inversion) | Todos los servicios | Dependen de abstracciones (ClientProxy, Repository), no de clases concretas |
| **OCP** (Open/Closed) | `notificaciones.service.ts` | Agregar tipos de evento = agregar un `case`, sin modificar lo existente |

**Que trae NestJS:** decoradores `@Module`, `@Injectable`, `@MessagePattern`, `ClientsModule`, `Transport.TCP`, inyeccion de dependencias, `Repository` de TypeORM.  
**Que agregamos nosotros:** `AllExceptionsFilter` global, `timeout()` + `catchError()` en cadenas RxJS, publicador/suscriptor Redis con `ioredis`, seed de datos en `onModuleInit`.

---

## Avance 1 - Acoplamiento temporal y latencia - `tag v1-avance1`

### Caminos implementados

- **Sincrono (TCP):** Gateway -> svc-pedidos (TCP) -> svc-productos (TCP) -> respuesta acumulada.
- **Asincrono (Redis):** Gateway -> svc-pedidos (TCP) -> Redis PUBLISH -> svc-notificaciones SUBSCRIBE (el emisor no espera).

### Latencia medida con `benchmark.js`

| Camino | Promedio (ms) | p95 (ms) | Max (ms) |
|---|---|---|---|
| Sincrono (TCP x2) | 3.98 | 5.00 | 184.00 |
| Asincrono (Redis PUBLISH) | 2.21 | 3.00 | 57.00 |

**Capturas de los benchmarks de latencia:**
* Sincrono (TCP):
![Mediciones de latencia sincrona](docs/latencia.png)

* Asincrono (Redis):
![Mediciones de latencia asincrona](docs/latencia%20asincr.png)


**Como reproducir:**
```bash
# Sincrono (GET /api/pedidos - 2 saltos TCP)
node tarea-1/benchmark.js http://localhost:3000/api/pedidos 200

# Asincrono (POST /api/pedidos/notificar - publica en Redis)
node tarea-1/benchmark.js http://localhost:3000/api/pedidos/notificar 200 --post
```

### Prueba de acoplamiento temporal

**Paso 1 - Apagar svc-productos (segundo salto de la cadena sincrona):**
```bash
docker compose stop svc-productos
```

**Paso 2 - Probar camino sincrono (debe fallar):**
```bash
curl http://localhost:3000/api/pedidos
# Resultado esperado: 503 Service Unavailable
# "svc-pedidos no responde - acoplamiento temporal demostrado"
```

**Paso 3 - Probar camino asincrono (debe seguir funcionando):**
```bash
curl -X POST http://localhost:3000/api/pedidos/notificar \
  -H "Content-Type: application/json" \
  -d '{"mensaje": "prueba con svc-productos caido"}'
# Resultado esperado: 201 OK - el evento se publica SIN importar que svc-productos este caido
```

**Evidencia de la prueba de caida:**

1. Apagado del servicio `svc-productos`:
![Apagando svc-productos](docs/svc-productos%20apagado.png)

2. Intento de peticion sincrona (GET /api/pedidos) fallido con error 503:
![Fallo Sincrono](docs/verificacion%20pedido.png)

3. Intento de peticion asincrona (POST /api/pedidos/notificar) exitoso:
![Exito Asincrono](docs/caida-asincrona.png)



### Analisis

**Acumulacion de latencia (camino sincrono):**  
En una cadena sincrona Gateway -> A -> B, el tiempo total de respuesta es la suma de las latencias de cada salto: `t_total ≈ t_gateway + t_pedidos + t_productos`. Cada servicio debe esperar que el anterior responda antes de continuar. Si cada salto demora ~10 ms, la cadena acumula ~30 ms solo en transporte, sin contar el tiempo de BD.

**Acoplamiento temporal:**  
El modelo sincrono exige que todos los servicios de la cadena esten vivos al mismo tiempo. Al apagar `svc-productos`, la peticion a `GET /api/pedidos` falla completamente con un error 503, aunque `svc-pedidos` y el Gateway esten funcionando perfectamente. Esto es el acoplamiento temporal: si uno falla, falla toda la cadena.

En contraste, el modelo asincrono (Redis PUB/SUB) desacopla en el tiempo: `svc-pedidos` publica el evento y retorna inmediatamente al cliente, sin saber si `svc-notificaciones` esta vivo o no. El consumidor puede levantarse mas tarde y procesara los nuevos eventos. Los dos servicios no necesitan coincidir en el tiempo.

---

## Avance 2 - Comunicacion: gRPC + 2.o transporte + excepciones - `tag v2-avance2`

> *Pendiente - Tarea 2*

---

## Avance 3 - Seguridad, observabilidad e integracion (FINAL) - `tag v3-final`

> *Pendiente - Tarea 3*

---

## Tags de entrega

- `v1-avance1` - *por publicar* - `v2-avance2` - *pendiente* - `v3-final` - *pendiente*
