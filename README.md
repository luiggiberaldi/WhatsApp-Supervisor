# WhatsApp Supervisor MVP

Aplicación standalone diseñada para demostrar la operación de un equipo comercial compartiendo un mismo número de WhatsApp. Incluye bandeja compartida, chat, asignación de conversaciones a vendedores y un panel de supervisión en tiempo real.

## Arquitectura

- **Frontend**: React + Vite + TailwindCSS. Configurado para funcionar inicialmente de forma local con Zustand (incluye "Modo Demo Local" pre-cargado).
- **Backend**: Express.js con APIs REST. En desarrollo corre separado del frontend (concurrently). En producción sirve los estáticos del build de Vite.
- **Webhook Integration**: Capa separada para ingesta desde ***Evolution API*** (`server/lib/evolution.ts`).
- **Persistencia**: Supabase (PostgreSQL + Auth + Realtime).
- **Tiempo Real**: Supabase Realtime (canales postgres_changes) con fallback a polling cada 10s.

## Cómo instalar y correr en local

1. Clonar el repositorio.
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Copiar `.env.example` a `.env` y configurar variables (ver sección Variables de Entorno).
4. Ejecutar el entorno de desarrollo:
   ```bash
   npm run dev
   ```
5. Abrir `http://localhost:5173` en el navegador.

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
VITE_SUPABASE_ANON_KEY="tu_llave_anon"
SUPABASE_SERVICE_ROLE_KEY="tu_llave_service_role"
```

Aplica el **Esquema Inicial** abriendo la consola SQL de Supabase y copiando el contenido exacto presente en `/supabase/schema.sql`.

### 2. Habilitar Realtime en Supabase

Para que las suscripciones en tiempo real funcionen:

1. Ir a Supabase Dashboard → Database → Replication.
2. Habilitar Realtime para las tablas `conversations` y `messages`.
3. Las suscripciones del frontend usan `postgres_changes` con el cliente autenticado (anon key + sesión de Supabase Auth).

### 3. Crear usuario en Supabase Auth

1. Ir a Supabase Dashboard → Authentication → Users.
2. Click "Add User" e ingresar email y contraseña.
3. El perfil (tabla `profiles`) se crea automáticamente al primer inicio de sesión con rol `agent` por defecto.
4. Para asignar rol `supervisor`, actualizar manualmente en la tabla `profiles`:
   ```sql
   UPDATE profiles SET role = 'supervisor' WHERE email = 'supervisor@ejemplo.com';
   ```

### 4. Configurar Evolution API Webhook

En tu instancia de Evolution API, configura tu Global Webhook para enviar eventos al endpoint remoto que expongas del backend Express de esta app:
`POST https://tu-dominio.com/api/webhooks/evolution`

El backend validará el webhook mediante el header `x-webhook-secret` con el valor de `WEBHOOK_SECRET`.
Si el secret no coincide, el endpoint retorna `401 Unauthorized` y no procesa el payload.

Los eventos recomendados a suscribir son `messages.upsert`, `messages.update`.

## Variables de Entorno Requeridas (.env)

```env
# Supabase — Obligatorias para modo persistente
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"  # Requerida para webhook (bypass RLS)

# Evolution API — Opcionales (sin ellas opera en modo simulado)
EVOLUTION_API_URL="http://your-evolution-instance.com"
EVOLUTION_API_KEY="your-global-api-key"
EVOLUTION_INSTANCE_NAME="main"

# Seguridad Webhook — Opcional en dev
WEBHOOK_SECRET="my_secure_webhook_secret"
```

## Funcionalidades por Fase

### Fase 2.5 — Persistencia y Webhooks
- Webhook de Evolution API con persistencia a Supabase.
- Proxy de envío outbound (frontend → backend → Evolution API).
- Fallback automático a modo local si Supabase no está disponible.
- Todas las operaciones DB están guardadas con `handleDbError` + `localFallback`.

### Fase 3.0 — Endpoints de Lectura
- `GET /api/conversations` — lista con datos del contacto.
- `GET /api/conversations/:id` — detalle con contacto completo.
- `GET /api/conversations/:id/messages` — mensajes paginados.

### Fase 4 — Bandeja de Supervisor (UI conectada)
- Lista de conversaciones con filtros y búsqueda.
- Chat con envío de mensajes via API.
- ContactPanel con datos del contacto.
- Routing con React Router.

### Fase 5 — Tiempo Real, Auth y Producción
- **Realtime**: Suscripciones Supabase Realtime para conversaciones y mensajes (sin polling).
- **Auth**: Login real con Supabase Auth (email + password), sesión persistente.
- **Demo fallback**: Si Supabase no está configurado, opera en modo demo completo.
- **unread_count persistente**: `PATCH /api/conversations/:id/read` resetea en DB.
- **Build de producción**: `npm run build` genera frontend + backend listo para deploy.

