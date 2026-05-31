# WhatsApp Supervisor Demo MVP

Aplicación standalone diseñada para demostrar la operación de un equipo comercial compartiendo un mismo número de WhatsApp. Incluye bandeja compartida, chat, asignación de conversaciones a vendedores y un panel de supervisión en tiempo real.

## Arquitectura

- **Frontend**: React + Vite + TailwindCSS. Configurado para funcionar inicialmente de forma local con Zustand (incluye "Modo Demo Local" pre-cargado).
- **Backend**: Express.js con APIs REST. En desarrollo corre separado del frontend (concurrently). En producción sirve los estáticos del build de Vite.
- **Webhook Integration**: Capa separada para ingesta desde ***Evolution API*** (`server/lib/evolution.ts`).

## Cómo instalar y correr en local

1. Clonar el repositorio.
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Ejecutar el entorno de desarrollo:
   ```bash
   npm run dev
   ```
4. Abrir `http://localhost:5173` en el navegador.

## Modo Demo Local

El sistema viene empaquetado con **Zustand Demo Data**.
Al iniciar la aplicación sin configurar variables de entorno reales de Supabase, verás directamente la pantalla de inicio de sesión de Demo. 
- Puedes ingresar como "Marta" para tener vista de Supervisora plena (y ver el dashboard interactivo de métricas).
- Al cambiar mensajes, estos persisten localmente en memoria para mostrar el flujo completo.

## Cómo configurar para Uso Real (Supabase + Evolution)

### 1. Supabase Config
Copia las variables `.env.example` a un archivo `.env` en la raíz.
Asigna tus llaves reales:
```env
VITE_SUPABASE_URL="https://tu_proyecto.supabase.co"
VITE_SUPABASE_ANON_KEY="tu_llave"
```
Aplica el **Esquema Inicial** abriendo la consola SQL de Supabase y copiando el contenido exacto presente en `/supabase/schema.sql`.

### 2. Configurar Evolution API Webhook
En tu instancia de Evolution API, configura tu Global Webhook para enviar eventos al endpoint remoto que expongas del backend Express de esta app:
`POST https://tu-dominio.com/api/webhooks/evolution`

El backend validará el webhook mediante el header `x-webhook-secret` con el valor de `WEBHOOK_SECRET`.
Si el secret no coincide, el endpoint retorna `401 Unauthorized` y no procesa el payload.

Los eventos recomendados a suscribir son `messages.upsert`, `messages.update`.

## Desarrollo de la Integración (Fase 2.5)

- Todo pedido HTTP en `server.ts` se compila junto en un solo binario vía ESBuild para fácil despliegue en Contenedores sin romper las rutas ESM/CJS de React.
- La función de envío a WhatsApp vive desconectada del componente (véase `/server/lib/evolution.ts`), lo que previene que las keys de Evolution salgan del scope del servidor.
- Las claves sensibles (`SUPABASE_SERVICE_ROLE_KEY`, `EVOLUTION_API_KEY`, `WEBHOOK_SECRET`) solo se usan del lado servidor y nunca se exponen al frontend.
- El webhook real valida el secret **antes** de registrar el payload en memoria o procesarlo.
- Los mensajes salientes sin Evolution configurado se registran con estado `failed` (no `received`).

### Mapa de Claves Supabase

| Clave | Dónde se usa | Rol | RLS |
|-------|-------------|-----|-----|
| `VITE_SUPABASE_ANON_KEY` | Frontend (`src/lib/supabase.ts`) y backend como fallback | `anon` | Respetado — solo SELECT si hay políticas públicas |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend (`server/lib/supabase.ts`) como preferente | `service_role` | **Bypass total** — puede INSERT/UPDATE/UPSERT sin políticas |

El frontend usa la **anon key** (pública, va al bundle de Vite). El backend webhook
usa la **service role key** cuando está disponible, porque necesita escribir en
`contacts`, `conversations`, `messages` y `system_events` — operaciones que la
anon key no puede hacer si RLS está activo y no hay políticas de escritura.

Si `SUPABASE_SERVICE_ROLE_KEY` no está configurada (comentada o ausente), el backend
cae automáticamente a `VITE_SUPABASE_ANON_KEY`. Esto funciona para consultas de
lectura, pero las escrituras (INSERT/UPDATE/UPSERT) fallarán con
`"new row violates row-level security policy"`.

### Variables de Entorno Requeridas (.env)

Copia `.env.example` a `.env` y completa SOLO las variables con valores reales.
Las variables con placeholders `"your-*"` **deben reemplazarse o comentarse**.

