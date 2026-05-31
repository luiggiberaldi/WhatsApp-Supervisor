import express, { Request, Response } from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables immediately
dotenv.config();

import { 
  isSupportedIncomingMessage, 
  normalizeEvolutionWebhook, 
  sendTextMessage 
} from "./server/lib/evolution.js";
import { supabase, supabaseRole } from "./server/lib/supabase.js";

const PORT = parseInt(process.env.PORT || "3000", 10);

process.on('uncaughtException', (err) => {
  console.error('💥 [Process] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 [Process] Unhandled rejection:', reason);
});

// Memory stores for live diagnostic tracing on the server
let lastWebhookReceivedAt: string | null = null;
let lastWebhookPayload: any = null;
let webhookReceiptCount = 0;
let supabaseAuthFailures = 0; // incremented when processWebhookMessage falls back due to auth error

/**
 * Reusable core workflow to process a valid normalized or mock webhook event.
 * Resolves contact, open ticket/conversations, writes messages, and issues system events.
 */
async function processWebhookMessage(payload: any): Promise<{ success: boolean; data?: any; error?: string }> {
  // 1. Confirm format is supportable
  if (!isSupportedIncomingMessage(payload)) {
    return { success: false, error: "Unsupported incident event type or message from standard outbound sender" };
  }

  // 2. Extract and normalize
  const normalized = normalizeEvolutionWebhook(payload);
  if (!normalized) {
    return { success: false, error: "Incorrect or unrecognizable payload structure" };
  }

  const { phone, senderName, messageId, content, timestamp, direction, rawPayload } = normalized;

  // Helper: if Supabase auth fails at any point, fall back to local-only mode
  const isSupabaseAuthError = (err: any) => {
    const msg = err?.message?.toLowerCase() || "";
    return ["invalid api key", "invalid authentication", "unauthorized", "forbidden", "jwt expired"].some(e => msg.includes(e));
  };
  const localFallback = (step?: string) => {
    supabaseAuthFailures++;
    const stepInfo = step ? ` at step "${step}"` : "";
    console.warn(`⚠️ [Webhook DB] Supabase auth failed${stepInfo} (${supabaseAuthFailures}). Falling back to local-only mode.`);
    return { success: true, data: { status: "local_logged_only_due_to_missing_supabase", normalized } };
  };

  const handleDbError = (step: string, error: any, fallbackMsg?: string): { success: boolean; data?: any; error?: string } => {
    if (error && isSupabaseAuthError(error)) return localFallback(step);
    console.error(`❌ [Webhook DB] Error at "${step}":`, error || fallbackMsg || "Unknown error");
    return { success: false, error: (error && error.message) || fallbackMsg || `Failed at ${step}` };
  };

  if (!supabase) {
    console.warn("⚠️ [Webhook Engine Error] Supabase client is uninitialized. Skipping database insertions.");
    return { success: true, data: { status: "local_logged_only_due_to_missing_supabase", normalized } };
  }

  try {
    // 3. Resolve or insert Contact
    let contactId: string;
    const { data: existingContact, error: findContactError } = await supabase
      .from("contacts")
      .select("id, display_name")
      .eq("phone", phone)
      .maybeSingle();

    if (findContactError) {
      return handleDbError("find contact", findContactError);
    }

    if (existingContact) {
      contactId = existingContact.id;
      // Upgrade generic names if we have actual contact pushName now
      if (
        senderName && 
        senderName !== "Contacto WhatsApp" && 
        (existingContact.display_name?.startsWith("Contacto ") || existingContact.display_name === "Contacto WhatsApp" || !existingContact.display_name)
      ) {
        await supabase
          .from("contacts")
          .update({ display_name: senderName, updated_at: new Date().toISOString() })
          .eq("id", contactId);
      }
    } else {
      const { data: newContact, error: createContactError } = await supabase
        .from("contacts")
        .insert({ phone, display_name: senderName })
        .select("id")
        .single();

      if (createContactError || !newContact) {
        return handleDbError("create contact", createContactError, "Failed to create contact");
      }
      contactId = newContact.id;
    }

    // 4. Resolve or create active Conversation
    const { data: activeConvs, error: findConvError } = await supabase
      .from("conversations")
      .select("*")
      .eq("contact_id", contactId)
      .neq("status", "closed");

    if (findConvError) {
      return handleDbError("find conversation", findConvError);
    }

    let conversation: any;
    if (activeConvs && activeConvs.length > 0) {
      conversation = activeConvs[0];
    }

    if (!conversation) {
      // Spawn new incoming ticket
      const { data: newConv, error: createConvError } = await supabase
        .from("conversations")
        .insert({
          contact_id: contactId,
          status: "new",
          last_message_at: timestamp,
          last_message_preview: content,
          unread_count: 1,
        })
        .select("*")
        .single();

      if (createConvError || !newConv) {
        return handleDbError("create conversation", createConvError, "Failed to create conversation");
      }
      conversation = newConv;
    } else {
      // Update existing conversation summaries and increment unread answers
      const { data: updatedConv, error: updateConvError } = await supabase
        .from("conversations")
        .update({
          last_message_at: timestamp,
          last_message_preview: content,
          unread_count: (conversation.unread_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversation.id)
        .select("*")
        .single();

      if (updateConvError || !updatedConv) {
        return handleDbError("update conversation", updateConvError, "Failed to update conversation");
      }
      conversation = updatedConv;
    }

    // 5. Place Message Inbound (guarded by upsert for idempotent safety)
    const { data: insertedMessage, error: insertMsgError } = await supabase
      .from("messages")
      .upsert({
        conversation_id: conversation.id,
        contact_id: contactId,
        direction: "inbound",
        content: content,
        message_type: "text",
        provider_message_id: messageId,
        status: "received",
        raw_payload: rawPayload,
        created_at: timestamp,
      }, { onConflict: "provider_message_id" })
      .select("*")
      .single();

    if (insertMsgError) {
      return handleDbError("upsert message", insertMsgError);
    }

    // 6. Register auditing System Event
    const { error: systemEventError } = await supabase
      .from("system_events")
      .insert({
        conversation_id: conversation.id,
        event_type: "message_received",
        payload: {
          messageId,
          phone,
          senderName,
          timestamp,
        },
      });

    if (systemEventError) {
      if (isSupabaseAuthError(systemEventError)) {
        supabaseAuthFailures++;
        console.warn(`⚠️ [Webhook DB] Supabase auth failed at step "system event" (${supabaseAuthFailures}). Falling back to local-only mode.`);
      } else {
        console.error("❌ [Webhook DB] Error registering system event:", systemEventError);
      }
    }

    console.log(`✅ [Webhook Processor] Successfully stored inbound reply for ${phone} (Conv: ${conversation.id})`);
    return { success: true, data: { contactId, conversationId: conversation.id, message: insertedMessage } };

  } catch (error: any) {
    console.error("💥 [Webhook Router] Uncaught failure during extraction:", error);
    return { success: false, error: error.message || "Uncaught processing error" };
  }
}

function startServer() {
  const app = express();

  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL || '',
  ].filter(Boolean);

  app.use(cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }));
  app.use(express.json());

  if (process.env.NODE_ENV !== 'development') {
    app.use((req: Request, _res: Response, next: Function) => {
      console.log(`📨 ${req.method} ${req.path}`);
      next();
    });
  }

  // === Healthcheck ===
  app.get("/api/health", (req: Request, res: Response) => {
    res.json({ status: "ok", service: "WhatsApp Supervisor backend", version: "1.0.0" });
  });

  // === Evolution API Webhooks Entrypoint ===
  app.post("/api/webhooks/evolution", async (req: Request, res: Response) => {
    const payload = req.body;

    // Signature Validation — must pass before any logging
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret) {
      const incomingSecret = req.headers["x-webhook-secret"] ||
                             req.headers["webhook-signature"] ||
                             req.headers["authorization"] ||
                             req.query.token;

      if (incomingSecret !== webhookSecret && incomingSecret !== `Bearer ${webhookSecret}`) {
        console.warn("⚠️ [Webhook Warn] Blocked incoming request due to unauthorized/mismatched callback signature token.");
        return res.status(401).json({ error: "Unauthorized: Invalid webhook secret token" });
      }
    }

    // Save state for diagnostics route (only after validation passes)
    lastWebhookReceivedAt = new Date().toISOString();
    lastWebhookPayload = payload;
    webhookReceiptCount++;

    console.log(`📥 [Webhook Received] Event Count: ${webhookReceiptCount}, Time: ${lastWebhookReceivedAt}`);

    // Process the webhook async to let the response complete instantly
    const result = await processWebhookMessage(payload);
    
    if (!result.success) {
      console.warn(`⚠️ [Webhook Processing Notice] ${result.error || "Event bypassed cleanly"}`);
      // Return 200 to Evolution API so they don't retry and hammer us, but state the mock/bypass details
      return res.status(200).json({ processed: false, reason: result.error });
    }

    return res.status(200).json({ processed: true, data: result.data });
  });

  // === Mock Webhook Simulator Route (Step 9) ===
  app.post("/api/webhooks/evolution/test", async (req: Request, res: Response) => {
    const { text, phone, senderName } = req.body;
    
    console.log("🧪 [Webhook Simulator] Generating artificial incoming WhatsApp conversation event");

    const mockPayload = {
      event: "messages.upsert",
      instance: process.env.EVOLUTION_INSTANCE_NAME || "main",
      data: {
        key: {
          remoteJid: `${phone || "5491122334455"}@s.whatsapp.net`,
          fromMe: false,
          id: `SIMULATOR_${Date.now()}`
        },
        message: {
          conversation: text || "Hola, este es un mensaje mock simulando un webhook de prueba local de WhatsApp!"
        },
        messageType: "conversation",
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: senderName || "Test Lead Simulado",
        status: "RECEIVED"
      }
    };

    lastWebhookReceivedAt = new Date().toISOString();
    lastWebhookPayload = mockPayload;
    webhookReceiptCount++;

    const result = await processWebhookMessage(mockPayload);
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    return res.status(200).json({ 
      success: true, 
      simulated: true, 
      payload: mockPayload, 
      databaseResult: result.data 
    });
  });

  // === Dispatch Outbound Message Route Proxy ===
  app.post("/api/messages/send", async (req: Request, res: Response) => {
    const { conversationId, text, to } = req.body;

    if (!to || !text) {
      return res.status(400).json({ error: "Required fields 'to' and 'text' are missing." });
    }

    console.log(`📤 [Command Router] Outbox request to deliver text outbound. Target Number: ${to}`);

    try {
      let evolutionResponse: any = null;
      let databaseMessageId = `manual_out_${Date.now()}`;
      let usingRealSender = false;

      // Check if Evolution config is fully wired up - otherwise fallback gracefully to database-only log
      if (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY) {
        try {
          evolutionResponse = await sendTextMessage(to, text);
          if (evolutionResponse?.key?.id) {
            databaseMessageId = evolutionResponse.key.id;
          }
          usingRealSender = true;
        } catch (evolutionError: any) {
          console.error("❌ [Command Router Error] Evolution delivery failed but continuing to log in DB:", evolutionError.message);
          // Don't crash - let SQL fallback take care of manual dispatch logs for offline trials
        }
      } else {
        console.log("⚙️ [Offline Preview Simulation] Skipping outbox fetch because EVOLUTION_API_URL or EVOLUTION_API_KEY are configured as mockup placeholders.");
      }

      if (!supabase) {
        console.warn("⚠️ [Server Supabase Backup] Warn: DB client is offline. Responding directly.");
        return res.status(200).json({ 
          success: true, 
          simulated: !usingRealSender, 
          messageId: databaseMessageId,
          evolutionResponse 
        });
      }

      // Resolve contact
      const cleanPhone = to.replace(/[^0-9]/g, "");
      let contactId = null;

      const { data: contact } = await supabase
        .from("contacts")
        .select("id")
        .eq("phone", cleanPhone)
        .maybeSingle();

      if (contact) {
        contactId = contact.id;
      } else {
        const { data: newContact } = await supabase
          .from("contacts")
          .insert({ phone: cleanPhone, display_name: `Contacto ${cleanPhone}` })
          .select("id")
          .single();
        if (newContact) contactId = newContact.id;
      }

      // Resolve active conversation
      let targetConvId = conversationId;
      if (!targetConvId && contactId) {
        const { data: existingConvs } = await supabase
          .from("conversations")
          .select("id")
          .eq("contact_id", contactId)
          .neq("status", "closed")
          .limit(1);

        if (existingConvs && existingConvs.length > 0) {
          targetConvId = existingConvs[0].id;
        } else {
          const { data: newConv } = await supabase
            .from("conversations")
            .insert({
              contact_id: contactId,
              status: "assigned",
              last_message_at: new Date().toISOString(),
              last_message_preview: text,
              unread_count: 0
            })
            .select("id")
            .single();
          if (newConv) targetConvId = newConv.id;
        }
      }

      // Record standard Outbound Message Entry
      if (targetConvId && contactId) {
        // Record message
        await supabase
          .from("messages")
          .insert({
            conversation_id: targetConvId,
            contact_id: contactId,
            direction: "outbound",
            content: text,
            message_type: "text",
            provider_message_id: databaseMessageId,
            status: usingRealSender ? "sent" : "failed",
            raw_payload: evolutionResponse || { simulated: true }
          });

        // Touch conversation preview details
        await supabase
          .from("conversations")
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: text,
            unread_count: 0,
            updated_at: new Date().toISOString()
          })
          .eq("id", targetConvId);
      }

      return res.status(200).json({ 
        success: true, 
        simulated: !usingRealSender, 
        messageId: databaseMessageId,
        conversationId: targetConvId,
        evolutionResponse 
      });

    } catch (err: any) {
      console.error("💥 [Command Router Failure] Crash while sending message:", err);
      return res.status(500).json({ error: err.message || "An unexpected issue occurred." });
    }
  });

  // === Conversation Endpoints — lectura para la bandeja del supervisor ===

  // GET /api/conversations — lista todas las conversaciones con datos del contacto
  app.get("/api/conversations", async (req: Request, res: Response) => {
    try {
      if (!supabase) {
        return res.status(503).json({ error: "Supabase not configured" });
      }

      const { data, error } = await supabase
        .from("conversations")
        .select(`
          *,
          contact:contact_id (
            display_name,
            phone
          )
        `)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (error) {
        console.error("❌ [Conversations] Error fetching list:", error);
        return res.status(500).json({ error: "Failed to fetch conversations" });
      }

      // Enrich each conversation with the direction of its most recent message
      if (data && data.length > 0) {
        try {
          const convIds = data.map(c => c.id);
          const { data: lastMsgs } = await supabase
            .from("messages")
            .select("conversation_id, direction, created_at")
            .in("conversation_id", convIds)
            .order("created_at", { ascending: false });

          if (lastMsgs && lastMsgs.length > 0) {
            const dirMap = new Map<string, string>();
            for (const msg of lastMsgs) {
              if (!dirMap.has(msg.conversation_id)) {
                dirMap.set(msg.conversation_id, msg.direction);
              }
            }
            for (const conv of data) {
              (conv as any).last_message_direction = dirMap.get(conv.id) || null;
            }
          }
        } catch (innerErr) {
          console.warn("⚠️ [Conversations] Could not enrich last_message_direction:", innerErr);
          // Non-blocking: conversations are still returned without this field
        }
      }

      console.log(`📋 [Conversations] Returned ${data?.length || 0} conversations`);
      return res.json({ data });
    } catch (err: any) {
      console.error("💥 [Conversations] Uncaught error:", err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // GET /api/conversations/:id — detalle de una conversación con contacto
  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      if (!supabase) {
        return res.status(503).json({ error: "Supabase not configured" });
      }

      const { id } = req.params;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const { data, error } = await supabase
        .from("conversations")
        .select(`
          *,
          contact:contact_id (
            id,
            display_name,
            phone,
            avatar_url,
            created_at
          )
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("❌ [Conversations] Error fetching detail:", error);
        return res.status(500).json({ error: "Failed to fetch conversation" });
      }

      if (!data) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      return res.json({ data });
    } catch (err: any) {
      console.error("💥 [Conversations] Uncaught error:", err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // GET /api/conversations/:id/messages — mensajes de una conversación
  app.get("/api/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      if (!supabase) {
        return res.status(503).json({ error: "Supabase not configured" });
      }

      const { id } = req.params;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 50), 100);
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // Verify conversation exists
      const { data: conv } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", id)
        .maybeSingle();

      if (!conv) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Fetch messages
      const { data, error, count } = await supabase
        .from("messages")
        .select("*", { count: "exact" })
        .eq("conversation_id", id)
        .order("created_at", { ascending: true })
        .range(from, to);

      if (error) {
        console.error("❌ [Conversations] Error fetching messages:", error);
        return res.status(500).json({ error: "Failed to fetch messages" });
      }

      return res.json({
        data,
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: count ? Math.ceil(count / limit) : 0,
        },
      });
    } catch (err: any) {
      console.error("💥 [Conversations] Uncaught error:", err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // === PATCH /api/conversations/:id/read — reset unread_count ===
  app.patch("/api/conversations/:id/read", async (req: Request, res: Response) => {
    try {
      if (!supabase) {
        return res.status(503).json({ error: "Supabase not configured" });
      }

      const { id } = req.params;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const { error } = await supabase
        .from("conversations")
        .update({ unread_count: 0, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        console.error("❌ [Conversations] Error resetting unread_count:", error);
        return res.status(500).json({ error: "Failed to update conversation" });
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error("💥 [Conversations] Uncaught error:", err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // === Debug Configuration/Instance Status Diagnostics Endpoint (Step 8) ===
  app.get("/api/evolution/status", (req: Request, res: Response) => {
    const isUrlStored = !!process.env.EVOLUTION_API_URL;
    const isApiKeyStored = !!process.env.EVOLUTION_API_KEY;
    const hasInstanceStored = !!process.env.EVOLUTION_INSTANCE_NAME;
    const isSecretSet = !!process.env.WEBHOOK_SECRET;
    const supabasePresent = !!supabase;
    const persistenceMode = !supabasePresent ? "local_fallback (no credentials)"
                         : supabaseAuthFailures > 0 ? `local_fallback (${supabaseAuthFailures} auth failure(s))`
                         : "active";

    res.json({
      environment: {
        evolutionApiUrlConfigured: isUrlStored,
        evolutionApiUrl: isUrlStored ? process.env.EVOLUTION_API_URL : "not-set",
        evolutionInstanceName: process.env.EVOLUTION_INSTANCE_NAME || "main",
        evolutionInstanceConfigured: hasInstanceStored,
        apiKeyPresent: isApiKeyStored,
        webhookSecretConfigured: isSecretSet,
        supabaseConfigured: supabasePresent,
        persistenceMode,
        supabaseRole,
      },
      telemetry: {
        totalWebhooksProcessed: webhookReceiptCount,
        lastWebhookReceivedAt: lastWebhookReceivedAt || "never",
        lastWebhookPayload: lastWebhookPayload || null,
      }
    });
  });

  // === Static Production Server (dev frontend is served by Vite separately) ===
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 [Server Boot] Active and listening at http://localhost:${PORT}`);
  });
  server.on('error', (err: any) => {
    console.error(`❌ [Server Boot] Failed to listen on port ${PORT}:`, err.message || err);
  });
}

try {
  startServer();
} catch (error) {
  console.error("❌ [Server Boot Failure] Uncaught startup error:", error);
}
