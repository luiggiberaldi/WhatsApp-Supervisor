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

## Desarrollo de la Integración

- Todo pedido HTTP en `server.ts` se compila junto en un solo binario vía ESBuild para fácil depliegue en Contenedores sin romper las rutas ESM/CJS de React.
- La función de envío a WhatsApp vive desconectada del componente (vease `/src/lib/evolution.ts`), lo que previene que las keys de Evolution salgan del scope del servidor.
