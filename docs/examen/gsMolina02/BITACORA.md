# Bitácora — Examen Final

## 0. Identificación

| | |
|---|---|
| **Nombre** | Stiven Molina |
| **Usuario GitHub** | @gsMolina02 |
| **Grupo / Proyecto** | Grupo 6 — ShopMS (`DanielaLTM2206/tienda-microservicios`) |
| **Actividad asignada** | **A** — Revocación de sesión JWT (logout real) |
| **Rama** | `exam/gsMolina02` |
| **Tag** | `examen-gsMolina02` |
| **Pull Request** | *(pegar enlace)* |
| **Tarjeta Kanban** | *(pegar enlace)* |
| **¿Hiciste el Paso 0?** | **No.** La base de JWT ya existía en el repo: login en `apps/gateway/src/auth/auth.service.ts:68` y guard en `apps/gateway/src/auth/guards/jwt-auth.guard.ts:33`, ambos entregados en el Avance 3 (PRs #12 y #13). `ASIGNACION.md` me listaba en Paso 0 por asumir que el Grupo 6 no publicó el Avance 3, pero sí se publicó. |

---

## 1. Qué construí

Antes de este cambio, cerrar sesión en ShopMS era una ficción: el cliente borraba el token de su lado, pero el servidor seguía aceptándolo hasta que expirara la hora completa. Un token robado era válido durante todo ese tiempo y no había forma de invalidarlo.

Ahora cada token emitido lleva un identificador único de sesión (`jti`), y existe `POST /api/auth/logout` que registra ese `jti` en una lista de revocados en Redis, con un TTL igual al tiempo de vida que le quedaba al token. El `JwtAuthGuard` que ya protegía las rutas consulta esa lista como segundo paso de validación: si el `jti` está revocado, responde **401** con un mensaje distinguible del de "token inválido o expirado".

La revocación es por sesión, no por usuario: cerrar sesión en un navegador no tumba las sesiones abiertas en otros.

---

## 2. Anclaje con el repositorio de mi grupo — obligatorio (C2)

| Código preexistente | Archivo:línea | Cómo me conecto con él |
|---|---|---|
| `JwtAuthGuard.canActivate()` — guard global de autenticación | `apps/gateway/src/auth/guards/jwt-auth.guard.ts:53` | **Lo extiendo**: conservo el paso de Passport (firma + expiración) y añado un segundo paso que consulta la lista de revocados. No creé un guard nuevo. |
| `AuthService.login()` — construcción del payload del JWT | `apps/gateway/src/auth/auth.service.ts:90` | Añado el claim `jti` al payload que ya se firmaba, sin tocar la lógica de bcrypt ni la emisión existente. |
| `JwtStrategy.validate()` — mapeo del payload a `req.user` | `apps/gateway/src/auth/jwt.strategy.ts:35` | Propago `jti` y `exp` al objeto que ya devolvía, para que el guard y el logout puedan operar. |
| Registro `APP_GUARD` del guard global | `apps/gateway/src/app.module.ts:28` | No lo modifico. Mi cambio viaja dentro del guard que ya estaba registrado ahí, así que la protección se aplica sola a todas las rutas. |
| Servicio `redis` del compose | `docker-compose.final.yml:45` | Reutilizo la instancia que ya usaban `svc-pedidos` (publisher) y `svc-notificaciones` (subscriber). Solo añadí `REDIS_HOST`/`REDIS_PORT` al gateway. |

**¿Qué convención del repositorio seguí para que mi código no desentone?**

Seguí el patrón de cliente `ioredis` que ya usan `PedidosService` y `NotificacionesService`: instancia en el constructor, `Logger` con el nombre de la clase, manejadores de `connect`/`error`, y cierre en un hook de ciclo de vida (`OnModuleDestroy`). Los comentarios van en español explicando el *porqué*, como en el resto del repo. El servicio nuevo vive dentro de `auth/`, junto a los demás componentes de autenticación, en lugar de una carpeta `common/` que aquí no existe.

**¿Qué NO dupliqué, pudiendo hacerlo?**

- **No creé un guard nuevo.** Extendí `apps/gateway/src/auth/guards/jwt-auth.guard.ts:53`, que escribí yo mismo en el Avance 3 (commit `73ef172`). Registrar un segundo guard en paralelo habría duplicado la resolución de `@Public()` y el orden de ejecución con `RolesGuard`.
- **No levanté un Redis propio para el gateway.** Reutilicé el del compose.
- **No dupliqué la validación de firma.** El paso de Passport se conserva íntegro; solo encadeno el mío después.

---

## 3. Decisiones técnicas

### Decisión 1 — Redis en vez de un `Set` en memoria

- **Qué decidí:** guardar los `jti` revocados en Redis, con clave `jwt:revocado:<jti>` y TTL.
- **Alternativa que descarté:** un `Set<string>` en memoria dentro del servicio. Era más rápido de escribir y no añadía dependencias.
- **Por qué:** el Gateway es hoy una sola instancia, pero nada impide replicarlo. Con memoria, un logout atendido por la réplica A no lo verían B ni C, y el token seguiría funcionando en ellas: la revocación dependería de a qué réplica cayera la petición. Además, un reinicio del contenedor vaciaría la lista y **resucitaría todas las sesiones revocadas**. Redis ya estaba levantado en el compose, así que el coste de hacerlo bien era casi cero.

### Decisión 2 — Fallar cerrado si Redis no responde

- **Qué decidí:** si Redis está caído, `estaRevocado()` lanza `ServiceUnavailableException` y la petición se rechaza.
- **Alternativa que descarté:** fallar abierto (asumir "no revocado" y dejar pasar), que mantiene el Gateway disponible durante una caída de Redis.
- **Por qué:** fallar abierto deja pasar tokens ya revocados exactamente en el momento en que el sistema no puede desmentirlos — que es el escenario que un atacante con un token robado querría provocar. Acepto a cambio que Redis se vuelva un punto único de fallo para las rutas protegidas. Es un coste de disponibilidad asumido a favor de la seguridad, y es defendible porque la función existe precisamente para cerrar sesiones comprometidas. Las rutas `@Public()` (login y health) no pasan por esta comprobación, así que el sistema sigue respondiendo en ellas.

---

## 4. Las 3 preguntas de mi actividad

**Pregunta 1: ¿Por qué el TTL de la entrada de revocación debe coincidir con la expiración del token, en vez de guardarla para siempre?**

> Porque después de `exp` el token ya es rechazado por sí solo: `JwtStrategy` está configurada con `ignoreExpiration: false` (`jwt.strategy.ts:20`), así que Passport lo tumba antes de que mi comprobación llegue a ejecutarse. Mantener el `jti` más allá de ese instante no aporta ninguna seguridad adicional y sí hace crecer la lista sin límite: con tokens de 1 hora y usuarios que cierran sesión varias veces al día, la memoria de Redis crecería de forma indefinida almacenando claves que ya no protegen nada. Calculo el TTL como `exp − ahora` (`token-revocation.service.ts:79`), de modo que Redis libera la entrada justo cuando deja de ser necesaria. Lo verifiqué: la clave se creó con TTL 3586 s y al consultarla después marcaba 3573 s.

**Pregunta 2: Si el almacén de revocados (Redis) está caído: ¿tu guard falla abierto o falla cerrado? ¿Qué riesgo aceptas?**

> **Falla cerrado.** `estaRevocado()` captura el error de Redis y lanza `ServiceUnavailableException`, así que la petición no pasa. La razón es que fallar abierto invierte la garantía justo cuando más se necesita: si alguien reportó un token robado y yo lo revoqué, una caída de Redis lo reactivaría sin que nadie se entere. El riesgo que acepto es de **disponibilidad**: mientras Redis esté caído, todas las rutas protegidas del Gateway devuelven 503, aunque los microservicios de detrás estén sanos. Es el mismo acoplamiento temporal que documentamos en el Avance 1, ahora aplicado a Redis. Lo mitigo parcialmente con `maxRetriesPerRequest: 2` para que el fallo sea rápido y no cuelgue la petición, y porque `login` y `health` están marcadas `@Public()` y no consultan la lista.

**Pregunta 3: ¿En qué se diferencia esto de simplemente borrar el token en el navegador del cliente?**

> Borrar el token en el cliente es una decisión que toma quien tiene el token, y solo afecta a esa copia. El servidor no se entera de nada: si el token fue interceptado, copiado o quedó en un log, esa otra copia sigue siendo válida hasta que expire, porque un JWT es autocontenido — el servidor lo valida solo con la firma, sin consultar ningún estado. Con este cambio, el servidor pasa a tener la última palabra: mantiene una lista de sesiones que ya no acepta y la consulta en cada petición. La diferencia práctica la demuestra mi evidencia: el mismo token, en la misma petición, pasa de 200 a 401 **sin que el cliente haya hecho nada** salvo pedir el logout.

---

## 5. Uso de Inteligencia Artificial — obligatorio

**¿Usaste IA en este examen?**  ☑ Sí  ☐ No

Usé **Claude (Claude Code)** durante el examen y también durante la preparación del Avance 3 previo.

| # | Qué le pedí | Qué me devolvió | Qué corregí, adapté o descarté — y por qué |
|:--:|---|---|---|
| 1 | Analizar `ACTIVIDADES.md` y `ASIGNACION.md` y decirme qué actividad me tocaba y qué faltaba en el repo | Confirmó la Actividad A verificando la fórmula `((6+2−2) mod 6)+1 = 1`, y detectó que el gateway **no tenía cliente Redis** ni recibía `REDIS_HOST` en el compose | Acepté el diagnóstico tras comprobarlo yo: `grep ioredis apps/gateway/package.json` no devolvía nada. Era información correcta y me ahorró descubrirlo a mitad de la implementación. |
| 2 | Implementar la revocación extendiendo el guard existente | Servicio de revocación en Redis, `POST /auth/logout`, `jti` en el payload y la extensión de `canActivate` | Revisé que **no creara un guard nuevo** (habría violado el anclaje obligatorio). Verifiqué el orden de los pasos: primero firma, después lista de revocados, para no permitir que un anónimo genere consultas a Redis con tokens falsos. |
| 3 | Una prueba automatizada que falle sin el cambio | Test con `jest` que espía el prototipo de `AuthGuard('jwt')` para aislar el paso nuevo | Verifiqué que la prueba realmente falla contra el guard anterior: sin la comprobación de revocados, `canActivate` devolvía `true` y el caso "rechaza token revocado" no lanzaba. También comprobé que el repo no tenía jest y hubo que configurarlo desde cero. |

**¿En qué se equivocó respecto a mi repositorio?**

Se equivocó de forma concreta y comprobable durante la preparación del Avance 3. Cuando Daniela añadió `bcrypt` al gateway, Claude afirmó que **fallaría al compilar en Alpine** por ser un módulo nativo que requiere `python3`, `make` y `g++`, y recomendó sustituirlo por `bcryptjs`. Lo detecté porque no acepté la afirmación sin probarla: ejecuté `docker build -f apps/gateway/Dockerfile -t test-gateway .` y el build pasó, y después `docker run --rm test-gateway node -e "require('bcrypt')..."`, que devolvió `bcrypt OK -> true`. La advertencia era incorrecta — `bcrypt` v6 ya distribuye binarios precompilados para musl — y de haberla seguido habría cambiado una dependencia sin motivo.

También comprobé que sus afirmaciones sobre el estado del repo eran a veces de segunda mano: cuando dijo que `docker-compose.final.yml` estaba roto, verifiqué cada punto contra el archivo antes de aceptarlo. El patrón que apliqué durante todo el examen fue no dar por buena ninguna afirmación sobre mi repositorio sin un comando que la respaldara.

---

## 6. Evidencia

| Archivo | Qué demuestra |
|---|---|
| `antes-ruta-protegida-200.txt` | `GET /api/pedidos` con el token → **200 OK**, antes de revocar |
| `despues-logout-200.txt` | `POST /api/auth/logout` → **200** con el `jti` revocado y su TTL |
| `despues-ruta-protegida-401.txt` | **La misma petición con el mismo token** → **401 "Sesion cerrada: este token fue revocado mediante logout"** |
| `despues-casos-borde.txt` | Los tres casos borde: logout sin token → 401; logout dos veces → sin caída; token de otro usuario → sigue en 200. Incluye la clave en Redis y su TTL decreciendo |

**Cómo reproducir mi cambio desde cero:**

```bash
git checkout exam/gsMolina02
docker compose -f docker-compose.final.yml up -d --build

# 1. Login (el token ya trae jti)
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .access_token)

# 2. ANTES: la ruta protegida responde 200
curl -i http://localhost:3000/api/pedidos -H "Authorization: Bearer $TOKEN"

# 3. Cerrar sesion
curl -i -X POST http://localhost:3000/api/auth/logout -H "Authorization: Bearer $TOKEN"

# 4. DESPUES: la MISMA peticion con el MISMO token -> 401 revocado
curl -i http://localhost:3000/api/pedidos -H "Authorization: Bearer $TOKEN"

# 5. La clave y su TTL en Redis
docker exec ms-redis redis-cli --scan --pattern 'jwt:revocado:*'
```

---

## 7. Prueba automatizada

| | |
|---|---|
| **Archivo de la prueba** | `apps/gateway/src/auth/guards/jwt-auth.guard.spec.ts` |
| **Comando para ejecutarla** | `npm test -w gateway` |
| **Qué verifica** | Que el guard rechaza con 401 un token cuyo `jti` está revocado, que acepta uno que no lo está, que el mensaje distingue "revocado" de "inválido/expirado", que las rutas `@Public()` no consultan la lista, y que un token sin `jti` se rechaza |
| **¿Falla sin mi cambio?** | **Sí.** El guard anterior solo delegaba en `super.canActivate()`: con la firma válida devolvía `true` siempre, sin mirar la lista. Lo comprobé revirtiendo `canActivate` a su versión previa (commit `73ef172`): el caso "RECHAZA con 401 un token cuyo jti fue revocado" pasa a devolver `true` en vez de lanzar, y la suite falla. |

```
PASS src/auth/guards/jwt-auth.guard.spec.ts
  JwtAuthGuard — revocacion de sesion (Actividad A)
    √ RECHAZA con 401 un token cuyo jti fue revocado (29 ms)
    √ el mensaje del 401 distingue "revocado" de "token invalido o expirado" (3 ms)
    √ ACEPTA un token vigente cuyo jti NO fue revocado (2 ms)
    √ NO consulta la lista en rutas marcadas con @Public() (3 ms)
    √ RECHAZA un token valido pero sin claim jti (emitido antes del cambio) (2 ms)

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
Time:        3.236 s
```

---

## 8. Estado final — honesto

**Funciona:**
- `jti` único en cada token emitido, verificado decodificando el payload.
- `POST /api/auth/logout` protegido, que revoca solo la sesión presentada.
- El guard existente rechaza tokens revocados con 401 y mensaje distinguible.
- TTL alineado con `exp`, verificado en Redis (3586 s → 3573 s).
- Los tres casos borde de la actividad.
- 5 pruebas automatizadas pasando.

**No funciona / quedó incompleto:**
- La política de fallo cerrado ante caída de Redis **está implementada pero no la probé en vivo** apagando el contenedor de Redis. El comportamiento está razonado y cubierto por el `try/catch`, pero no tengo evidencia de ejecución de ese caso concreto.
- El `.env.example` no documenta que el gateway ahora necesita `REDIS_HOST`/`REDIS_PORT`; lo añadí solo al `docker-compose.final.yml`.
- Los otros dos composes (`docker-compose.yml` y `docker-compose.transportes.yml`) no recibieron las variables de Redis para el gateway. El sistema del examen se levanta con el compose final, pero si alguien usa los otros, el logout fallará al conectar.

**Cuál era mi siguiente paso:**

Apagar `ms-redis` con el sistema arriba y capturar el 503 del guard para tener evidencia del fallo cerrado, y después propagar `REDIS_HOST`/`REDIS_PORT` del gateway a los otros dos composes y al `.env.example`.

---

## 9. Declaración

> Declaro que este trabajo es individual, que corresponde a la actividad que me fue asignada, y que la sección 5 refleja de forma completa y veraz el uso que hice de herramientas de Inteligencia Artificial durante el examen.

**Nombre:** Stiven Molina
**Fecha:** 27 de julio de 2026