```env
# Supabase — Obligatorias para modo persistente
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
# SUPABASE_SERVICE_ROLE_KEY=""   # ← Requerida para webhook. Sin ella, escrituras fallan por RLS

# Evolution API — Opcionales (sin ellas opera en modo simulado)
EVOLUTION_API_URL="http://your-evolution-instance.com"
EVOLUTION_API_KEY="your-global-api-key"
EVOLUTION_INSTANCE_NAME="main"

# Seguridad Webhook — Opcional en dev
WEBHOOK_SECRET="my_secure_webhook_secret"
```

> **⚠️  Importante**: Si `SUPABASE_SERVICE_ROLE_KEY` queda con un valor placeholder
> (ej. `"your-supabase-service-role-key"`), el backend crea un cliente Supabase
> con esa key inválida y **todas las queries fallan** con `"Invalid API key"`.
> Ante la duda, mantenela comentada y el backend usará la anon key.

### Endpoints del Backend

| Endpoint | Uso | Auth requerida | Modo fallback |
|---|---|---|---|---|
| `GET /api/health` | Healthcheck simple | No | — |
| `GET /api/evolution/status` | Diagnóstico de configuración (variables, modo persistencia, supabaseRole, último webhook) | No | — |
| `GET /api/conversations` | Lista conversaciones activas con datos del contacto | No | — |
| `GET /api/conversations/:id` | Detalle de una conversación con datos del contacto | No | — |
| `GET /api/conversations/:id/messages` | Mensajes de una conversación (paginados) | No | — |
| `POST /api/webhooks/evolution` | Webhook real de Evolution API (`messages.upsert`) | Header `x-webhook-secret` (si `WEBHOOK_SECRET` está definido) | Sí: si Supabase falla, opera en local |
| `POST /api/webhooks/evolution/test` | Simulador local de webhook (no requiere Evolution real) | No | Sí: idéntico al real |
| `POST /api/messages/send` | Proxy de envío outbound (frontend → backend → Evolution API) | No | Sí: registra como `"failed"` si no hay Evolution |

### Cómo probar la integración en Local

#### 1. Correr el servidor
Arranca la consola local con:
```bash
npm run dev
```

#### 2. Consultar el estado del backend o diagnóstico
Abre una terminal o tu navegador en:
`http://localhost:3000/api/evolution/status`

Ejemplo de respuesta:
```json
{
  "environment": {
    "evolutionApiUrlConfigured": true,
    "supabaseConfigured": true,
    "persistenceMode": "active",
    "supabaseRole": "service_role"
  }
}
```

#### 3. Simular un mensaje entrante (Webhook) con `curl`
Puedes simular que un cliente real te escribió por WhatsApp enviando este comando `curl` (o usando un cliente como Postman/Thunder Client):

```bash
curl -X POST http://localhost:3000/api/webhooks/evolution/test \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5491122334455",
    "text": "Hola! Me interesa la oferta de consultoría comercial.",
    "senderName": "Eduardo Pérez"
  }'
```

Este comando simulará internamente el webhook exacto de Evolution. El procesador intentará las siguientes operaciones en Supabase. Si Supabase no está disponible o la key es inválida, **fallback automático a modo local** (la respuesta indicará `status: "local_logged_only_due_to_missing_supabase"`):
1. Buscará o creará al contacto "Eduardo Pérez" con número `5491122334455`.
2. Buscará o iniciará una conversación/ticket activo para este lead en estado `new` (Sin Asignar).
3. Insertará el mensaje entrante con estado `received` y asociará el payload.
4. Generará un evento de sistema auditando la entrada.
5. Incrementará el contador de no leídos (`unread_count`).

#### 4. Probar envío de mensajes salientes (Proxy seguro)
Para enviar un mensaje saliente simulando la respuesta del agente a través de la API (encriptando y asegurando la API Key en el servidor):

```bash
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5491122334455",
    "text": "Estimado Eduardo, con todo gusto podemos agendar una sesión inicial mañana."
  }'
```

El backend mandará el request real a Evolution API si las variables están configuradas, y dejará asentado el log e inserción relacional de salida en la persistencia de Supabase.

> **Nota**: Los ejemplos con `curl` usan `localhost:3000` (API directa). Si accedés desde el frontend en `localhost:5173`, el proxy de Vite redirige automáticamente `/api/*` al backend, por lo que no necesitás preocuparte por CORS.

#### 5. Leer conversaciones y mensajes persistidos
Después de simular mensajes entrantes o salientes, podés leer los datos
persistidos en Supabase a través de los nuevos endpoints de lectura:

```bash
# Listar todas las conversaciones
curl http://localhost:3000/api/conversations

# Detalle de una conversación específica (reemplazar <id> con un UUID real)
curl http://localhost:3000/api/conversations/<id>

# Mensajes de una conversación (paginación opcional: ?page=1&limit=50)
curl http://localhost:3000/api/conversations/<id>/messages
```

