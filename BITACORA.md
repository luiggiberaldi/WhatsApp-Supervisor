# BITACORA

## Fase 2.5: Supabase + Webhook

## Resumen

Cuatro errores encadenados que impidieron que el webhook test persistiera en
Supabase. Cada uno se encontró secuencialmente durante la depuración.

---

## 1. Proceso viejo en puerto 3000

**Síntoma**: Los cambios en `server.ts` no se reflejaban al probar. El servidor
respondía siempre con el comportamiento anterior.

**Causa**: `npm run dev` levantó un proceso Express que quedó vivo al cerrar la
terminal. Al reiniciar, el nuevo proceso fallaba con `EADDRINUSE` y el viejo
seguía sirviendo.

**Solución**: Matar el proceso antes de reiniciar:
```powershell
Get-Process node | Stop-Process -Force
npm run dev
```

**Lección**: Verificar siempre que no haya procesos zombi en el puerto antes de
depurar (`netstat -ano | findstr :3000`).

---

## 2. "Invalid API key" en webhook test

**Síntoma**: `POST /api/webhooks/evolution/test` retornaba
`{"success":false,"error":"Invalid API key"}`.

**Causa**: `SUPABASE_SERVICE_ROLE_KEY` estaba comentada en `.env`. El backend
caía a `VITE_SUPABASE_ANON_KEY` y creaba el cliente Supabase. Pero el primer
query del webhook (SELECT a `contacts`) fallaba porque la anon key no tenía
permisos.

**Solución parcial 1**: Se agregó `isSupabaseAuthError()` + `localFallback()`
para atrapar el error de auth y degradar graceful. El webhook empezó a retornar
`200` con `status: "local_logged_only_due_to_missing_supabase"`.

**Falso positivo**: `persistenceMode` mostraba `"active"` porque el cliente
Supabase se creaba exitosamente. El error era de autorización (RLS), no de
autenticación.

---

## 3. RLS en contacts bloquea INSERT

**Síntoma**: Después del fix anterior, el primer SELECT funcionaba, pero el
INSERT de contacto nuevo fallaba con
`"new row violates row-level security policy for table \"contacts\""`.

**Causa**: Las políticas de RLS en Supabase solo permiten SELECT para usuarios
`authenticated`. No hay políticas de INSERT/UPDATE para ningún rol. La anon key
(`role = anon`) no puede escribir.

**Solución parcial 2**: Se agregó `handleDbError()` para cubrir los 7 pasos de
Supabase en `processWebhookMessage`. Pero esto no resolvía el problema real —
solo lo exponía con un mensaje más claro.

---

## 4. Selección incorrecta de credencial

**Síntoma**: El backend usaba la anon key para operaciones de escritura que
requieren service_role.

**Causa raíz**: `server/lib/supabase.ts` línea 8:
```typescript
let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
```
`SUPABASE_SERVICE_ROLE_KEY` estaba comentada en `.env` → `undefined` → caía a
anon. No había forma de que el backend usara service_role sin descomentar la key.

**Solución final**:
1. Se descomentó `SUPABASE_SERVICE_ROLE_KEY` en `.env` con la key real.
   La prioridad (`service_role` → `anon`) ya era correcta en el código.
2. Se agregó `supabaseRole` a `server/lib/supabase.ts` para diagnosticar
   qué key está usando efectivamente el backend.
3. Se protegió con `handleDbError()` + `localFallback(step)` cada punto de
   error en `processWebhookMessage`, por si un futuro error de auth ocurre en
   cualquier paso (no solo el primero).
4. Se expuso `supabaseRole` en `GET /api/evolution/status`.

---

## Solución final aplicada

| Archivo | Cambio |
|---------|--------|
| `.env` | `SUPABASE_SERVICE_ROLE_KEY` descomentada con key real |
| `server/lib/supabase.ts` | Exporta `supabaseRole` (`service_role`/`anon`/`none`) |
| `server.ts` | `handleDbError()` protege los 7 pasos SQL; `localFallback(step?)`; `supabaseRole` en status |

### Flujo corregido

