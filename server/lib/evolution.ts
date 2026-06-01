/**
 * Evolution API Integration Module (Server-Side)
 * Implements a clean, decoupled service to handle Evolution API webhook events,
 * format payloads, and trigger outbound messages securely.
 */

// Helper to extract the unique remote JID identifying the chat or sender
export function extractRemoteJid(payload: any): string {
  if (!payload || !payload.data) return "";
  const key = payload.data.key;
  if (!key) return "";
  return key.remoteJid || "";
}

// Cleaner to extract plain phone number from a remote JID (e.g., "5491122334455@s.whatsapp.net" -> "5491122334455")
export function extractPhoneFromJid(jid: string): string {
  if (!jid) return "";
  return jid.split("@")[0];
}

// Extracts text content correctly across multiple message formats of Evolution API
export function extractTextContent(payload: any): string {
  if (!payload || !payload.data) return "";
  const message = payload.data.message;
  if (!message) return "";

  if (typeof message === "string") return message;

  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.extendedTextMessage?.caption) return message.extendedTextMessage.caption;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;

  // Fallback to text inside message if some other subtype provides it
  if (message.text) return message.text;

  return "";
}

// Converts Evolution API messageTimestamp to standard ISO-8601 string used by database
export function extractMessageTimestamp(payload: any): string {
  if (!payload || !payload.data) return new Date().toISOString();

  const ts = payload.data.messageTimestamp || payload.data.key?.messageTimestamp;
  if (!ts) return new Date().toISOString();

  // If time is in seconds (10 digits or less), multiply by 1000
  const ms = ts > 9999999999 ? ts : ts * 1000;
  return new Date(ms).toISOString();
}

// Checks if the incoming webhook contains a supported conversation message event
export function isSupportedIncomingMessage(payload: any): boolean {
  if (!payload) return false;

  // Normalized check for events like "messages.upsert" or "MESSAGES_UPSERT"
  const event = (payload.event || "").toLowerCase();
  const supportedEvents = ["messages.upsert", "messages_upsert", "messages-upsert"];
  if (!supportedEvents.includes(event)) {
    return false;
  }

  const data = payload.data;
  if (!data || !data.key) return false;

  // Filter out outbound events broadcast from our own number to ensure we process real replies
  const isFromMe = data.key.fromMe === true;
  return !isFromMe;
}

// Interface representing our normalized internal message structure
export interface NormalizedMessage {
  phone: string;
  remoteJid: string;
  senderName: string;
  messageId: string;
  content: string;
  timestamp: string;
  direction: "inbound" | "outbound";
  rawPayload: any;
}

// Parses and normalizes incoming message webhook data from Evolution API
export function normalizeEvolutionWebhook(payload: any): NormalizedMessage | null {
  if (!payload || !payload.data) return null;

  const jid = extractRemoteJid(payload);
  const phone = extractPhoneFromJid(jid);
  const senderName = payload.data.pushName || payload.data.key?.participant || "Contacto WhatsApp";
  const messageId = payload.data.key?.id || `prov_${Date.now()}`;
  const content = extractTextContent(payload);
  const timestamp = extractMessageTimestamp(payload);

  const fromMe = payload.data.key?.fromMe === true;
  const direction = fromMe ? "outbound" : "inbound";

  return {
    phone,
    remoteJid: jid,
    senderName,
    messageId,
    content,
    timestamp,
    direction,
    rawPayload: payload,
  };
}

// Constructs standard payload structure acceptable by Evolution API for outbound messages
export function buildOutboundPayload(to: string, text: string) {
  const cleanNumber = to.replace(/[^0-9]/g, "");
  return {
    number: cleanNumber,
    text: text,
  };
}

// Dispatches a message to Evolution API using configured environment settings
export async function sendTextMessage(to: string, text: string): Promise<any> {
  const evolutionUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "main";

  if (!evolutionUrl || !apiKey) {
    throw new Error("Missing Evolution API configurations (EVOLUTION_API_URL or EVOLUTION_API_KEY)");
  }

  const baseUrl = evolutionUrl.replace(/\/$/, "");
  const url = `${baseUrl}/message/sendText/${instanceName}`;
  const payload = buildOutboundPayload(to, text);

  console.log(`[Evolution Outbound] POST ${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Evolution Outbound] Failed ${response.status}:`, errorText);
    throw new Error(`Evolution API send failed (${response.status}): ${errorText}`);
  }

  const responseData = await response.json();
  console.log("[Evolution Outbound] Sent successfully");
  return responseData;
}

// Queries the real-time connection state of the Evolution instance
export async function getConnectionState(): Promise<any> {
  const evolutionUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "main";

  if (!evolutionUrl || !apiKey) {
    return { state: "unconfigured", error: "Missing EVOLUTION_API_URL or EVOLUTION_API_KEY" };
  }

  const baseUrl = evolutionUrl.replace(/\/$/, "");
  const url = `${baseUrl}/instance/connectionState/${instanceName}`;

  try {
    const response = await fetch(url, {
      headers: { "apikey": apiKey },
    });
    if (!response.ok) {
      const text = await response.text();
      return { state: "error", status: response.status, detail: text };
    }
    return await response.json();
  } catch (err: any) {
    return { state: "unreachable", error: err.message };
  }
}

// Configures the webhook URL that Evolution will call for this instance
export async function setWebhookUrl(webhookUrl: string, webhookSecret?: string): Promise<any> {
  const evolutionUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "main";

  if (!evolutionUrl || !apiKey) {
    return { success: false, error: "Missing EVOLUTION_API_URL or EVOLUTION_API_KEY" };
  }

  const baseUrl = evolutionUrl.replace(/\/$/, "");
  const url = `${baseUrl}/webhook/set/${instanceName}`;

  const body: any = {
    url: webhookUrl,
    enabled: true,
    webhookByEvents: false,
    webhookBase64: false,
    events: ["messages.upsert"],
  };

  if (webhookSecret) {
    body.webhookHeaders = { "x-webhook-secret": webhookSecret };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return { success: response.ok, status: response.status, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
