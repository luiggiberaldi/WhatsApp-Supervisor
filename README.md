# WhatsApp Supervisor Demo MVP

Aplicación standalone diseñada para demostrar la operación de un equipo comercial compartiendo un mismo número de WhatsApp. Incluye bandeja compartida, chat, asignación de conversaciones a vendedores y un panel de supervisión en tiempo real.

## Arquitectura

- **Frontend**: React + Vite + TailwindCSS. Configurado para funcionar inicialmente de forma local con Zustand (incluye "Modo Demo Local" pre-cargado).
- **Backend / Realtime**: Preparado para Supabase (Auth, RLS, Realtime) y un servidor Express.js Node embebido en el build para proxy de APIs.
- **Webhook Integration**: Capa separada para ingesta desde ***Evolution API*** definida en `server.ts`.

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

### Variables de Entorno Requeridas (.env)

```env
# Supabase
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" # Altamente recomendado para bypassed de RLS en webhooks

# Evolution API
EVOLUTION_API_URL="http://your-evolution-instance.com"
EVOLUTION_API_KEY="your-global-api-key"
EVOLUTION_INSTANCE_NAME="main"

# Seguridad Webhook
WEBHOOK_SECRET="my_secure_webhook_secret"
```

### Endpoints del Backend

- **GET `/api/health`**: Estado de vitalidad del backend.
- **GET `/api/evolution/status`**: Panel de diagnóstico técnico en formato JSON que detalla la configuración del backend, si las claves están configuradas y información sobre el último webhook procesado.
- **POST `/api/webhooks/evolution`**: Endpoint real para ingesta de callbacks de Evolution API (`messages.upsert`).
- **POST `/api/webhooks/evolution/test`**: **Simulador Local**. Te permite simular un webhook entrante de Evolution de forma programática sin tener una instancia física conectada.
- **POST `/api/messages/send`**: Proxy seguro que recibe un mensaje saliente del cliente web y lo despacha a la API de Evolution de forma invisible.

### Cómo probar la integración en Local

#### 1. Correr el servidor
Arranca la consola local con:
```bash
npm run dev
```

#### 2. Consultar el estado del backend o diagnóstico
Abre una terminal o tu navegador en:
`http://localhost:3000/api/evolution/status`

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

Este comando simulará internamente el webhook exacto de Evolution. Nuestro procesador realizará secuencialmente las siguientes operaciones reales en Supabase:
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

#### 5. Probar el webhook real con secret (si tenés Evolution configurada)
```bash
curl -X POST http://localhost:3000/api/webhooks/evolution \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: my_secure_webhook_secret" \
  -d '{"event":"messages.upsert","data":{"key":{"remoteJid":"5491122334455@s.whatsapp.net","fromMe":false,"id":"test_001"},"message":{"conversation":"Hola desde el webhook real"},"messageType":"conversation","messageTimestamp":'$(date +%s)',"pushName":"Test Real","status":"RECEIVED"}}'
```

### Siguientes Pasos (Fase 3)

La Fase 2.5 está completa: persistencia base, webhooks, proxy de mensajes y validaciones funcionando.

Para la **Fase 3** queda pendiente:
- Suscripción en tiempo real mediante Supabase Realtime en el frontend (para que el listado de tickets reaccione instantáneamente al webhook).
- Refinar el inbox de agente/supervisor con indicadores de escritura y entregas.
- Emparejamiento por código QR manual de un número real de producción via Evolution API.
- Autenticación real con Supabase Auth en lugar del login de demo.

