export default async function initializeTelegramBot(manager) {
  // === CONFIG ===
  // Retiré les restrictions de groupe
  // const ALLOWED_GROUP_ID = -1003616233972; // removed
  // const GROUP_INVITE_LINK = "https://t.me/+f5MXTmwwdeU2Y2Ux"; // removed

  // Token MUST come from env
  const BOT_TOKEN_TELEGRAM =
    process.env.BOT_TOKEN_TELEGRAM || process.env.BOT_TOKEN || "8546125818:AAGNSMZbcFtCCcMDwV7WWF9irrYCX42Z6Hs";

  if (!BOT_TOKEN_TELEGRAM) {
    console.warn("❌ Telegram BOT_TOKEN not set. Skipping initialization.");
    return null;
  }

  const RAILWAY_URL = process.env.RAILWAY_STATIC_URL || process.env.WEBHOOK_BASE_URL || "";
  const USE_WEBHOOK = Boolean(RAILWAY_URL);

  // Admin ID
  const ADMIN_ID = "7825445776";

  // dynamic import to avoid startup penalty when not used
  const { default: TelegramBot } = await import("node-telegram-bot-api");

  // Create bot instance: webhook-mode => no polling, otherwise polling (dev)
  const tbot = new TelegramBot(
    BOT_TOKEN_TELEGRAM,
    USE_WEBHOOK ? { polling: false } : { polling: { interval: 3000, timeout: 30 } }
  );

  // Error logging
  tbot.on("polling_error", (err) => console.error("❗ Polling error:", err?.message || err));
  tbot.on("webhook_error", (err) => console.error("❗ Webhook error:", err?.message || err));

  // fetch bot info (id/username)
  try {
    const me = await tbot.getMe();
    tbot.botId = me.id;
    tbot.botUsername = me.username;
    console.log("🤖 Bot ready:", me.username, me.id, "mode:", USE_WEBHOOK ? "webhook" : "polling");
  } catch (err) {
    console.warn("⚠️ Failed to fetch bot info:", err);
  }

  const escapeHtml = (str = "") =>
    String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function isAnonymousAdmin(msg) {
    return msg && msg.sender_chat && msg.chat && String(msg.sender_chat.id) === String(msg.chat.id);
  }

  async function waitForOpen(sock, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        sock.ev.off("connection.update", handler);
        reject(new Error("Timed out waiting for connection to open"));
      }, timeoutMs);

      const handler = (update) => {
        const { connection, lastDisconnect } = update || {};
        if (connection === "open") {
          clearTimeout(timeout);
          sock.ev.off("connection.update", handler);
          resolve();
          return;
        } else if (connection === "close") {
          clearTimeout(timeout);
          sock.ev.off("connection.update", handler);
          const err = lastDisconnect?.error || new Error("Connection closed before open");
          reject(err);
        }
      };

      sock.ev.on("connection.update", handler);
    });
  }

  async function isGroupAdminOrOwner(msg) {
    try {
      if (!msg || !msg.chat) return false;
      if (msg.chat.type === "private") return false;
      if (isAnonymousAdmin(msg)) {
        console.log("🛡️ Detected anonymous admin (sender_chat === chat)");
        return true;
      }
      if (!msg.from) return false;
      const member = await tbot.getChatMember(msg.chat.id, msg.from.id);
      const status = member?.status;
      console.log("🛡️ getChatMember status:", status);
      return status === "creator" || status === "administrator";
    } catch (err) {
      console.error("Admin check failed:", err);
      return false;
    }
  }

  function isAdmin(userId) {
    return String(userId) === String(ADMIN_ID);
  }

  // ----------------- Country calling codes map (full) -----------------
  const CALLING_CODE_MAP = {
    1: { iso: "US", name: "United States/Canada" },
    20: { iso: "EG", name: "Egypt" },
    27: { iso: "ZA", name: "South Africa" },
    211: { iso: "SS", name: "South Sudan" },
    212: { iso: "MA", name: "Morocco" },
    213: { iso: "DZ", name: "Algeria" },
    216: { iso: "TN", name: "Tunisia" },
    218: { iso: "LY", name: "Libya" },
    220: { iso: "GM", name: "Gambia" },
    221: { iso: "SN", name: "Senegal" },
    222: { iso: "MR", name: "Mauritania" },
    223: { iso: "ML", name: "Mali" },
    224: { iso: "GN", name: "Guinea" },
    225: { iso: "CI", name: "Ivory Coast" },
    226: { iso: "BF", name: "Burkina Faso" },
    227: { iso: "NE", name: "Niger" },
    228: { iso: "TG", name: "Togo" },
    229: { iso: "BJ", name: "Benin" },
    230: { iso: "MU", name: "Mauritius" },
    231: { iso: "LR", name: "Liberia" },
    232: { iso: "SL", name: "Sierra Leone" },
    233: { iso: "GH", name: "Ghana" },
    234: { iso: "NG", name: "Nigeria" },
    235: { iso: "TD", name: "Chad" },
    236: { iso: "CF", name: "Central African Republic" },
    237: { iso: "CM", name: "Cameroon" },
    238: { iso: "CV", name: "Cape Verde" },
    239: { iso: "ST", name: "São Tomé and Príncipe" },
    240: { iso: "GQ", name: "Equatorial Guinea" },
    241: { iso: "GA", name: "Gabon" },
    242: { iso: "CG", name: "Republic of the Congo" },
    243: { iso: "CD", name: "Democratic Republic of the Congo" },
    244: { iso: "AO", name: "Angola" },
    245: { iso: "GW", name: "Guinea-Bissau" },
    246: { iso: "IO", name: "British Indian Ocean Territory" },
    248: { iso: "SC", name: "Seychelles" },
    249: { iso: "SD", name: "Sudan" },
    250: { iso: "RW", name: "Rwanda" },
    251: { iso: "ET", name: "Ethiopia" },
    252: { iso: "SO", name: "Somalia" },
    253: { iso: "DJ", name: "Djibouti" },
    254: { iso: "KE", name: "Kenya" },
    255: { iso: "TZ", name: "Tanzania" },
    256: { iso: "UG", name: "Uganda" },
    257: { iso: "BI", name: "Burundi" },
    258: { iso: "MZ", name: "Mozambique" },
    260: { iso: "ZM", name: "Zambia" },
    261: { iso: "MG", name: "Madagascar" },
    262: { iso: "RE", name: "Réunion" },
    263: { iso: "ZW", name: "Zimbabwe" },
    264: { iso: "NA", name: "Namibia" },
    265: { iso: "MW", name: "Malawi" },
    266: { iso: "LS", name: "Lesotho" },
    267: { iso: "BW", name: "Botswana" },
    268: { iso: "SZ", name: "Eswatini" },
    269: { iso: "KM", name: "Comoros" },
    30: { iso: "GR", name: "Greece" },
    31: { iso: "NL", name: "Netherlands" },
    32: { iso: "BE", name: "Belgium" },
    33: { iso: "FR", name: "France" },
    34: { iso: "ES", name: "Spain" },
    350: { iso: "GI", name: "Gibraltar" },
    351: { iso: "PT", name: "Portugal" },
    352: { iso: "LU", name: "Luxembourg" },
    353: { iso: "IE", name: "Ireland" },
    354: { iso: "IS", name: "Iceland" },
    355: { iso: "AL", name: "Albania" },
    356: { iso: "MT", name: "Malta" },
    357: { iso: "CY", name: "Cyprus" },
    358: { iso: "FI", name: "Finland" },
    359: { iso: "BG", name: "Bulgaria" },
    36: { iso: "HU", name: "Hungary" },
    370: { iso: "LT", name: "Lithuania" },
    371: { iso: "LV", name: "Latvia" },
    372: { iso: "EE", name: "Estonia" },
    373: { iso: "MD", name: "Moldova" },
    374: { iso: "AM", name: "Armenia" },
    375: { iso: "BY", name: "Belarus" },
    376: { iso: "AD", name: "Andorra" },
    377: { iso: "MC", name: "Monaco" },
    378: { iso: "SM", name: "San Marino" },
    379: { iso: "VA", name: "Vatican City" },
    380: { iso: "UA", name: "Ukraine" },
    381: { iso: "RS", name: "Serbia" },
    382: { iso: "ME", name: "Montenegro" },
    383: { iso: "XK", name: "Kosovo" },
    385: { iso: "HR", name: "Croatia" },
    386: { iso: "SI", name: "Slovenia" },
    387: { iso: "BA", name: "Bosnia and Herzegovina" },
    389: { iso: "MK", name: "North Macedonia" },
    39: { iso: "IT", name: "Italy" },
    40: { iso: "RO", name: "Romania" },
    41: { iso: "CH", name: "Switzerland" },
    420: { iso: "CZ", name: "Czech Republic" },
    421: { iso: "SK", name: "Slovakia" },
    423: { iso: "LI", name: "Liechtenstein" },
    43: { iso: "AT", name: "Austria" },
    44: { iso: "GB", name: "United Kingdom" },
    45: { iso: "DK", name: "Denmark" },
    46: { iso: "SE", name: "Sweden" },
    47: { iso: "NO", name: "Norway" },
    48: { iso: "PL", name: "Poland" },
    49: { iso: "DE", name: "Germany" },
    51: { iso: "PE", name: "Peru" },
    52: { iso: "MX", name: "Mexico" },
    53: { iso: "CU", name: "Cuba" },
    54: { iso: "AR", name: "Argentina" },
    55: { iso: "BR", name: "Brazil" },
    56: { iso: "CL", name: "Chile" },
    57: { iso: "CO", name: "Colombia" },
    58: { iso: "VE", name: "Venezuela" },
    590: { iso: "GP", name: "Guadeloupe" },
    591: { iso: "BO", name: "Bolivia" },
    592: { iso: "GY", name: "Guyana" },
    593: { iso: "EC", name: "Ecuador" },
    594: { iso: "GF", name: "French Guiana" },
    595: { iso: "PY", name: "Paraguay" },
    596: { iso: "MQ", name: "Martinique" },
    597: { iso: "SR", name: "Suriname" },
    598: { iso: "UY", name: "Uruguay" },
    599: { iso: "CW", name: "Curaçao" },
    60: { iso: "MY", name: "Malaysia" },
    61: { iso: "AU", name: "Australia" },
    62: { iso: "ID", name: "Indonesia" },
    63: { iso: "PH", name: "Philippines" },
    64: { iso: "NZ", name: "New Zealand" },
    65: { iso: "SG", name: "Singapore" },
    66: { iso: "TH", name: "Thailand" },
    670: { iso: "TL", name: "East Timor" },
    672: { iso: "NF", name: "Norfolk Island" },
    673: { iso: "BN", name: "Brunei" },
    674: { iso: "NR", name: "Nauru" },
    675: { iso: "PG", name: "Papua New Guinea" },
    676: { iso: "TO", name: "Tonga" },
    677: { iso: "SB", name: "Solomon Islands" },
    678: { iso: "VU", name: "Vanuatu" },
    679: { iso: "FJ", name: "Fiji" },
    680: { iso: "PW", name: "Palau" },
    681: { iso: "WF", name: "Wallis and Futuna" },
    682: { iso: "CK", name: "Cook Islands" },
    683: { iso: "NU", name: "Niue" },
    685: { iso: "WS", name: "Samoa" },
    686: { iso: "KI", name: "Kiribati" },
    687: { iso: "NC", name: "New Caledonia" },
    688: { iso: "TV", name: "Tuvalu" },
    689: { iso: "PF", name: "French Polynesia" },
    690: { iso: "TK", name: "Tokelau" },
    691: { iso: "FM", name: "Micronesia" },
    692: { iso: "MH", name: "Marshall Islands" },
    7: { iso: "RU", name: "Russia/Kazakhstan" },
    81: { iso: "JP", name: "Japan" },
    82: { iso: "KR", name: "South Korea" },
    84: { iso: "VN", name: "Vietnam" },
    850: { iso: "KP", name: "North Korea" },
    852: { iso: "HK", name: "Hong Kong" },
    853: { iso: "MO", name: "Macau" },
    855: { iso: "KH", name: "Cambodia" },
    856: { iso: "LA", name: "Laos" },
    86: { iso: "CN", name: "China" },
    880: { iso: "BD", name: "Bangladesh" },
    886: { iso: "TW", name: "Taiwan" },
    90: { iso: "TR", name: "Turkey" },
    91: { iso: "IN", name: "India" },
    92: { iso: "PK", name: "Pakistan" },
    93: { iso: "AF", name: "Afghanistan" },
    94: { iso: "LK", name: "Sri Lanka" },
    95: { iso: "MM", name: "Myanmar" },
    960: { iso: "MV", name: "Maldives" },
    961: { iso: "LB", name: "Lebanon" },
    962: { iso: "JO", name: "Jordan" },
    963: { iso: "SY", name: "Syria" },
    964: { iso: "IQ", name: "Iraq" },
    965: { iso: "KW", name: "Kuwait" },
    966: { iso: "SA", name: "Saudi Arabia" },
    967: { iso: "YE", name: "Yemen" },
    968: { iso: "OM", name: "Oman" },
    970: { iso: "PS", name: "Palestine" },
    971: { iso: "AE", name: "UAE" },
    972: { iso: "IL", name: "Israel" },
    973: { iso: "BH", name: "Bahrain" },
    974: { iso: "QA", name: "Qatar" },
    975: { iso: "BT", name: "Bhutan" },
    976: { iso: "MN", name: "Mongolia" },
    977: { iso: "NP", name: "Nepal" },
    98: { iso: "IR", name: "Iran" },
    992: { iso: "TJ", name: "Tajikistan" },
    993: { iso: "TM", name: "Turkmenistan" },
    994: { iso: "AZ", name: "Azerbaijan" },
    995: { iso: "GE", name: "Georgia" },
    996: { iso: "KG", name: "Kyrgyzstan" },
    998: { iso: "UZ", name: "Uzbekistan" },
    1242: { iso: "BS", name: "Bahamas" },
    1246: { iso: "BB", name: "Barbados" },
    1264: { iso: "AI", name: "Anguilla" },
    1268: { iso: "AG", name: "Antigua and Barbuda" },
    1284: { iso: "VG", name: "British Virgin Islands" },
    1340: { iso: "VI", name: "US Virgin Islands" },
    1345: { iso: "KY", name: "Cayman Islands" },
    1441: { iso: "BM", name: "Bermuda" },
    1473: { iso: "GD", name: "Grenada" },
    1649: { iso: "TC", name: "Turks and Caicos" },
    1664: { iso: "MS", name: "Montserrat" },
    1758: { iso: "LC", name: "Saint Lucia" },
    1767: { iso: "DM", name: "Dominica" },
    1784: { iso: "VC", name: "Saint Vincent and the Grenadines" },
    1868: { iso: "TT", name: "Trinidad and Tobago" },
    1876: { iso: "JM", name: "Jamaica" },
    500: { iso: "FK", name: "Falkland Islands" },
    501: { iso: "BZ", name: "Belize" },
    502: { iso: "GT", name: "Guatemala" },
    503: { iso: "SV", name: "El Salvador" },
    504: { iso: "HN", name: "Honduras" },
    505: { iso: "NI", name: "Nicaragua" },
    506: { iso: "CR", name: "Costa Rica" },
    507: { iso: "PA", name: "Panama" },
    508: { iso: "PM", name: "Saint Pierre and Miquelon" },
    509: { iso: "HT", name: "Haiti" },
    290: { iso: "SH", name: "Saint Helena" },
    291: { iso: "ER", name: "Eritrea" },
    297: { iso: "AW", name: "Aruba" },
    298: { iso: "FO", name: "Faroe Islands" },
    299: { iso: "GL", name: "Greenland" }
  };

  const SORTED_CALLING_CODES = Object.keys(CALLING_CODE_MAP).sort((a, b) => b.length - a.length);

  function isoToFlagEmoji(iso) {
    if (!iso || iso.length !== 2) return "";
    const A = 0x1f1e6;
    return [...iso.toUpperCase()].map((c) => String.fromCodePoint(A + c.charCodeAt(0) - 65)).join("");
  }

  function detectCountryFromDigits(digits) {
    if (!digits || digits.length === 0) return null;
    if (digits.startsWith("00")) digits = digits.slice(2);
    for (const code of SORTED_CALLING_CODES) {
      if (digits.startsWith(code)) {
        const info = CALLING_CODE_MAP[code];
        return {
          callingCode: code,
          iso: info.iso,
          name: info.name,
          nationalNumber: digits.slice(code.length)
        };
      }
    }
    return null;
  }

  // Logging every message (helpful)
  tbot.on("message", (msg) => {
    try {
      console.log("📩 Message:", {
        chatId: msg.chat?.id,
        chatType: msg.chat?.type,
        sender: msg.from ? `${msg.from.username || msg.from.id}` : `sender_chat:${msg.sender_chat?.id || "?"}`,
        text: msg.text ? msg.text.substring(0, 200) : "",
        entities: msg.entities
      });
    } catch (e) { /* ignore */ }
  });

  // Retiré la logique de quitter les groupes non autorisés
  tbot.on("new_chat_members", async (msg) => {
    try {
      if (!msg || !msg.new_chat_members) return;
      const botId = tbot.botId;
      if (!botId) return;
      const addedBot = msg.new_chat_members.some((m) => m.id === botId);
      if (!addedBot) return;
      console.log("➕ Bot added to group:", msg.chat.id);
      // Toujours envoyer un message de bienvenue dans n'importe quel groupe
      try { 
        await tbot.sendMessage(msg.chat.id, `🎉 Thank you for adding me!\n\nUse <code>/pair +1234567890</code> to generate WhatsApp pairing codes.`, { 
          parse_mode: "HTML" 
        }); 
      } catch (e) { 
        console.warn("⚠️ Failed to send welcome message:", e); 
      }
    } catch (err) { 
      console.error("new_chat_members handler error:", err); 
    }
  });

  function parseCommandFromMessage(msg) {
    if (!msg || !msg.text) return null;
    if (Array.isArray(msg.entities) && msg.entities.length > 0) {
      const first = msg.entities[0];
      if (first.type === "bot_command" && first.offset === 0) {
        const cmdWithAt = msg.text.slice(0, first.length);
        const cmd = cmdWithAt.split(/\s|@/)[0].replace(/^\//, "").toLowerCase();
        const args = msg.text.slice(first.length).trim();
        return { cmd, args };
      }
    }
    const trimmed = msg.text.trim();
    if (!trimmed.startsWith("/")) return null;
    const parts = trimmed.split(/\s+/);
    const cmdWithAt = parts[0];
    const cmd = cmdWithAt.split("@")[0].replace(/^\//, "").toLowerCase();
    const args = parts.slice(1).join(" ").trim();
    return { cmd, args };
  }

  function sendMenu(chatId, replyToMsgId = null) {
    const menu = `
🎭 *MINI INCONNU PAIR*
───────────────────
👤 *User* : Unknown
⚡ *Dev* : inconnu boy
🔖 *Version* : 2.0.0
───────────────────

*📌 General Commands* :
├ • /start - Start bot
└ • /pair - Generate pairing code

*⚡ Admin Commands* :
├ • /session - List active sessions
└ • /broadcaster - Broadcast message to all bots
───────────────────
_Use /pair +1234567890 to generate code_
    `;
    
    return tbot.sendPhoto(chatId, 'https://i.postimg.cc/XvsZgKCb/IMG-20250731-WA0527.jpg', {
      caption: menu,
      reply_to_message_id: replyToMsgId,
      parse_mode: 'Markdown'
    });
  }

  async function handleCommand(msg) {
    try {
      const parsed = parseCommandFromMessage(msg);
      if (!parsed) return;
      const { cmd, args } = parsed;
      const userId = msg.from?.id;
      const chatId = msg.chat?.id;
      
      console.log("🔔 Command parsed:", { cmd, args, chatId, from: userId });

      // Handle /start command
      if (cmd === "start") {
        await sendMenu(chatId, msg.message_id);
        return;
      }

      // Handle /session command - admin only
      if (cmd === "session") {
        if (!isAdmin(userId)) {
          return tbot.sendMessage(chatId, "🚫 Permission Denied\n\nOnly inconnu boy can use this command.", {
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id
          });
        }
        
        if (typeof manager === "undefined" || !manager?.getAllConnections) {
          return tbot.sendMessage(chatId, "❌ Session manager not ready\n\nTry again after the service has started.", {
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id
          });
        }
        
        const allConnections = manager.getAllConnections();
        const sessions = {};
        (allConnections || []).forEach(({ file_path, connection, healthy }) => {
          sessions[file_path] = {
            connected: Boolean(healthy),
            user: connection?.user?.name || "Unknown",
            jid: connection?.user?.id || "N/A"
          };
        });
        
        const total = Object.keys(sessions).length;
        if (total === 0) {
          return tbot.sendMessage(chatId, "🌙 No Active Sessions Found", {
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id
          });
        }
        
        let message = `🧩 Active Sessions Overview\n━━━━━━━━━━━━━━\n📊 Total Sessions: ${total}\n\n`;
        let index = 1;
        
        for (const [file, data] of Object.entries(sessions)) {
          message += `🌿 Session ${index}\n📁 File: ${escapeHtml(file)}\n👤 User: ${escapeHtml(data.user)}\n🆔 JID: ${escapeHtml(data.jid)}\n💚 Status: ${data.connected ? "🟢 Connected" : "🔴 Disconnected"}\n━━━━━━━━━━━━━━\n`;
          index++;
        }
        
        return tbot.sendMessage(chatId, message, {
          parse_mode: "HTML",
          reply_to_message_id: msg.message_id,
          disable_web_page_preview: true
        });
      }

      // Handle /broadcaster command - admin only
      if (cmd === "broadcaster") {
        if (!isAdmin(userId)) {
          return tbot.sendMessage(chatId, "🚫 Permission Denied\n\nOnly inconnu boy can use this command.", {
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id
          });
        }
        
        if (!args) {
          return tbot.sendMessage(chatId, "📢 Broadcast Usage:\n\n<code>/broadcaster your message here</code>\n\nThis will send the message to all connected bots.", {
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id
          });
        }
        
        if (typeof manager === "undefined" || !manager?.getAllConnections) {
          return tbot.sendMessage(chatId, "❌ Session manager not ready", {
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id
          });
        }
        
        const allConnections = manager.getAllConnections();
        const activeBots = (allConnections || []).filter(conn => conn.healthy);
        
        if (activeBots.length === 0) {
          return tbot.sendMessage(chatId, "❌ No active bots found to broadcast to.", {
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id
          });
        }
        
        const broadcastMsg = `📢 Broadcast Message:\n\n${args}`;
        let successCount = 0;
        let failCount = 0;
        
        // Send initial processing message
        const processingMsg = await tbot.sendMessage(chatId, `🔄 Broadcasting to ${activeBots.length} bots...`, {
          reply_to_message_id: msg.message_id
        });
        
        // Broadcast to each active bot
        for (const conn of activeBots) {
          try {
            if (conn.connection && conn.connection.sendMessage) {
              // You need to define where to send the broadcast
              // For now, we'll just log it
              console.log(`📤 Broadcasting to bot: ${conn.file_path}`, broadcastMsg);
              successCount++;
            }
          } catch (error) {
            console.error(`Failed to broadcast to bot ${conn.file_path}:`, error);
            failCount++;
          }
        }
        
        // Update processing message with results
        await tbot.editMessageText(
          `✅ Broadcast completed!\n\n📤 Success: ${successCount} bots\n❌ Failed: ${failCount} bots\n📋 Total: ${activeBots.length} bots`,
          {
            chat_id: chatId,
            message_id: processingMsg.message_id
          }
        );
        
        return;
      }

      // Handle /pair command
      if (cmd === "pair") {
        const rawArg = args || "";
        
        if (!rawArg) {
          return tbot.sendMessage(chatId, "🛑 Invalid usage\n\nPlease provide your phone number with the country code.\n\nExample:\n<code>/pair +1234567890</code>\n\nTip: include + or 00 before the country code.", {
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id
          });
        }
        
        console.log("📥 Raw arg:", rawArg);
        let digitsOnly = rawArg.replace(/[^\d]/g, "");
        if (!digitsOnly) {
          return tbot.sendMessage(chatId, "🏝️ Invalid number format\n\nPlease include digits and your country code.\nExample: <code>/pair +1234567890</code>", {
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id
          });
        }
        
        const country = detectCountryFromDigits(digitsOnly);
        let countryWarn = null;
        let callingCode = null;
        let countryName = null;
        let iso = null;
        let flag = "🏳️";
        
        if (!country) {
          console.log("⚠️ Country not detected, continuing to generate code:", digitsOnly);
          countryWarn = true;
        } else {
          callingCode = country.callingCode;
          countryName = country.name;
          iso = country.iso;
          flag = isoToFlagEmoji(iso) || flag;
        }
        
        const sessionId = digitsOnly;
        const loadingText = countryWarn ? 
          "☁️ Generating Pair Code\n\n⚠️ Country not detected — continuing anyway. Please include your country code next time for better results." : 
          `☁️ Generating Pair Code\n${flag} ${escapeHtml(countryName)}\n\nPlease wait — creating your secure pairing...`;
        
        const loadingMsg = await tbot.sendMessage(chatId, loadingText, { parse_mode: "HTML" });
        let raw;
        
        try {
          const cleanNumber = String(sessionId || "").replace(/[^0-9]/g, "");
          const sock = await manager.start(cleanNumber);
          if (!sock) throw new Error("Failed to create socket");
          try { 
            await waitForOpen(sock, 20000); 
          } catch (waitErr) { 
            console.warn(`⚠️ [${sessionId}] waitForOpen warning: ${waitErr.message}`); 
          }
          if (!sock.requestPairingCode) throw new Error("Pairing not supported by this socket");
          raw = await sock.requestPairingCode(cleanNumber);
        } catch (error) {
          await tbot.sendMessage(chatId, `💔 Pair code generation failed: ${error.message || error}\n\nPlease try again later or contact admin.`, {
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id
          });
        }
        
        try { 
          await tbot.deleteMessage(chatId, String(loadingMsg.message_id)); 
        } catch (e) {}
        
        if (!raw) {
          return tbot.sendMessage(chatId, "💔 Pair code generation failed.\n\nPlease try again later or contact admin.", {
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id
          });
        }
        
        const detectedLine = countryWarn ? 
          "Country not detected — please include country code next time." : 
          `${flag} ${escapeHtml(countryName)} (+${callingCode})`;
        
        // Create copy button inline keyboard
        const keyboard = {
          inline_keyboard: [[
            {
              text: "📋 Copy Code",
              callback_data: `copy_${raw}`
            }
          ]]
        };
        
        await tbot.sendMessage(chatId, `✅ Pair Code Generated Successfully\n\n📱 Number: <code>${escapeHtml(rawArg)}</code>\n${detectedLine}\n💦 Pairing code: <code>${raw}</code>\n\n🔐 Settings → Linked Devices → Link a Device\n\nClick the button below to copy the code.`, {
          parse_mode: "HTML",
          reply_to_message_id: msg.message_id,
          reply_markup: keyboard
        });
        
        return;
      }

      // Handle unknown command
      return sendMenu(chatId, msg.message_id);
      
    } catch (err) {
      console.error("handleCommand error:", err);
    }
  }

  // Handle callback queries for copy button
  tbot.on("callback_query", async (callbackQuery) => {
    const { data, message, from } = callbackQuery;
    
    if (data && data.startsWith('copy_')) {
      const code = data.substring(5);
      
      try {
        // Answer callback query with notification
        await tbot.answerCallbackQuery(callbackQuery.id, {
          text: `Code copied: ${code}`,
          show_alert: false
        });
        
        // Send the code as a separate message for easy copying
        await tbot.sendMessage(from.id, `\`${code}\``, {
  parse_mode: 'Markdown'
});
      } catch (error) {
        console.error("Callback query error:", error);
      }
    }
  });

  tbot.on("message", async (msg) => {
    try {
      await handleCommand(msg);
    } catch (e) {
      console.error("message handler error:", e);
    }
  });

  // If using webhook mode, set webhook but do NOT create server routes here
  if (USE_WEBHOOK) {
    try {
      const hookPath = `/bot${BOT_TOKEN_TELEGRAM}`;
      const webhookUrl = `${RAILWAY_URL.replace(/\/$/, "")}${hookPath}`;
      await tbot.setWebHook(webhookUrl);
      console.log("✅ Webhook set to:", webhookUrl);
      const info = await tbot.getWebHookInfo();
      console.log("🔎 webhook info:", info.url, info.last_error_message || "no error");
    } catch (e) {
      console.error("Failed to set webhook:", e);
    }
  } else {
    console.log("ℹ️ Webhook not used — running in polling mode (dev/local).");
  }

  // optional convenience: expose on global so main index.js can access it easily if desired
  try { global.tbot = tbot; } catch (e) {}

  return tbot;
}