```
POST /api/webhooks/evolution/test
  → processWebhookMessage(mockPayload)
  → supabase (service_role key, bypasea RLS)
  → SELECT contacts (OK)
  → INSERT contact (OK, sin RLS)
  → SELECT/INSERT conversation (OK)
  → UPSERT message (OK)
  → INSERT system_event (OK)
  → 200 { success: true, databaseResult: {...} }
```

---

## No repetir — checklist de chequeos obligatorios

Antes de depurar un error en webhooks o Supabase, verificar en orden:

1. **¿Hay un proceso zombi en el puerto?**
   ```powershell
   netstat -ano | findstr :3000
   ```
   Si sí: `Get-Process node | Stop-Process -Force`

2. **¿Qué key usa el backend?**
   ```powershell
   curl http://localhost:3000/api/evolution/status
   ```
   Revisar `supabaseRole`: debe ser `"service_role"` para escritura.

3. **¿La key es válida?**
   Verificar que el valor en `.env` no sea un placeholder
   (`your-*`, `placeholder-*`, `change-me`).

4. **¿El error es de auth o de RLS?**
   - `"Invalid API key"` → auth. Revisar placeholder detection.
   - `"new row violates row-level security policy"` → RLS. Usar service_role.
   - `"relation ... does not exist"` → schema no aplicado. Correr `schema.sql`.

5. **¿El error ocurre en el primer query o en uno posterior?**
   Revisar los logs del servidor: el mensaje incluye el step name
   (`"find contact"`, `"create contact"`, etc.).
   Si es un step posterior, verificar que `handleDbError` lo cubra.

6. **¿El status endpoint miente?**
   `persistenceMode: "active"` solo significa "cliente creado + sin auth errors".
   No significa "todas las queries funcionan". Usar `supabaseRole` para el
   diagnóstico real.

---

## Fase 3.0: Endpoints de lectura para bandeja supervisor

**Fecha**: 2026-05-31
**Estado**: Completado

### Qué se hizo

Se implementaron tres endpoints REST de lectura para que el futuro frontend
supervisor pueda consultar conversaciones y mensajes persistidos en Supabase.

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `server.ts` | Se agregaron 3 nuevas rutas GET en `startServer()` |
| `README.md` | Se documentaron los nuevos endpoints en tabla y sección de testing |
| `BITACORA.md` | Esta entrada |

### Endpoints creados

| Endpoint | Propósito |
|----------|-----------|
| `GET /api/conversations` | Lista conversaciones ordenadas por `last_message_at DESC` con JOIN a `contacts` |
| `GET /api/conversations/:id` | Detalle de una conversación con datos del contacto |
| `GET /api/conversations/:id/messages` | Mensajes de una conversación ordenados por `created_at ASC` con paginación |

### Campos devueltos por endpoint

**GET /api/conversations**:
- conversation: `id`, `contact_id`, `status`, `assigned_to`, `last_message_at`, `last_message_preview`, `unread_count`, `created_at`, `updated_at`
- contact (join): `display_name`, `phone`

**GET /api/conversations/:id**:
- conversation: todos los campos anteriores
- contact (join): `id`, `display_name`, `phone`, `avatar_url`, `created_at`

**GET /api/conversations/:id/messages**:
- message: `id`, `conversation_id`, `contact_id`, `direction`, `content`, `message_type`, `provider_message_id`, `sent_by_user_id`, `status`, `raw_payload`, `created_at`
- pagination: `page`, `limit`, `total`, `pages`

### Errores encontrados

1. **UUID inválido causaba 500 en vez de 404**
   - Al pasar un ID que no es UUID válido (ej. `nonexistent-id`), PostgreSQL
     lanzaba error de tipo y el endpoint devolvía 500.
   - **Solución**: Se agregó validación de formato UUID v4 con regex
     `/^[0-9a-f]{8}-...$/i` al inicio de las rutas `:id`. Si no coincide,
     responde 404 inmediatamente sin consultar Supabase.

### Verificación final

