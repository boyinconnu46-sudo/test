// app.js
import express from "express";
import bodyParser from "body-parser";
import path from "path";
import fs from "fs-extra";
import { fileURLToPath } from "url";
import cors from "cors";
import initializeTelegramBot from "./bot.js";
import { forceLoadPlugins } from "./lib/plugins.js";
import eventlogger from "./lib/handier.js";
import { manager, main, db } from "./lib/client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Configuration CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Headers CORS manuels pour plus de sécurité
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// ensure sessions dir exists
const SESSIONS_DIR = path.join(process.cwd(), "sessions");
await fs.mkdirp(SESSIONS_DIR);

// Utility: format pairing code in groups of 4 (AAAA-BBBB-CCCC)
function fmtCode(raw) {
  if (!raw) return raw;
  // remove whitespace then group
  const s = String(raw).replace(/\s+/g, "");
  const grouped = s.match(/.{1,4}/g);
  return grouped ? grouped.join("-") : s;
}

// Fonction améliorée pour attendre l'ouverture de connexion
async function waitForConnection(sock, sessionId, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      sock.ev.off("connection.update", handler);
      reject(new Error(`Timeout (${timeoutMs}ms) waiting for connection for session ${sessionId}`));
    }, timeoutMs);

    const handler = (update) => {
      const { connection, lastDisconnect, qr } = update || {};
      console.log(`[${sessionId}] Connection update:`, { connection, qr: qr ? 'QR Received' : 'No QR' });

      if (connection === "open") {
        clearTimeout(timeout);
        sock.ev.off("connection.update", handler);
        console.log(`[${sessionId}] Connection opened successfully`);
        resolve({ status: "open", sock });
      } else if (connection === "close") {
        clearTimeout(timeout);
        sock.ev.off("connection.update", handler);
        const err = lastDisconnect?.error || new Error(`Connection closed for session ${sessionId}`);
        console.error(`[${sessionId}] Connection closed:`, err);
        reject(err);
      } else if (qr) {
        console.log(`[${sessionId}] QR code received, connection in progress...`);
        // Ne pas rejeter ici, attendre que la connexion s'ouvre
      }
    };

    sock.ev.on("connection.update", handler);
    
    // Vérifier si déjà connecté
    if (sock.user) {
      clearTimeout(timeout);
      sock.ev.off("connection.update", handler);
      console.log(`[${sessionId}] Already authenticated`);
      resolve({ status: "already_authenticated", sock });
    }
  });
}

// Start a session (if not already running)
app.get("/start/:sessionId", async (req, res) => {
  const sid = req.params.sessionId;
  console.log(`[API] /start called for session: ${sid}`);
  
  try {
    const sock = await manager.start(sid);
    const isRunning = manager.isRunning(sid);
    
    res.json({
      ok: true,
      sessionId: sid,
      running: isRunning,
      message: isRunning ? "Session started successfully" : "Session started but not yet running"
    });
  } catch (e) {
    console.error(`[API] Error starting session ${sid}:`, e);
    res.status(500).json({ 
      ok: false, 
      error: e?.message || String(e),
      code: "SESSION_START_ERROR"
    });
  }
});

// Route principale pour générer le pairing code
app.get("/pair/:num", async (req, res) => {
  const phone = req.params.num;
  console.log(`[API] /pair called for number: ${phone}`);
  
  // Validation du numéro
  if (!/^[0-9]{6,15}$/.test(phone)) {
    console.error(`[API] Invalid phone format: ${phone}`);
    return res.status(400).json({
      ok: false,
      error: "Phone number must be 6-15 digits (without +). Example: 5511999999999",
      code: "INVALID_PHONE_FORMAT"
    });
  }
  
  const cleanNumber = String(phone).replace(/[^0-9]/g, "");
  
  try {
    console.log(`[${cleanNumber}] Starting pairing process...`);
    
    // Vérifier si la session existe déjà
    const existingSession = manager.list().find(s => s.id === cleanNumber);
    console.log(`[${cleanNumber}] Existing session:`, existingSession);
    
    let sock;
    
    if (existingSession && existingSession.running) {
      console.log(`[${cleanNumber}] Using existing running session`);
      sock = manager.get(cleanNumber);
      
      if (!sock) {
        throw new Error("Session exists but socket not found");
      }
    } else {
      // Démarrer une nouvelle session
      console.log(`[${cleanNumber}] Starting new session...`);
      sock = await manager.start(cleanNumber);
      
      if (!sock) {
        throw new Error("Failed to create socket for new session");
      }
      
      // Attendre que la connexion soit prête
      console.log(`[${cleanNumber}] Waiting for connection to be ready...`);
      try {
        await waitForConnection(sock, cleanNumber, 10000);
      } catch (waitErr) {
        console.warn(`[${cleanNumber}] Connection wait warning:`, waitErr.message);
        // Continuer même si le timeout est atteint, le socket peut être utilisable
      }
    }
    
    // Vérifier que la méthode requestPairingCode existe
    if (typeof sock.requestPairingCode !== 'function') {
      console.error(`[${cleanNumber}] Socket methods:`, Object.keys(sock).filter(k => typeof sock[k] === 'function'));
      throw new Error("Pairing not supported by this socket - requestPairingCode method not found");
    }
    
    // Générer le code pairing
    console.log(`[${cleanNumber}] Requesting pairing code...`);
    const rawCode = await sock.requestPairingCode(cleanNumber);
    const formattedCode = fmtCode(rawCode);
    
    console.log(`[${cleanNumber}] Pairing code generated successfully:`, formattedCode);
    
    res.json({
      ok: true,
      sessionId: cleanNumber,
      cleanNumber,
      code: formattedCode,
      rawCode: rawCode,
      message: "Pairing code generated successfully"
    });
    
  } catch (e) {
    console.error(`[${cleanNumber}] Error in /pair endpoint:`, e);
    res.status(500).json({
      ok: false,
      error: e?.message || String(e),
      code: e.code || "PAIRING_ERROR",
      sessionId: cleanNumber,
      suggestion: "Try again in a few seconds or check if the number is valid"
    });
  }
});

