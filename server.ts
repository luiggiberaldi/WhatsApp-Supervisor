import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";

const PORT = 3000;

async function startServer() {
  const app = express();

  app.use(cors());
  
  // Important: Webhooks need raw JSON
  app.use(express.json());

  // === Healthcheck ===
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // === Evolution API Webhooks ===
  app.post("/api/webhooks/evolution", (req, res) => {
    // This is the webhook reception point.
    // Evolution API sends payloads about messages here.
    const payload = req.body;
    console.log("📥 [Evolution Webhook] Received:", JSON.stringify(payload, null, 2));

    // Here we would use Supabase Admin Client to bypass RLS and insert/update messages.
    // For MVP structure, we just acknowledge receipt to avoid timeouts.
    
    // Example normalizer behavior would happen here before saving to DB.
    res.status(200).json({ success: true });
  });

  // Example mocked "Send Message" wrapper API, to keep Evolution API keys safe
  app.post("/api/messages/send", (req, res) => {
    const { conversationId, text, to } = req.body;
    // In real app, call Evolution API directly
    console.log(`📤 [Evolution API Send Message] To: ${to}, Text: ${text}`);
    res.status(200).json({ success: true, messageId: `msg_${Date.now()}` });
  });

  // === Vite Middleware (Dev) or Static Assets (Prod) ===
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
