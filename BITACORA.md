# BITACORA — Fase 2.5: Supabase + Webhook

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