// Stop (graceful close, keep creds)
app.post("/stop/:sessionId", async (req, res) => {
  const sid = req.params.sessionId;
  console.log(`[API] /stop called for session: ${sid}`);
  
  try {
    const ok = await manager.stop(sid);
    res.json({ 
      ok, 
      sessionId: sid,
      message: ok ? "Session stopped successfully" : "Session not found or already stopped"
    });
  } catch (e) {
    console.error(`[API] Error stopping session ${sid}:`, e);
    res.status(500).json({ 
      ok: false, 
      error: e?.message || String(e),
      code: "SESSION_STOP_ERROR"
    });
  }
});

// Logout (permanent) - logout + delete creds
app.post("/logout/:sessionId", async (req, res) => {
  const sid = req.params.sessionId;
  console.log(`[API] /logout called for session: ${sid}`);
  
  try {
    const ok = await manager.logout(sid);
    res.json({ 
      ok, 
      sessionId: sid,
      message: ok ? "Session logged out and credentials deleted" : "Session not found"
    });
  } catch (e) {
    console.error(`[API] Error logging out session ${sid}:`, e);
    res.status(500).json({ 
      ok: false, 
      error: e?.message || String(e),
      code: "LOGOUT_ERROR"
    });
  }
});

// Liste des sessions avec détails
app.get("/sessions", (req, res) => {
  console.log(`[API] /sessions called`);
  
  const sessions = manager.list().map(session => ({
    id: session.id,
    running: session.running || false,
    platform: session.platform || "unknown",
    user: session.user ? "Authenticated" : "Not authenticated",
    timestamp: new Date().toISOString()
  }));
  
  res.json({ 
    ok: true,
    sessions,
    count: sessions.length,
    running: sessions.filter(s => s.running).length
  });
});

// Route de santé avec plus d'informations
app.get("/status", (req, res) => {
  console.log(`[API] /status called`);
  
  const sessions = manager.list();
  const runningSessions = sessions.filter(s => s.running).length;
  
  res.json({
    ok: true,
    server: {
      status: "online",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      platform: process.platform,
      node: process.version
    },
    sessions: {
      total: sessions.length,
      running: runningSessions,
      details: sessions.map(s => ({
        id: s.id,
        running: s.running || false,
        user: s.user ? "Yes" : "No"
      }))
    },
    endpoints: {
      pair: "/pair/:number",
      sessions: "/sessions",
      start: "/start/:sessionId",
      stop: "/stop/:sessionId",
      logout: "/logout/:sessionId",
      status: "/status"
    }
  });
});

// Route racine
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Baileys Multi-session WhatsApp Server",
    version: "1.0.0",
    endpoints: {
      pair: "GET /pair/:number - Generate WhatsApp pairing code",
      sessions: "GET /sessions - List all sessions",
      status: "GET /status - Server status",
      start: "GET /start/:sessionId - Start a session",
      stop: "POST /stop/:sessionId - Stop a session",
      logout: "POST /logout/:sessionId - Logout and delete session"
    },
    note: "Use phone numbers without + (e.g., 5511999999999)"
  });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('[API] Global error handler:', err);
  res.status(500).json({
    ok: false,
    error: err.message || 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: `Endpoint ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND'
  });
});

// graceful shutdown
process.on("SIGINT", async () => {
  console.log('Shutting down gracefully...');
  try {
    await db.flush();
    await db.close();
    console.log('Database closed');
  } catch (e) {
    console.error('Error during shutdown:', e);
  }
  process.exit(0);
});

// -- startup
const PORT = process.env.PORT || 3000;

(async function init() {
  try {
    console.log('Initializing server...');
    
    // Initialiser le client principal
    await main({ autoStartAll: false });

    app.listen(PORT, async () => {
      console.log(`✅ Server listening on port ${PORT}`);
      console.log(`🌐 Server URL: http://localhost:${PORT}`);
      
      try {
        // Démarrer toutes les sessions enregistrées
        await manager.startAll();
        await db.ready();
        console.log(`📱 Attempted to start registered sessions`);
        
        // Charger les plugins
        await forceLoadPlugins();
        console.log("🔌 Plugins loaded successfully");
        
        // Initialiser le bot Telegram
        initializeTelegramBot(manager);
        console.log("🤖 Telegram bot initialized");
        
        // Afficher l'état initial
        const sessions = manager.list();
        console.log(`📊 Initial sessions: ${sessions.length} total, ${sessions.filter(s => s.running).length} running`);
        
      } catch (e) {
        console.warn("⚠️ Startup warnings:", e?.message || e);
      }
      
      console.log('\n=== Server Ready ===');
      console.log('Available endpoints:');
      console.log(`  GET  /              - Server info`);
      console.log(`  GET  /status        - Server status`);
      console.log(`  GET  /sessions      - List sessions`);
      console.log(`  GET  /pair/:number  - Generate pairing code`);
      console.log(`  GET  /start/:id     - Start session`);
      console.log(`  POST /stop/:id      - Stop session`);
      console.log(`  POST /logout/:id    - Logout session`);
      console.log('====================\n');
    });
  } catch (err) {
    console.error("❌ Initialization error:", err);
    process.exit(1);
  }
})();
