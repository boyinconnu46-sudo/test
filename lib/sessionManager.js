import fsPromises from "fs/promises";
import fs from "fs";
import path from "path";
import EventEmitter from "events";
import { DisconnectReason } from "@whiskeysockets/baileys";

class Semaphore {
  constructor(limit) {
    this.limit = limit;
    this.active = 0;
    this.queue = [];
  }
  async acquire() {
    if (this.active < this.limit) {
      this.active++;
      return;
    }
    await new Promise((resolve) => this.queue.push(resolve));
    this.active++;
  }
  release() {
    this.active = Math.max(0, this.active - 1);
    if (this.queue.length) {
      const next = this.queue.shift();
      try {
        next();
      } catch (e) {}
    }
  }
}

export default class SessionManager extends EventEmitter {
  constructor(opts = {}) {
    super();
    if (!opts.createSocket) throw new Error("createSocket option required");
    this.createSocket = opts.createSocket;
    this.db = opts.db;
    this.sessions = new Map();
    this.sessionsDir = path.resolve(opts.sessionsDir || path.join(process.cwd(), "sessions"));
    this.metaFile = path.resolve(opts.metaFile || path.join(process.cwd(), "sessions.json"));
    
    // Enhanced limits for Heroku auto-restart handling
    this.concurrency = opts.concurrency || 10;
    this.semaphore = new Semaphore(this.concurrency);
    this.startDelayMs = typeof opts.startDelayMs === "number" ? opts.startDelayMs : 200;
    this.defaultBackoff = typeof opts.defaultBackoff === "number" ? opts.defaultBackoff : 1000;
    this.maxBackoff = typeof opts.maxBackoff === "number" ? opts.maxBackoff : 120000; // 2 minutes max for Heroku
    this.reconnectLimit = typeof opts.reconnectLimit === "number" ? opts.reconnectLimit : 999; // Almost unlimited for Heroku restarts

    // Force load existing sessions on startup
    try {
      this._loadMetaSync();
      this.ready = Promise.resolve();
    } catch (e) {
      console.warn("session manager: sync meta load failed, falling back to async:", e?.message || e);
      this.ready = this._loadMeta().catch((e2) => {
        console.warn("session manager: failed to load meta", e2?.message || e2);
      });
    }
  }

  _loadMetaSync() {
    try {
      try {
        fs.mkdirSync(this.sessionsDir, { recursive: true });
      } catch (e) { }
      let raw;
      try {
        raw = fs.readFileSync(this.metaFile, "utf-8");
      } catch (e) {
        if (e?.code === "ENOENT") raw = "[]";
        else throw e;
      }
      let list;
      try {
        list = JSON.parse(raw || "[]");
      } catch (e) {
        console.warn("session manager: invalid meta JSON, ignoring (sync)", e?.message || e);
        list = [];
      }
      if (!Array.isArray(list)) list = [];
      for (const id of list) {
        if (!this.sessions.has(id)) {
          this.sessions.set(id, {
            sock: null,
            backoffMs: this.defaultBackoff,
            restarting: false,
            status: "stopped",
            reconnectTimer: null,
            deleted: false,
            reconnectAttempts: 0,
          });
        }
      }
      try {
        this._persistMetaSync();
      } catch (e) {
        this._persistMeta().catch(() => { });
      }
    } catch (e) {
      throw e;
    }
  }

  async _loadMeta() {
    try {
      await fsPromises.mkdir(this.sessionsDir, { recursive: true });
      const raw = await fsPromises.readFile(this.metaFile, "utf-8").catch((e) => {
        if (e?.code === "ENOENT") return "[]";
        throw e;
      });
      let list;
      try {
        list = JSON.parse(raw || "[]");
      } catch (e) {
        console.warn("session manager: invalid meta JSON, ignoring", e?.message || e);
        list = [];
      }
      if (!Array.isArray(list)) list = [];
      for (const id of list) {
        if (!this.sessions.has(id)) {
          this.sessions.set(id, {
            sock: null,
            backoffMs: this.defaultBackoff,
            restarting: false,
            status: "stopped",
            reconnectTimer: null,
            deleted: false,
            reconnectAttempts: 0,
          });
        }
      }
      await this._persistMeta().catch(() => { });
    } catch (e) {
      if (e?.code !== "ENOENT") console.warn("meta load error", e?.message || e);
    }
  }