El endpoint `GET /api/conversations/:id/messages` acepta parámetros de
paginación: `?page=1&limit=50` (máximo 100 por página).

#### 6. Probar el webhook real con secret (si tenés Evolution configurada)
```bash
curl -X POST http://localhost:3000/api/webhooks/evolution \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: my_secure_webhook_secret" \
  -d '{"event":"messages.upsert","data":{"key":{"remoteJid":"5491122334455@s.whatsapp.net","fromMe":false,"id":"test_001"},"message":{"conversation":"Hola desde el webhook real"},"messageType":"conversation","messageTimestamp":'$(date +%s)',"pushName":"Test Real","status":"RECEIVED"}}'
```

## Troubleshooting

### "Invalid API key" al llamar al webhook test o send
**Causa más probable**: `SUPABASE_SERVICE_ROLE_KEY` tiene un valor placeholder
(`"your-supabase-service-role-key"`) en el `.env`. El backend lo toma como key válida,
crea el cliente Supabase, y al hacer la primera query Supabase la rechaza.

**Solución**: Abrir `.env` y comentar o eliminar `SUPABASE_SERVICE_ROLE_KEY`.
El backend usará `VITE_SUPABASE_ANON_KEY` automáticamente.

**Verificación**: Correr `curl http://localhost:3000/api/evolution/status` y verificar
que `persistenceMode` sea `"active"` y `supabaseRole` sea `"anon"`.

### El webhook test responde 200 pero con "local_logged_only_due_to_missing_supabase"
**Causa**: Supabase no está configurado (key faltante o placeholder detectado).
El backend opera en **modo local** — las operaciones se registran en memoria pero
no persisten.

**Solución**: Si querés persistencia real, configura `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY` con valores reales de tu proyecto Supabase.
Si estás en desarrollo temprano, esto es normal y podés seguir trabajando.

### Cannot GET /api/health o el servidor no responde
**Causas posibles**:
- El backend no se levantó correctamente -> revisar la terminal donde corre `npm run dev`.
- Otro proceso ocupa el puerto 3000 -> `npx kill-port 3000` y reiniciar.
- Estás pegándole al puerto 5173 (Vite) en vez de 3000 (Express).
  Recordá: la API vive en `localhost:3000/api/*`. El proxy de Vite la redirige
  automáticamente desde `localhost:5173/api/*`.

### 401 Unauthorized al llamar al webhook real
**Causa**: El endpoint `/api/webhooks/evolution` requiere el header
`x-webhook-secret` con el valor exacto de `WEBHOOK_SECRET`.

**Solución**: Incluir `-H "x-webhook-secret: my_secure_webhook_secret"` en el curl.
Si no querés validación en desarrollo, comentá `WEBHOOK_SECRET` en `.env`.

### El webhook test responde 400 con "new row violates row-level security policy"
**Causa**: El backend está usando la anon key (`supabaseRole: "anon"` en status).
La anon key respeta RLS y el esquema actual solo tiene políticas de SELECT para
`contacts`, no de INSERT/UPDATE. Cualquier escritura desde el webhook falla.

**Solución**: Agregar `SUPABASE_SERVICE_ROLE_KEY` real en `.env`. El backend la
detecta automáticamente y pasa a usar `service_role`, que bypassa RLS.

**Diagnóstico**: Verificar en `GET /api/evolution/status`:
- `supabaseRole` debe mostrar `"service_role"` (no `"anon"`)
- `persistenceMode` muestra `"active"` en ambos casos — no es suficiente para
  diagnosticar este error; `supabaseRole` es el campo clave.

### Diferencia entre webhook real y test
| Aspecto | `/api/webhooks/evolution` | `/api/webhooks/evolution/test` |
|---|---|---|
| Propósito | Producción — recibe callbacks reales de Evolution API | Desarrollo — simula un mensaje entrante |
| Auth | Requiere `x-webhook-secret` (si configurado) | Sin auth |
| Payload | El que envía Evolution API | Lo construye el servidor con `{ phone, text, senderName }` |
| Flujo | Idéntico (processWebhookMessage) | Idéntico (processWebhookMessage) |
| Fallback Supabase | Sí, a local si auth falla | Sí, a local si auth falla |

### Siguientes Pasos (Fase 3)

La Fase 2.5 está completa: persistencia base, webhooks, proxy de mensajes y validaciones funcionando.

Para la **Fase 3** queda pendiente:
- Suscripción en tiempo real mediante Supabase Realtime en el frontend (para que el listado de tickets reaccione instantáneamente al webhook).
- Refinar el inbox de agente/supervisor con indicadores de escritura y entregas.
- Emparejamiento por código QR manual de un número real de producción via Evolution API.
- Autenticación real con Supabase Auth en lugar del login de demo.