```powershell
# Listar conversaciones
curl http://localhost:3000/api/conversations
# → 200 { data: [{ id, contact_id, status, ..., contact: { display_name, phone } }] }

# Detalle de conversación existente
curl http://localhost:3000/api/conversations/<uuid-real>
# → 200 { data: { id, status, ..., contact: { ... } } }

# Detalle de conversación inexistente
curl http://localhost:3000/api/conversations/<uuid-invalido>
# → 404 { error: "Conversation not found" }

# Mensajes de conversación existente
curl http://localhost:3000/api/conversations/<uuid-real>/messages
# → 200 { data: [{ id, direction, content, ... }], pagination: { page, limit, total, pages } }

# Mensajes de conversación inexistente
curl http://localhost:3000/api/conversations/<uuid-invalido>/messages
# → 404 { error: "Conversation not found" }
```

### No repetir

Al implementar endpoints con parámetros UUID:
- Validar el formato del UUID antes de pasarlo a Supabase/PgREST
- Usar `.maybeSingle()` en vez de `.single()` para evitar errores PGRST116
- En endpoints con paginación, acotar `limit` máximo para evitar abusos (se fijó 100)

---

## Fase 7: Deploy en Producción (Render + Vercel + UptimeRobot)

**Fecha**: 2026-05-31
**Estado**: Completado — archivos de configuración creados. Deploy manual requiere URLs reales.

### Plataformas

| Servicio | Rol | Plan |
|---|---|---|
| Render | Backend (Express API + Webhooks) | Free |
| Vercel | Frontend (React SPA) | Free |
| UptimeRobot | Keep-alive (ping cada 5 min) | Free |

### Archivos creados

| Archivo | Propósito |
|---|---|
| `render.yaml` | Configuración de deploy para Render (build, start, healthcheck, env vars) |
| `vercel.json` | Rewrites de `/api/*` a Render (placeholder `TU_RENDER_URL`) |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `server.ts` | `PORT` usa `process.env.PORT \|\| 3000`. CORS explícito con `allowedOrigins` incluyendo `process.env.FRONTEND_URL` |
| `README.md` | Sección "Despliegue en Producción" reescrita para Render + Vercel + UptimeRobot |
| `vercel.json` | Placeholder cambiado de `TU_RAILWAY_URL` a `TU_RENDER_URL` |

### Archivos eliminados

| Archivo | Razón |
|---|---|
| `railway.json` | Reemplazado por `render.yaml` |

### Decisiones técnicas

1. **Render en vez de Railway**: Render ofrece un free tier más generoso para Node.js (512 MB RAM, incluye PostgreSQL si hiciera falta, HTTP healthcheck nativo). Railway free tier tiene límites más restrictivos de build hours.

2. **render.yaml con `sync: false`**: Las variables de entorno sensibles se marcan con `sync: false` para que Render pida el valor manualmente en el dashboard, sin exponerlo en el repositorio.

3. **CORS explícito**: `allowedOrigins` incluye `localhost:5173` (dev), `localhost:3000` (dev) y `process.env.FRONTEND_URL` (producción). Previene que frontends no autorizados consuman la API.

4. **UptimeRobot para cold start**: Render free tier duerme el servicio después de 15 min sin actividad. UptimeRobot hace ping a `/api/health` cada 5 min para mantenerlo activo. Esto da un tiempo de respuesta consistente (< 2s).

5. **vercel.json con placeholder**: `TU_RENDER_URL` se reemplaza manualmente después del primer deploy de Render. No se hardcodean URLs en el código fuente.

6. **Flujo de URLs**:
   - Render deploy → obtener URL `https://whatsapp-supervisor-api.onrender.com`
   - Editar `vercel.json` con esa URL → commit → push
   - Vercel deploy → obtener URL `https://whatsapp-supervisor.vercel.app`
   - Render: agregar `FRONTEND_URL=https://whatsapp-supervisor.vercel.app`

### Variables de entorno para producción

Ver README.md → "Despliegue en Producción" → "Variables de Entorno para Producción" para tablas completas de Render y Vercel.

### URLs de producción

- Backend (Render): *(pendiente — se genera al hacer deploy)*
- Frontend (Vercel): *(pendiente — se genera al hacer deploy)*
- Repositorio: `https://github.com/luiggiberaldi/WhatsApp-Supervisor`