  async _persistMeta() {
    try {
      const dir = path.dirname(this.metaFile);
      await fsPromises.mkdir(dir, { recursive: true });
      const list = Array.from(this.sessions.keys());
      const tmp = `${this.metaFile}.tmp`;
      await fsPromises.writeFile(tmp, JSON.stringify(list, null, 2), "utf-8");
      let attempts = 0;
      while (attempts < 4) {
        try {
          await fsPromises.stat(tmp);
          await fsPromises.rename(tmp, this.metaFile);
          break;
        } catch (err) {
          attempts++;
          if (attempts >= 4) {
            try {
              console.warn("meta persist fallback: rename failed, writing directly to", this.metaFile);
              await fsPromises.writeFile(this.metaFile, JSON.stringify(list, null, 2), "utf-8");
              break;
            } catch (writeErr) {
              throw err;
            }
          }
          if (err?.code === "ENOENT") {
            try {
              await fsPromises.writeFile(tmp, JSON.stringify(list, null, 2), "utf-8");
            } catch (writeErr) {}
          }
          await new Promise((r) => setTimeout(r, 50 * attempts));
        }
      }
      try {
        const dirFd = fs.openSync(dir, "r");
        fs.fsyncSync(dirFd);
        fs.closeSync(dirFd);
      } catch (e) {}
      this.emit("meta.updated", list);
    } catch (e) {
      console.warn("meta persist error", e?.message || e);
    }
  }

