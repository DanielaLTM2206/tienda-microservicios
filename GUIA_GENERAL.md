# Proyecto Integrador — Arquitectura de Microservicios
### Guía general (léela primero) · 3 avances en 10 días

> **Entrega:** cada grupo entrega **solo el enlace de su repositorio público**. Toda la evidencia vive en el **`README.md`**, que se **actualiza en cada avance**.
> **Grupos:** de **3 a 4 estudiantes**. **Sistema:** mínimo **3 microservicios** (sin contar el **API Gateway**).
> **Framework:** por defecto **NestJS**. Pueden usar **Spring Boot u otro**, siempre que **documenten cómo aplican los temas de clase** (transportes, patrones, SOLID, excepciones, gRPC, JWT, logs).

El detalle de cada avance está en su propio archivo:
- **`tarea-1/TAREA_1.md`** — Acoplamiento temporal y latencia (síncrono vs asíncrono).
- **`tarea-2/TAREA_2.md`** — Comunicación entre microservicios: gRPC + segundo transporte + excepciones.
- **`tarea-3/TAREA_3.md`** — Seguridad (JWT/Guard), observabilidad (Sentry), integración y defensa.

---

## 0. Idea clave (para no complicarse)

> **El dominio del MVP debe ser SENCILLO** (2–3 entidades: p. ej. *Pedidos, Productos, Notificaciones*). El esfuerzo va a la **arquitectura de comunicación**, las **buenas prácticas** y la **documentación**, no a features de negocio.

**Este proyecto solo usa lo que ya vieron en clase.** No hace falta nada externo al temario:
- ❌ Sin orquestadores (Kubernetes/Swarm) ni herramientas nuevas.
- ❌ Sin frontend elaborado (Postman/Thunder/`curl` basta).
- ✅ Todo se arma con **NestJS + los transportes vistos + Docker Compose**.

---

## 1. Aprovechen todo lo que ya dominan

El curso les dio **seis formas de comunicar microservicios** y varias herramientas de calidad. El proyecto es la excusa para usarlas y demostrarlas:

| Ya lo vieron | Dónde lo usan en el proyecto |
|---|---|
| **TCP** (petición-respuesta) + **Gateway** | Camino síncrono (Tarea 1) |
| **Redis / MQTT / NATS / RabbitMQ** (PUB/SUB, queue) | Eventos asíncronos (Tarea 1 y 2) |
| **gRPC** en **monorepo** + try/catch | Interconexión con contrato + errores (Tarea 2) |
| **SOLID** y **patrones de diseño** | En todo el proyecto (nómbrenlos) |
| **Manejo de excepciones** en la capa de servicios | Tareas 1 y 2 |
| **JWT** (autenticación/autorización) + **Guard** | Seguridad del Gateway (Tarea 3) |
| **Logs con Sentry** | Observabilidad (Tarea 3) |

> En cada avance **nombren explícitamente** los patrones/principios usados. Ej.: *API Gateway, Proxy, Publisher/Subscriber, Inyección de Dependencias (DIP), DTO+Pipes (SRP), Exception Filters.*

**Si usan otro framework (Spring Boot, etc.):** deben lograr lo mismo (TCP/mensajería/gRPC/JWT/logs) y **documentar en el README** qué equivale a cada punto.

---

## 2. Cronograma por días (10 días)

| Día | Foco | Corte |
|---|---|---|
| **Día 1** | Grupo y roles · repo público · **Kanban** (GitHub Projects) · dominio del MVP · **diagrama v0** | — |
| **Día 2–3** | **Tarea 1**: 3 microservicios + Gateway · camino **síncrono (TCP)** + **asíncrono (Redis)** · excepciones | — |
| **Día 4** | **Tarea 1**: benchmark de latencia · prueba de caída · **README v1** | ✅ **Avance 1** — tag `v1-avance1` |
| **Día 5–6** | **Tarea 2**: **gRPC** (monorepo) · **segundo transporte** (RabbitMQ/MQTT/NATS) · manejo de excepciones | — |
| **Día 7** | **Tarea 2**: evidencias · comparación de transportes · **README v2** | ✅ **Avance 2** — tag `v2-avance2` |
| **Día 8–9** | **Tarea 3**: **JWT + Guard** · **Sentry** · integración de todos los microservicios | — |
| **Día 10** | **Tarea 3**: **README final** · **EXPOSICIÓN** (demo en vivo) | ✅ **Avance 3** — tag `v3-final` |

La nota de cada corte se toma del **estado del README + tags/commits** a esa fecha. Siempre entregan el **mismo enlace del repo**.

---

## 3. Flujo de trabajo (versión simple)

### 3.1 Kanban
GitHub Projects → **Board** con columnas: `Backlog` → `Por hacer` → `En progreso` → `En revisión` → `Hecho`. Usen `TABLERO_KANBAN.md` (tarjetas listas). Enlacen el tablero y suban **una captura** por avance a `/docs`.

### 3.2 Ramificación — **GitHub Flow**
`main` protegida · ramas `feat/…`, `fix/…`, `docs/…` · **Pull Request** revisado por otro integrante · **tag por avance** (`v1-avance1`, `v2-avance2`, `v3-final`). *(Pueden usar otra estrategia si la explican en el README.)*

### 3.3 Commits semánticos (Conventional Commits)
`tipo(alcance): descripción` → `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `ci`.
```
feat(grpc): agregar contrato productos.proto entre pedidos y productos
fix(pedidos): controlar error con try/catch en la capa de servicios
feat(auth): proteger rutas del gateway con JwtAuthGuard
docs(readme): documentar integración de Sentry
```

---

## 4. Cómo se califica

- **3 tareas × 20 puntos**, cada una con **su propia rúbrica** (en su archivo de tarea).
- Cada rúbrica: **5 criterios**, cada uno en nivel **1, 2, 3 o 5**. **Suma bruta máx = 25** → **Nota final = suma × 0.8** (sobre 20).
- Equivalencia por criterio ya escalada: **1→0.8 · 2→1.6 · 3→2.4 · 5→4.0**.
- Conversión rápida del bruto: **25→20.0 · 23→18.4 · 21→16.8 · 18→14.4 · 15→12.0 · 12→9.6 · 9→7.2**.
- *(En Moodle, una Rúbrica con estos 5 criterios y niveles 1/2/3/5 se escala sola a la nota máxima 20.)*

> **Si no está en el README, no cuenta como evidencia.**

---

## 5. Recursos entregados

| Archivo | Para qué | Cuándo |
|---|---|---|
| `README.plantilla.md` | Plantilla del README que **evoluciona** por avance. Cópienla como `README.md`. | Día 1 |
| `TABLERO_KANBAN.md` | Tarjetas Kanban + cómo montar GitHub Projects. | Día 1 |
| `tarea-1/benchmark.js` | Mide latencia (prom/p95/máx) con **solo JavaScript** (sin librerías). | T1 |
| `tarea-1/docker-compose.yml` | Base: Gateway + 3 microservicios + Redis. | T1 |
| `tarea-2/docker-compose.transportes.yml` | Añade broker de mensajería (RabbitMQ) para el segundo transporte; gRPC es directo. | T2 |
| `tarea-3/docker-compose.final.yml` | Sistema integrado con variables para JWT y Sentry. | T3 |
