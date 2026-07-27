# TAREA 3 — Avance 3 (Final)
## Seguridad (JWT/Guard), observabilidad (Sentry), integración y defensa
**Días 8–10 · Corte día 10 · Exposición · Rúbrica /20**

> Lee primero `GUIA_GENERAL.md`.

### 🎯 Objetivo (en palabras simples)
Cerrar el proyecto con **calidad de producción usando lo visto en clase**: proteger el sistema con **autenticación y autorización JWT** (más un **Guard** en el Gateway), agregar **observabilidad con logs de Sentry**, **integrar todos los microservicios** funcionando juntos, y **exponerlo** ante el jurado.

### 🧱 Qué construir
1. **Autenticación con JWT (tema visto):**
   - Endpoint de **login** que emite un **token JWT** al validar credenciales.
   - Validación del token en las peticiones siguientes.
2. **Autorización con Guard:**
   - Un **Guard** en el Gateway que **protege las rutas**: sin token válido → **401**; sin permiso/rol → **403**.
3. **Observabilidad con Sentry (tema visto):**
   - Integrar **logs de Sentry** para capturar errores y eventos relevantes.
4. **Integración final:**
   - Todos los microservicios y transportes (TCP, Redis, gRPC, segundo transporte) **funcionando juntos** desde el Gateway.

### 🔬 Qué evidenciar (obligatorio)
- **Login → token:** captura de la emisión del JWT.
- **Ruta protegida:** captura de la misma ruta **con token válido (200)** y **sin token / token inválido (401)**; si usan roles, un caso **403**.
- **Sentry:** captura del panel de Sentry mostrando un **error capturado** desde el sistema.
- **Sistema integrado:** demo de una operación que atraviesa varios microservicios/transportes.

### 📝 Qué documentar en el README (sección "Avance 3" + consolidación)
- Diagrama final del sistema integrado.
- Flujo de **autenticación JWT** y qué protege el **Guard**.
- Integración de **Sentry** (qué se registra).
- **Manejo de excepciones** consolidado.
- **Sección "Defensa"** (abajo).

---

## 🎤 Estructura de la EXPOSICIÓN (defensa ante el jurado)
Sugerido **8–10 diapositivas + demo en vivo (10–12 min)**. Debe existir una sección **"Defensa"** en el README con este guion.

1. **Portada:** sistema, integrantes, roles.
2. **Problema y dominio del MVP** (30 s).
3. **Arquitectura general** (diagrama final).
4. **Avance 1 — Latencia y acoplamiento:** síncrono vs asíncrono, el hallazgo con la tabla.
5. **Avance 2 — Comunicación:** gRPC + segundo transporte + manejo de excepciones (tabla comparativa).
6. **Avance 3 — Seguridad y observabilidad:** JWT/Guard + Sentry.
7. **Temas de clase aplicados:** patrones, SOLID, transportes, excepciones (1 slide).
8. **DEMO EN VIVO** (runbook abajo).
9. **Conclusiones y aprendizajes.**
10. **Cierre / Q&A.**

**Runbook de la demo (ensáyenlo):**
```
1. Levantar:          docker compose -f docker-compose.final.yml up -d --build
2. Ver servicios:     docker compose -f docker-compose.final.yml ps
3. Login:             POST /auth/login -> copiar el token JWT
4. Ruta protegida:    GET /api/pedidos SIN token -> 401
                      GET /api/pedidos CON token -> 200
5. Operación integrada: crear un pedido -> ver TCP/gRPC/eventos en acción
6. Provocar un error   -> mostrarlo capturado en el panel de Sentry
```

**Preguntas probables del jurado (prepárenlas):**
- ¿Qué información viaja dentro de un JWT y cómo se valida?
- ¿Qué hace un Guard en NestJS y en qué se diferencia de un middleware?
- ¿Cuál es la diferencia entre autenticación y autorización?
- ¿Por qué eligieron gRPC para ese salto y no TCP/eventos?
- ¿En qué se diferencian los transportes que usaron (TCP, Redis, RabbitMQ/MQTT/NATS, gRPC)?
- ¿Para qué sirve Sentry y qué registran ahí?
- ¿Qué patrones de diseño usa NestJS y cuáles agregaron ustedes?

### ✅ Definición de Terminado
- [ ] **JWT** funcionando (login emite token, se valida en las rutas).
- [ ] **Guard** protegiendo rutas (401 sin token; 403 sin permiso si usan roles).
- [ ] **Sentry** capturando errores (evidencia en el panel).
- [ ] Sistema **integrado** (varios microservicios/transportes en una operación).
- [ ] README **final** consolidado + sección Defensa + **tag `v3-final`**.
- [ ] Exposición ensayada con demo en vivo.

### 🚫 Qué NO necesitan
- Nada de clúster, balanceo, réplicas ni self-healing. Solo **JWT/Guard + Sentry + integración**, todo visto en clase.

### 🧪 Recursos de esta tarea
- `tarea-3/docker-compose.final.yml` — sistema integrado con variables para JWT y Sentry.

---

## 📊 Rúbrica — Tarea 3 (20 pts)
> Cada criterio: **1, 2, 3 o 5**. Bruto máx 25 → **Nota /20 = suma × 0.8** (1→0.8 · 2→1.6 · 3→2.4 · 5→4.0).

| Criterio | Nivel 1 | Nivel 2 | Nivel 3 | Nivel 5 |
|---|---|---|---|---|
| **C1. Autenticación JWT** | Sin JWT | Emite token pero no lo valida | Login emite token y se valida en las rutas | Flujo JWT completo y bien explicado (emisión, validación, expiración) |
| **C2. Autorización con Guard** | Sin protección | Guard configurado pero no bloquea | Guard protege rutas (401 sin token) | Control fino por rol/permiso (401/403 correctos) demostrado |
| **C3. Observabilidad (Sentry)** | Sin logs | Sentry instalado sin capturar nada | Errores capturados y visibles en el panel | Registro útil (errores + contexto) integrado en varios servicios |
| **C4. Integración final + proceso** | Servicios sueltos | Integración parcial | Sistema integrado + README final + Kanban + tags | Todo funcionando junto, documentación nivel portafolio, Git limpio |
| **C5. Exposición / Defensa** | No exponen o sin demo | Exposición confusa o demo fallida | Exposición clara + demo en vivo funcional | Demo impecable, dominan las preguntas, comunican los hallazgos con seguridad |