## Endpoints del Backend

| Endpoint | Uso | Auth requerida |
|---|---|---|
| `GET /api/health` | Healthcheck | No |
| `GET /api/evolution/status` | Diagnóstico de configuración | No |
| `GET /api/conversations` | Lista conversaciones con contacto | No |
| `GET /api/conversations/:id` | Detalle conversación | No |
| `GET /api/conversations/:id/messages` | Mensajes paginados | No |
| `PATCH /api/conversations/:id/read` | Resetear unread_count | No |
| `POST /api/webhooks/evolution` | Webhook real Evolution API | Header `x-webhook-secret` |
| `POST /api/webhooks/evolution/test` | Simulador local de webhook | No |
| `POST /api/messages/send` | Proxy de envío outbound | No |

## Despliegue en Producción

### Build

```bash
npm run build
```

Esto genera:
- `dist/index.html` + `dist/assets/*` — frontend compilado.
- `dist/server.cjs` — backend Express compilado.

### Ejecutar

```bash
node dist/server.cjs
```

El servidor Express escucha en `http://0.0.0.0:3000` y sirve:
- `/api/*` — APIs REST.
- `/*` — frontend SPA (en producción, cuando `NODE_ENV=production`).

### Variables para Producción

```bash
NODE_ENV=production
PORT=3000
VITE_SUPABASE_URL="..."
VITE_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
EVOLUTION_API_URL="..."
EVOLUTION_API_KEY="..."
WEBHOOK_SECRET="..."
```

### Verificar deploy

```bash
# Healthcheck
curl https://tu-dominio.com/api/health

# Estado de configuración
curl https://tu-dominio.com/api/evolution/status
```

### Healthcheck (para orquestadores)

Usar `GET /api/health` — responde con `{ "status": "ok" }` y HTTP 200.

## Desarrollo de la Integración

- Todo pedido HTTP en `server.ts` se compila junto en un solo binario vía ESBuild para fácil despliegue en Contenedores sin romper las rutas ESM/CJS de React.
- La función de envío a WhatsApp vive desconectada del componente (véase `/server/lib/evolution.ts`), lo que previene que las keys de Evolution salgan del scope del servidor.
- Las claves sensibles (`SUPABASE_SERVICE_ROLE_KEY`, `EVOLUTION_API_KEY`, `WEBHOOK_SECRET`) solo se usan del lado servidor y nunca se exponen al frontend.
- El webhook real valida el secret **antes** de registrar el payload en memoria o procesarlo.
- Los mensajes salientes sin Evolution configurado se registran con estado `failed` (no `received`).

### Mapa de Claves Supabase

| Clave | Dónde se usa | Rol | RLS |
|---|---|---|---|
| `VITE_SUPABASE_ANON_KEY` | Frontend (`src/lib/supabase.ts`) y backend como fallback | `anon` | Respetado — solo SELECT si hay políticas públicas |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend (`server/lib/supabase.ts`) como preferente | `service_role` | **Bypass total** — puede INSERT/UPDATE/UPSERT sin políticas |

### Cómo probar la integración en Local

#### 1. Correr el servidor
```bash
npm run dev
```

#### 2. Consultar el estado del backend
`http://localhost:3000/api/evolution/status`

#### 3. Simular un mensaje entrante (Webhook)
```bash
curl -X POST http://localhost:3000/api/webhooks/evolution/test \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5491122334455",
    "text": "Hola! Me interesa la oferta de consultoría comercial.",
    "senderName": "Eduardo Pérez"
  }'
```

#### 4. Leer conversaciones y mensajes persistidos
```bash
# Listar todas las conversaciones
curl http://localhost:3000/api/conversations

# Detalle de una conversación específica
curl http://localhost:3000/api/conversations/<id>

# Mensajes de una conversación (paginación: ?page=1&limit=50)
curl http://localhost:3000/api/conversations/<id>/messages
```

#### 5. Probar Realtime
1. Abrir `http://localhost:5173` e iniciar sesión.
2. En otra terminal, enviar un webhook de prueba:
   ```bash
   curl -X POST http://localhost:3000/api/webhooks/evolution/test \
     -H "Content-Type: application/json" \
     -d '{"phone": "5491122334455", "text": "Mensaje en tiempo real!", "senderName": "Test"}'
   ```
3. La conversación debería aparecer instantáneamente sin recargar la página.

## Limitaciones Conocidas (Fase 5)

- Realtime requiere que las tablas `conversations` y `messages` tengan Realtime habilitado en Supabase Dashboard.
- El login demo también funciona sin Supabase usando los perfiles precargados.
- Los mensajes entrantes via Realtime no incluyen el nested `contact` object — se muestran con el contact_id crudo hasta que se resuelva el contacto.
- No hay soporte de typing indicators ni read receipts en tiempo real (pendiente para Fase 6).