  _persistMetaSync() {
    try {
      const dir = path.dirname(this.metaFile);
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (e) { }
      const list = Array.from(this.sessions.keys());
      const tmp = `${this.metaFile}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(list, null, 2), "utf-8");
      let attempts = 0;
      while (attempts < 4) {
        try {
          if (!fs.existsSync(tmp)) {
            fs.writeFileSync(tmp, JSON.stringify(list, null, 2), "utf-8");
          }
          fs.renameSync(tmp, this.metaFile);
          break;
        } catch (e) {
          attempts++;
          if (attempts >= 4) {
            try {
              console.warn("meta persist fallback: rename failed (sync), writing directly to", this.metaFile);
              fs.writeFileSync(this.metaFile, JSON.stringify(list, null, 2), "utf-8");
              break;
            } catch (writeErr) {
              throw e;
            }
          }
        }
      }
      try {
        const dirFd = fs.openSync(dir, "r");
        fs.fsyncSync(dirFd);
        fs.closeSync(dirFd);
      } catch (e) { }
      this.emit("meta.updated", list);
    } catch (e) {
      try {
        this._persistMeta().catch(() => { });
      } catch (_) { }
      console.warn("meta persist sync error", e?.message || e);
    }
  }

  register(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        sock: null,
        backoffMs: this.defaultBackoff,
        restarting: false,
        status: "stopped",
        reconnectTimer: null,
        deleted: false,
        reconnectAttempts: 0,
      });
    } else {
      const entry = this.sessions.get(sessionId);
      if (entry.deleted) entry.deleted = false;
      if (typeof entry.reconnectAttempts !== "number") entry.reconnectAttempts = 0;
    }
    this._persistMetaSync();
  }

  unregister(sessionId) {
    if (this.sessions.has(sessionId)) {
      const entry = this.sessions.get(sessionId);
      if (entry?.reconnectTimer) {
        try {
          clearTimeout(entry.reconnectTimer);
        } catch { }
        entry.reconnectTimer = null;
      }
      this.sessions.delete(sessionId);
      this._persistMetaSync();
    }
  }

  async start(sessionId) {
    if (this.ready) await this.ready;
    this.register(sessionId);
    const entry = this.sessions.get(sessionId);
    if (!entry) throw new Error("failed to register session");
    if (entry.deleted) {
      throw new Error("session marked deleted; won't start");
    }
    if (entry.status === "starting" || entry.restarting) {
      return entry.sock;
    }
    if (entry.sock) return entry.sock;

    await this.semaphore.acquire();
    try {
      entry.status = "starting";
      this.sessions.set(sessionId, entry);

      let sock;
      try {
        sock = await this.createSocket(sessionId);
      } catch (err) {
        console.warn(`[${sessionId}] createSocket failed:`, err?.message || err);
        entry.status = "stopped";
        entry.sock = null;
        entry.restarting = false;
        this.sessions.set(sessionId, entry);
        throw err;
      }

      entry.sock = sock;
      entry.status = "connected";
      entry.restarting = false;
      entry.backoffMs = this.defaultBackoff;
      entry.reconnectAttempts = 0;

      if (entry.reconnectTimer) {
        try {
          clearTimeout(entry.reconnectTimer);
        } catch { }
        entry.reconnectTimer = null;
      }

      if (sock && sock.ev && typeof sock.ev.on === "function") {
        const safeOn = (ev, handler) => {
          try {
            sock.ev.on(ev, (...args) => {
              Promise.resolve().then(() => handler(...args)).catch((e) => {
                console.warn(`[${sessionId}] event handler ${ev} error:`, e?.message || e);
              });
            });
          } catch (e) {
            console.warn(`[${sessionId}] failed to attach handler ${ev}:`, e?.message || e);
          }
        };

        safeOn("messages.upsert", (m) => this.emit("messages.upsert", sessionId, m));
        safeOn("groups.update", (u) => this.emit("groups.update", sessionId, u));
        safeOn("group-participants.update", (u) => this.emit("group-participants.update", sessionId, u));
        safeOn("creds.update", (u) => this.emit("creds.update", sessionId, u));
        safeOn("connection.update", (update) => this._handleConnectionUpdate(sessionId, update));
      }

      this._persistMeta().catch(() => { });
      this.sessions.set(sessionId, entry);
      return sock;
    } finally {
      try {
        await new Promise((r) => setTimeout(r, this.startDelayMs));
      } catch { }
      this.semaphore.release();
    }
  }

  async startAll() {
    if (this.ready) await this.ready;
    const keys = Array.from(this.sessions.keys());
    const concurrency = this.concurrency;
    for (let i = 0; i < keys.length; i += concurrency) {
      const chunk = keys.slice(i, i + concurrency).map((sid) =>
        this.start(sid).catch((e) => {
          console.warn("startAll chunk error", sid, e?.message || e);
        })
      );
      await Promise.all(chunk);
    }
  }

  async stop(sessionId) {
    const entry = this.sessions.get(sessionId);
    if (!entry) return false;

    if (entry.reconnectTimer) {
      try {
        clearTimeout(entry.reconnectTimer);
      } catch { }
      entry.reconnectTimer = null;
    }

    try {
      entry.status = "stopping";
      try {
        if (typeof entry.sock?.ev?.removeAllListeners === "function") {
          try {
            entry.sock.ev.removeAllListeners();
          } catch { }
        }
        if (typeof entry.sock === "object" && entry.sock !== null) {
          if (typeof entry.sock.logout === "function") {
            await entry.sock.logout();
          } else if (entry.sock.ws) {
            try {
              entry.sock.ws.close();
            } catch { }
          }
        }
      } catch (e) {}
    } finally {
      entry.sock = null;
      entry.status = "stopped";
      this.sessions.set(sessionId, entry);
    }

    return true;
  }

  async logout(sessionId) {
    const entry = this.sessions.get(sessionId);
    if (!entry) return false;

    try {
      if (entry.sock && typeof entry.sock.logout === "function") {
        await entry.sock.logout();
      } else if (entry.sock && entry.sock.ws) {
        try {
          entry.sock.ws.close();
        } catch { }
      }
    } catch (e) {
      console.warn("logout sock err", e?.message || e);
    }

    if (entry.reconnectTimer) {
      try {
        clearTimeout(entry.reconnectTimer);
      } catch { }
      entry.reconnectTimer = null;
    }

    const sessionPath = path.join(this.sessionsDir, sessionId);
    try {
      await fsPromises.rm(sessionPath, { recursive: true, force: true });
    } catch (e) { }

    entry.deleted = true;
    entry.sock = null;
    entry.restarting = false;
    this.sessions.delete(sessionId);

    await this._persistMeta();

    try {
      if (this.db && typeof this.db.logout === "function") {
        await this.db.logout(sessionId);
      }
    } catch (e) {
      console.warn("db.logout failed during logout()", e?.message || e);
    }

    this.emit("loggedOut", sessionId);
    this.emit("session.deleted", sessionId, { reason: "client-initiated-logout" });
    return true;
  }

  isRunning(sessionId) {
    const entry = this.sessions.get(sessionId);
    return !!(entry && entry.sock);
  }

  list() {
    const out = [];
    for (const [k, v] of this.sessions.entries()) {
      out.push({
        sessionId: k,
        status: v.status,
        backoffMs: v.backoffMs,
        reconnectAttempts: v.reconnectAttempts || 0,
      });
    }
    return out;
  }

  getAllConnections() {
    const out = [];
    for (const [sid, entry] of this.sessions.entries()) {
      out.push({
        file_path: sid,
        connection: entry.sock || null,
        healthy: !!entry.sock,
      });
    }
    return out;
  }

  /**
   * Enhanced for Heroku auto-restart handling
   * Only consider real auth errors as permanent disconnects
   * Heroku restarts and network issues are treated as temporary
   */
  _isPermanentDisconnect(lastDisconnect) {
    if (!lastDisconnect) return false;

    const statusCode =
      lastDisconnect?.error?.output?.statusCode ||
      lastDisconnect?.statusCode ||
      lastDisconnect?.error?.statusCode ||
      lastDisconnect?.error?.output?.statusCode;

    const payloadReason =
      lastDisconnect?.error?.output?.payload?.reason ||
      lastDisconnect?.error?.output?.payload?.message ||
      lastDisconnect?.error?.output?.payload?.status ||
      lastDisconnect?.reason ||
      lastDisconnect?.error?.message ||
      lastDisconnect?.message;

    const reasonStr = String(statusCode || payloadReason || "").toLowerCase();

    // PERMANENT DISCONNECTS (real auth errors)
    if (typeof statusCode === "number") {
      if (
        statusCode === DisconnectReason?.loggedOut ||
        statusCode === DisconnectReason?.forbidden ||
        statusCode === DisconnectReason?.badSession
      ) {
        return true;
      }
      if (statusCode === 401 || statusCode === 403) return true;
    }

    // Textual checks for permanent disconnects
    if (
      reasonStr.includes("loggedout") ||
      reasonStr.includes("logged out") ||
      reasonStr.includes("forbidden") ||
      reasonStr.includes("invalid session") ||
      reasonStr.includes("bad session") ||
      reasonStr.includes("invalid credentials") ||
      reasonStr.includes("not authorized") ||
      reasonStr.includes("unauthorized")
    ) {
      return true;
    }

    // Heroku restarts, network issues, timeouts are TEMPORARY
    // These will trigger auto-reconnect
    return false;
  }

  async _handleConnectionUpdate(sessionId, update) {
    const entry = this.sessions.get(sessionId);
    if (!entry) return;

    const { connection, lastDisconnect } = update;
    this.emit("connection.update", sessionId, update);

    const _clearReconnectTimer = (e) => {
      if (e?.reconnectTimer) {
        try {
          clearTimeout(e.reconnectTimer);
        } catch (ex) { }
        e.reconnectTimer = null;
      }
    };

    if (connection === "open") {
      entry.status = "connected";
      entry.backoffMs = this.defaultBackoff;
      entry.restarting = false;
      entry.reconnectAttempts = 0;
      _clearReconnectTimer(entry);
      this.sessions.set(sessionId, entry);
      await this._persistMeta().catch(() => { });
      this.emit("connected", sessionId);
      return;
    }

    if (connection === "close") {
      const isLoggedOut = this._isPermanentDisconnect(lastDisconnect);

      try {
        const statusCode =
          lastDisconnect?.error?.output?.statusCode ||
          lastDisconnect?.statusCode;
        const payloadReason =
          lastDisconnect?.error?.output?.payload?.reason ||
          lastDisconnect?.reason ||
          lastDisconnect?.message;
        console.log(
          `[${sessionId}] connection.close: statusCode=${statusCode}`,
          "reason=",
          payloadReason
        );
      } catch (e) { }

      // Permanent logout: clean up
      if (isLoggedOut) {
        try {
          _clearReconnectTimer(entry);
          entry.sock = null;
          entry.restarting = false;

          const sessionPath = path.join(this.sessionsDir, sessionId);
          await fsPromises.rm(sessionPath, { recursive: true, force: true }).catch(() => { });

          if (this.db && typeof this.db.logout === "function") {
            await this.db.logout(sessionId).catch((e) =>
              console.warn("db.logout failed during handleConnectionUpdate", e?.message || e)
            );
          }
        } catch (e) {
          console.warn("error removing session auth dir", e?.message || e);
        }

        this.sessions.delete(sessionId);
        await this._persistMeta().catch(() => { });

        this.emit("session.deleted", sessionId, {
          reason:
            lastDisconnect?.error?.output?.payload?.reason ||
            lastDisconnect?.error?.output?.statusCode ||
            lastDisconnect?.reason ||
            lastDisconnect?.message,
        });

        this.emit("loggedOut", sessionId);
        return;
      }

      // TEMPORARY DISCONNECT (Heroku restart, network issue)
      // Increment attempts but with very high limit for Heroku
      entry.reconnectAttempts = (entry.reconnectAttempts || 0) + 1;
      this.sessions.set(sessionId, entry);

      // Still have limit but very high for Heroku
      if (entry.reconnectAttempts >= this.reconnectLimit) {
        try {
          _clearReconnectTimer(entry);
          entry.sock = null;
          entry.restarting = false;
          const sessionPath = path.join(this.sessionsDir, sessionId);
          await fsPromises.rm(sessionPath, { recursive: true, force: true }).catch(() => { });
          if (this.db && typeof this.db.logout === "function") {
            await this.db.logout(sessionId).catch((e) =>
              console.warn("db.logout failed when exceeding reconnect limit", e?.message || e)
            );
          }
        } catch (e) {
          console.warn("error removing session auth dir (limit)", e?.message || e);
        }
        this.sessions.delete(sessionId);
        await this._persistMeta().catch(() => { });
        this.emit("session.deleted", sessionId, {
          reason: "reconnect-limit-exceeded",
        });
        this.emit("loggedOut", sessionId);
        return;
      }

      // Schedule auto-reconnect with exponential backoff
      if (!entry.restarting) {
        entry.restarting = true;
        entry.sock = null;
        entry.status = "reconnecting";
        const backoff = entry.backoffMs || this.defaultBackoff;

        const timer = setTimeout(async () => {
          try {
            if (!this.sessions.has(sessionId)) return;
            const curEntry = this.sessions.get(sessionId);
            if (!curEntry) return;
            if (curEntry.status === "connected") return;
            curEntry.restarting = false;
            curEntry.backoffMs = Math.min((curEntry.backoffMs || this.defaultBackoff) * 2, this.maxBackoff);
            this.sessions.set(sessionId, curEntry);
            await this.start(sessionId);
          } catch (e) {
            console.warn(`[${sessionId}] reconnect failed`, e?.message || e);
            const cur = this.sessions.get(sessionId);
            if (cur) cur.restarting = false;
          }
        }, backoff);

        entry.reconnectTimer = timer;
        this.sessions.set(sessionId, entry);
      }
    }
  }
}
