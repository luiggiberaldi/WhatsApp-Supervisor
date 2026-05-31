# WhatsApp Supervisor Demo MVP

Aplicación standalone diseñada para demostrar la operación de un equipo comercial compartiendo un mismo número de WhatsApp. Incluye bandeja compartida, chat, asignación de conversaciones a vendedores y un panel de supervisión en tiempo real.

## Arquitectura

- **Frontend**: React + Vite + TailwindCSS. Configurado para funcionar inicialmente de forma local con Zustand (incluye "Modo Demo Local" pre-cargado).
- **Backend / Realtime**: Preparado para Supabase (Auth, RLS, Realtime) y un servidor Express.js Node embebido en el build para proxy de APIs.
- **Webhook Integration**: Capa separada para ingesta desde ***Evolution API*** definida en `server.js`.

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
4. Abrir `http://localhost:3000` en el navegador.

## Modo Demo Local

El sistema viene empaquetado con **Zustand Demo Data**.
Al iniciar la aplicación sin configurar variables de entorno reales de Supabase, verás directamente la pantalla de inicio de sesión de Demo. 
- Puedes ingresar como "Marta" para tener vista de Supervisora plena (y ver el dashboard interactivo de métricas).
- Al cambiar mensajes, estos persisten localmente en memoria para mostrar el flujo completo.

## Cómo configurar para Uso Real (Supabase + Evolution)

### 1. Supabase Config
Copia las variables `.env.example` en un nuevo archivo `.env.local` en la raíz.
Asigna tus llaves reales:
```env
VITE_SUPABASE_URL="https://tu_proyecto.supabase.co"
VITE_SUPABASE_ANON_KEY="tu_llave"
```
Aplica el **Esquema Inicial** abriendo la consola SQL de Supabase y copiando el contenido exacto presente en `/supabase/schema.sql`.

### 2. Configurar Evolution API Webhook
En tu instancia de Evolution API, configura tu Global Webhook para enviar eventos al endpoint remoto que expongas del backend Express de esta app:
`POST https://tu-dominio.com/api/webhooks/evolution`

Los eventos recomendados a suscribir son `messages.upsert`, `messages.update`.

## Desarrollo de la Integración (Fase 2)

- Todo pedido HTTP en `server.ts` se compila junto en un solo binario vía ESBuild para fácil despliegue en Contenedores sin romper las rutas ESM/CJS de React.
- La función de envío a WhatsApp vive desconectada del componente (véase `/server/lib/evolution.ts`), lo que previene que las keys de Evolution salgan del scope del servidor.

### Variables de Entorno Requeridas (.env.local)

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

### Siguientes Pasos (Hacia la Fase 3)
Una vez validada esta base de persistencia y enrutadores de mensajes, procederemos en la Fase 3 a habilitar la suscripción en Tiempo Real mediante Supabase Realtime en el Frontend (para que el listado de tickets reaccione instantáneamente al webhook), refinar el inbox de agente/supervisor y realizar el emparejamiento por código QR manual de un número real de producción.

