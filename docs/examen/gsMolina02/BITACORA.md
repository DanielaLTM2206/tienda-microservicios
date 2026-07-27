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
| **Pull Request** | [#24 — feat(auth): revocacion de sesion JWT — logout real](https://github.com/DanielaLTM2206/tienda-microservicios/pull/24) *(abierto, sin mergear)* |
| **Tarjeta Kanban** | [ShopMS Board → columna `Hecho`](https://github.com/users/DanielaLTM2206/projects/1) — tarjeta `#24`, enlazada al PR |
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

**Principios SOLID aplicados en este cambio**

No los menciono como adorno: cada uno explica una decisión concreta de dónde puse el código.

| Principio | Dónde | Qué implica en la práctica |
|---|---|---|
| **SRP** — Responsabilidad única | `token-revocation.service.ts` | La clase tiene **una sola razón para cambiar**: cómo se almacenan y consultan las sesiones revocadas. No sabe nada de HTTP, de Passport ni de rutas. Por eso el cálculo del TTL y el manejo del fallo de Redis viven ahí y no dentro del guard. |
| **DIP** — Inversión de dependencias | `jwt-auth.guard.ts:36` y `auth.controller.ts` | Ni el guard ni el controlador conocen `ioredis`. Ambos dependen de `TokenRevocationService`, inyectado por el contenedor de Nest. Si mañana la lista se moviera a una tabla de Postgres, **solo cambiaría el cuerpo de ese servicio**: el guard y el logout no se enterarían. |
| **OCP** — Abierto/cerrado | `jwt-auth.guard.ts:53` | El guard se **extiende** con un paso nuevo sin modificar el anterior: la llamada a `super.canActivate()` queda intacta y el paso de revocación se encadena después. La prueba de que es cierto está en la suite: los 2 casos que describen el comportamiento previo (token no revocado → pasa; ruta `@Public()` → ni consulta la lista) **siguen en verde** después del cambio. |

El repositorio ya nombraba SRP, DIP, OCP e ISP en las tablas de patrones de los Avances 1 a 3, así que documentarlos aquí es seguir la convención del equipo, no añadir una capa nueva.

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
| 1 | Le pedí que revisara el proyecto y me ayudara a situar mi actividad: cuál me tocaba y qué le faltaba al repositorio para poder hacerla | Confirmó la Actividad A aplicando la fórmula `((6+2−2) mod 6)+1 = 1`; señaló que el gateway **no tenía cliente Redis** ni recibía `REDIS_HOST` en el compose; y advirtió que el Paso 0 no me aplicaba porque la base de JWT ya existía del Avance 3 | Contrasté la fórmula con el orden alfabético real de mi grupo (Manobanda, Molina, Tituaña → soy P=2) y el diagnóstico de Redis con `grep ioredis apps/gateway/package.json`, que efectivamente no devolvía nada. Lo de Redis fue lo que más me sirvió: era un requisito de infraestructura que no había anticipado y que condicionaba toda la implementación. |
| 2 | Implementar la revocación extendiendo el guard existente | Servicio de revocación en Redis, `POST /auth/logout`, `jti` en el payload y la extensión de `canActivate` | Revisé que **no creara un guard nuevo** (habría violado el anclaje obligatorio). Verifiqué el orden de los pasos: primero firma, después lista de revocados, para no permitir que un anónimo genere consultas a Redis con tokens falsos. |
| 3 | Una prueba automatizada que falle sin el cambio | Test con `jest` que espía el prototipo de `AuthGuard('jwt')` para aislar el paso nuevo | No me bastó con que lo afirmara: revertí `canActivate` a su versión previa y ejecuté la suite yo mismo para verlo fallar. También comprobé que el repo no tenía jest y hubo que configurarlo desde cero. Descarté su primera propuesta de revertir el guard **entero**: como el constructor cambió (ahora recibe `TokenRevocationService`), la prueba ni siquiera compilaría y la evidencia sería un error de TypeScript en vez de fallos de aserción legibles. |
| 4 | Comandos de PowerShell para capturar la evidencia antes/después | Un bloque que pasaba el JSON del login a `curl.exe` con `-d '{"username":...}'` | **Falló en mi máquina.** PowerShell 5.1 altera las comillas dobles al pasarlas a un ejecutable nativo, así que el login recibía JSON inválido, devolvía 401 y el token quedaba vacío — la evidencia salía toda en 401. Lo detecté porque el "antes" daba 401 cuando debía dar 200. La solución fue usar `Invoke-RestMethod` para el login, que serializa el cuerpo de forma nativa, y dejar `curl.exe` solo para las peticiones con cabecera. |

**¿En qué se equivocó respecto a mi repositorio?**

**Caso 1 — durante el examen: ignoró mi entorno real (Windows / PowerShell 5.1).**
Me dio un bloque de comandos para capturar la evidencia que pasaba el JSON del login a `curl.exe` con `-d '{"username":"admin","password":"admin123"}'`. En Linux o en bash eso funciona; en PowerShell 5.1 no, porque altera las comillas dobles al pasarlas a un ejecutable nativo. El login recibía JSON inválido, devolvía 401, y `$T` quedaba vacío. El resultado fue que **la evidencia salió con 401 en el "antes"**, donde debía salir 200:

```
========== 5.1  ANTES DEL LOGOUT ==========
  --> HTTP 401
{"statusCode":401,"message":"No autorizado: No auth token", ...}
```

Lo detecté precisamente porque conocía el comportamiento esperado de mi propio sistema: sabía que un token válido debía dar 200 ahí, así que el 401 solo podía significar que el token no estaba llegando. La corrección fue usar `Invoke-RestMethod` para el login y verificar el token (`$T.Length` → 243) **antes** de continuar, en vez de asumir que la cadena de comandos había funcionado.

Como efecto lateral, ese fallo confirmó de forma accidental el caso borde 1 de mi actividad: el `POST /auth/logout` sin token devolvió 401, es decir, el guard bloqueó una revocación anónima.

**Caso 2 — durante la preparación del Avance 3: una advertencia falsa sobre `bcrypt`.**
Cuando Daniela añadió `bcrypt` al gateway, Claude afirmó que **fallaría al compilar en Alpine** por ser un módulo nativo que requiere `python3`, `make` y `g++`, y recomendó sustituirlo por `bcryptjs`. No acepté la afirmación sin probarla: ejecuté `docker build -f apps/gateway/Dockerfile -t test-gateway .` y el build pasó, y después `docker run --rm test-gateway node -e "require('bcrypt')..."`, que devolvió `bcrypt OK -> true`. La advertencia era incorrecta — `bcrypt` v6 ya distribuye binarios precompilados para musl — y de haberla seguido habría cambiado una dependencia sin ningún motivo.

**El patrón que apliqué en todo el examen** fue no dar por buena ninguna afirmación sobre mi repositorio sin un comando que la respaldara. Cuando dijo que `docker-compose.final.yml` estaba roto, verifiqué cada punto contra el archivo. Cuando dijo que la prueba fallaría sin mi cambio, la ejecuté yo mismo contra el guard anterior en vez de citarlo de palabra.

---

## 6. Evidencia

**Caso antes y después (entregable 5):**

| Archivo | Qué demuestra |
|---|---|
| `evidencia-antes-despues.png` | **Captura única con el antes y el después en la misma sesión de terminal**: el mismo token pasa de 200 a 401 tras el logout. Una sola imagen evita la duda de si se usó otro token en la segunda petición |
| `evidencia-antes-despues.txt` | La misma secuencia en texto, con la lectura del `jti`, del TTL y del mensaje del 401 |
| `antes-ruta-protegida-200.txt` | `GET /api/pedidos` con el token → **200 OK**, antes de revocar (salida completa de `curl -i`) |
| `despues-logout-200.txt` | `POST /api/auth/logout` → **200** con el `jti` revocado y su TTL |
| `despues-ruta-protegida-401.txt` | **La misma petición con el mismo token** → **401 "Sesion cerrada: este token fue revocado mediante logout"** |
| `despues-casos-borde.txt` | Los tres casos borde: logout sin token → 401; logout dos veces → sin caída; token de otro usuario → sigue en 200. Incluye la clave en Redis y su TTL decreciendo |

**Prueba automatizada (entregable 4):**

| Archivo | Qué demuestra |
|---|---|
| `prueba-antes-sin-el-cambio.png` / `.txt` | La suite contra el guard **anterior**: 3 fallos, 2 pasan. Los 3 que fallan son exactamente los del comportamiento nuevo |
| `prueba-despues-con-el-cambio.png` / `.txt` | La misma suite con el cambio aplicado: **5 de 5 pasando** |

**Proceso (entregable 8):**

| Archivo | Qué demuestra |
|---|---|
| `kanban-examen.png` | Tarjeta `#24` en la columna `Hecho` del ShopMS Board, enlazada al Pull Request |

**Cómo reproducir mi cambio desde cero:**

Es el procedimiento que usé realmente, en **PowerShell sobre Windows**. El login va con `Invoke-RestMethod` y no con `curl.exe` por el problema de comillas descrito en la sección 5.

```powershell
git checkout exam/gsMolina02
docker compose -f docker-compose.final.yml up -d --build

# 1. Login — el token ya trae jti
$login = Invoke-RestMethod -Uri http://localhost:3000/api/auth/login `
         -Method Post -ContentType "application/json" `
         -Body '{"username":"admin","password":"admin123"}'
$T = $login.access_token
if (-not $T) { Write-Host "ERROR: token vacio" -ForegroundColor Red }

# 2. ANTES: la ruta protegida responde 200
curl.exe -s -o NUL -w "  --> HTTP %{http_code}`n" http://localhost:3000/api/pedidos -H "Authorization: Bearer $T"

# 3. Cerrar sesion
curl.exe -s -X POST http://localhost:3000/api/auth/logout -H "Authorization: Bearer $T"

# 4. DESPUES: la MISMA peticion con el MISMO token -> 401 revocado
curl.exe -s -o NUL -w "  --> HTTP %{http_code}`n" http://localhost:3000/api/pedidos -H "Authorization: Bearer $T"
curl.exe -s http://localhost:3000/api/pedidos -H "Authorization: Bearer $T"

# 5. La clave y su TTL en Redis
docker exec ms-redis redis-cli --scan --pattern 'jwt:revocado:*'
```

En bash el paso 1 equivale a:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .access_token)
```

---

## 7. Prueba automatizada

| | |
|---|---|
| **Archivo de la prueba** | `apps/gateway/src/auth/guards/jwt-auth.guard.spec.ts` |
| **Comando para ejecutarla** | `npm test -w gateway` |
| **Qué verifica** | Que el guard rechaza con 401 un token cuyo `jti` está revocado, que acepta uno que no lo está, que el mensaje distingue "revocado" de "inválido/expirado", que las rutas `@Public()` no consultan la lista, y que un token sin `jti` se rechaza |
| **¿Falla sin mi cambio?** | **Sí — verificado ejecutándolo, no de palabra.** Restauré el comportamiento del guard anterior (retorno anticipado justo después del paso de Passport, que es lo que hacía el commit `73ef172`) y ejecuté la misma suite sin tocarla: **3 fallan, 2 pasan**. Los 3 que fallan son exactamente los del comportamiento nuevo; los 2 que pasan describen comportamiento que ya existía y que mi cambio no debía romper. |

**Salida SIN mi cambio** (guard anterior) — 3 fallos:

```
 FAIL  src/auth/guards/jwt-auth.guard.spec.ts
    × RECHAZA con 401 un token cuyo jti fue revocado (3 ms)
    × el mensaje del 401 distingue "revocado" de "token invalido o expirado"
    √ ACEPTA un token vigente cuyo jti NO fue revocado
    √ NO consulta la lista en rutas marcadas con @Public() (1 ms)
    × RECHAZA un token valido pero sin claim jti (emitido antes del cambio)

  ● RECHAZA con 401 un token cuyo jti fue revocado

    expect(received).rejects.toThrow()

    Received promise resolved instead of rejected
    Resolved to value: true

    > 56 |     await expect(guard.canActivate(contextoFalso())).rejects.toThrow(

Test Suites: 1 failed, 1 total
Tests:       3 failed, 2 passed, 5 total
```

El mensaje `Resolved to value: true` es la prueba textual del problema que resolví: el guard anterior **dejaba pasar** (devolvía `true`) un token revocado, donde ahora lanza `UnauthorizedException`.

**Salida CON mi cambio** — 5 de 5:

```
PASS src/auth/guards/jwt-auth.guard.spec.ts
  JwtAuthGuard — revocacion de sesion (Actividad A)
    √ RECHAZA con 401 un token cuyo jti fue revocado (8 ms)
    √ el mensaje del 401 distingue "revocado" de "token invalido o expirado" (1 ms)
    √ ACEPTA un token vigente cuyo jti NO fue revocado
    √ NO consulta la lista en rutas marcadas con @Public() (1 ms)
    √ RECHAZA un token valido pero sin claim jti (emitido antes del cambio)

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
Time:        1.765 s
```

---

## 8. Estado final — honesto

**Funciona:**
- `jti` único en cada token emitido, verificado decodificando el payload (ej. `429514be-a37e-4f34-92a0-049a3d2ec565`).
- `POST /api/auth/logout` protegido, que revoca **solo** la sesión presentada.
- El guard existente rechaza tokens revocados con 401 y un mensaje distinguible del de token inválido o expirado.
- **Caso principal verificado de extremo a extremo:** el mismo token, en la misma ruta, pasa de **200 → 401** tras el logout, sin que el cliente haga nada más.
- TTL alineado con `exp`, verificado en Redis (3586 s → 3573 s en consultas sucesivas; 3581 s en la ejecución final).
- Los tres casos borde de la actividad: logout sin token → 401; logout dos veces → sin caída; token vigente de otro usuario → sigue en 200.
- 5 pruebas automatizadas pasando, y verificado que 3 de ellas fallan contra el guard anterior.

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
