import { Module } from "../lib/plugins.js";
// old personalDB removed
import config from "../config.js";
import { getTheme } from "../Themes/themes.js";
// <-- IMPORT YOUR DB INSTANCE HERE (adjust path if needed)
import { db } from "../lib/client.js";

const theme = getTheme();

// helper to resolve bot number safely
function resolveBotNumber(conn) {
  // prefer conn.id if provided, else fallback to conn.user.id split
  if (!conn) return null;
  if (conn.id) return String(conn.id);
  if (conn.user && conn.user.id) return String(conn.user.id).split(":")[0];
  return null;
}

// 🔹 Auto Status Seen
Module({
  command: "autostatus",
  package: "owner",
  description: "Toggle auto view WhatsApp status",
})(async (message, match) => {
  if (!message.isFromMe) return message.send(theme.isfromMe);
  const botNumber = resolveBotNumber(message.conn);
  if (!botNumber) return message.send("❌ Bot number not found.");

  const input = match?.trim().toLowerCase();

  const key = "autostatus_seen"; // hot-key name used in handler

  if (input === "on" || input === "off") {
    await message.react("⏳");
    try {
      if (input === "on") db.setHot(botNumber, key, true);
      else db.delHot(botNumber, key);
      await message.react("✅");
      return await message.send({
        text: `✅ *Auto status view is now \`${input.toUpperCase()}\`*`,
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: "120363403408693274@newsletter",
            newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
            serverMessageId: 6,
          },
        }
      });
    } catch (e) {
      await message.react("❌");
      return await message.send({
        text: "❌ *Error updating auto status view*",
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: "120363403408693274@newsletter",
            newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
            serverMessageId: 6,
          },
        }
      });
    }
  }

  const status = db.get(botNumber, key, false) === true;
  return await message.send({
    text: `⚙️ *Auto Status View*\n> Status: ${
      status ? "✅ ON" : "❌ OFF"
    }\n\nUse:\n• astatus on\n• astatus off`,
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: "120363403408693274@newsletter",
        newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
        serverMessageId: 6,
      },
    }
  });
});

// 🔹 Auto Typing
Module({
  command: "autotyping",
  package: "owner",
  description: "Toggle auto typing in chats",
})(async (message, match) => {
  if (!message.isFromMe) return message.send(theme.isfromMe);
  const botNumber = resolveBotNumber(message.conn);
  if (!botNumber) return message.send("❌ Bot number not found.");

  const input = match?.trim().toLowerCase();
  const key = "autotyping";

  if (input === "on" || input === "off") {
    await message.react("⏳");
    try {
      if (input === "on") db.setHot(botNumber, key, true);
      else db.delHot(botNumber, key);
      await message.react("✅");
      return await message.send({
        text: `✅ *Auto typing is now \`${input.toUpperCase()}\`*`,
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: "120363403408693274@newsletter",
            newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
            serverMessageId: 6,
          },
        }
      });
    } catch (e) {
      await message.react("❌");
      return await message.send({
        text: "❌ *Error updating auto typing*",
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: "120363403408693274@newsletter",
            newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
            serverMessageId: 6,
          },
        }
      });
    }
  }

  const status = db.get(botNumber, key, false) === true;
  return await message.send({
    text: `⚙️ *Auto Typing*\n> Status: ${
      status ? "✅ ON" : "❌ OFF"
    }\n\nUse:\n• autotyping on\n• autotyping off`,
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: "120363403408693274@newsletter",
        newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
        serverMessageId: 6,
      },
    }
  });
});

// 🔹 Auto Recording
Module({
  command: "autorecord",
  package: "owner",
  description: "Toggle auto voice recording in chats",
})(async (message, match) => {
  if (!message.isFromMe) return message.send(theme.isfromMe);
  const botNumber = resolveBotNumber(message.conn);
  if (!botNumber) return message.send("❌ Bot number not found.");

  const input = match?.trim().toLowerCase();
  const key = "autorecord";

  if (input === "on" || input === "off") {
    await message.react("⏳");
    try {
      if (input === "on") db.setHot(botNumber, key, true);
      else db.delHot(botNumber, key);
      await message.react("✅");
      return await message.send({
        text: `✅ *Auto record is now \`${input.toUpperCase()}\`*`,
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: "120363403408693274@newsletter",
            newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
            serverMessageId: 6,
          },
        }
      });
    } catch (e) {
      await message.react("❌");
      return await message.send({
        text: "❌ *Error updating auto record*",
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: "120363403408693274@newsletter",
            newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
            serverMessageId: 6,
          },
        }
      });
    }
  }

  const status = db.get(botNumber, key, false) === true;
  return await message.send({
    text: `🎤 *Auto Record*\n> Status: ${
      status ? "✅ ON" : "❌ OFF"
    }\n\nUse:\n• autorecord on\n• autorecord off`,
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: "120363403408693274@newsletter",
        newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
        serverMessageId: 6,
      },
    }
  });
});

// 🔹 Auto React to Messages
Module({
  command: "autoreact",
  package: "owner",
  description: "Toggle auto react to messages",
})(async (message, match) => {
  if (!message.isFromMe) return message.send(theme.isfromMe);
  const botNumber = resolveBotNumber(message.conn);
  if (!botNumber) return message.send("❌ Bot number not found.");

  const input = match?.trim().toLowerCase();
  const key = "autoreact";

  if (input === "on" || input === "off") {
    await message.react("⏳");
    try {
      if (input === "on") db.setHot(botNumber, key, true);
      else db.delHot(botNumber, key);
      await message.react("✅");
      return await message.send({
        text: `✅ *AutoReact is now \`${input.toUpperCase()}\`*`,
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: "120363403408693274@newsletter",
            newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
            serverMessageId: 6,
          },
        }
      });
    } catch (e) {
      await message.react("❌");
      return await message.send({
        text: "❌ *Error updating AutoReact*",
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: "120363403408693274@newsletter",
            newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
            serverMessageId: 6,
          },
        }
      });
    }
  }

  const status = db.get(botNumber, key, false) === true;
  return await message.send({
    text: `⚙️ *AutoReact*\n> Status: ${
      status ? "✅ ON" : "❌ OFF"
    }\n\nUse:\n• autoreact on\n• autoreact off`,
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: "120363403408693274@newsletter",
        newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
        serverMessageId: 6,
      },
    }
  });
});

// 🔹 Anti Call
Module({
  command: "anticall",
  package: "owner",
  description: "Block users who call the bot",
})(async (message, match) => {
  if (!message.isFromMe) return message.send(theme.isfromMe);
  const botNumber = resolveBotNumber(message.conn);
  if (!botNumber) return message.send("❌ Bot number not found.");

  const input = match?.trim().toLowerCase();
  const key = "anticall";

  if (input === "on" || input === "off") {
    await message.react("⏳");
    try {
      if (input === "on") db.setHot(botNumber, key, true);
      else db.delHot(botNumber, key);
      await message.react("✅");
      return await message.send({
        text: `✅ *AntiCall is now \`${input.toUpperCase()}\`*`,
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: "120363403408693274@newsletter",
            newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
            serverMessageId: 6,
          },
        }
      });
    } catch (e) {
      await message.react("❌");
      return await message.send({
        text: "❌ *Error updating AntiCall*",
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: "120363403408693274@newsletter",
            newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
            serverMessageId: 6,
          },
        }
      });
    }
  }

  const status = db.get(botNumber, key, false) === true;
  return await message.send({
    text: `⚙️ *AntiCall*\n> Status: ${
      status ? "✅ ON" : "❌ OFF"
    }\n\nUse:\n• anticall on\n• anticall off`,
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: "120363403408693274@newsletter",
        newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
        serverMessageId: 6,
      },
    }
  });
});

// 🔹 Auto Read
Module({
  command: "autoread",
  package: "owner",
  description: "Toggle auto read messages",
})(async (message, match) => {
  if (!message.isFromMe) return message.send(theme.isfromMe);
  const botNumber = resolveBotNumber(message.conn);
  if (!botNumber) return message.send("❌ Bot number not found.");

  const input = match?.trim().toLowerCase();
  const key = "autoread";

  if (input === "on" || input === "off") {
    await message.react("⏳");
    try {
      if (input === "on") db.setHot(botNumber, key, true);
      else db.delHot(botNumber, key);
      await message.react("✅");
      return await message.send({
        text: `✅ *AutoRead is now \`${input.toUpperCase()}\`*`,
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: "120363403408693274@newsletter",
            newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
            serverMessageId: 6,
          },
        }
      });
    } catch (e) {
      await message.react("❌");
      return await message.send({
        text: "❌ *Error updating AutoRead*",
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: "120363403408693274@newsletter",
            newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
            serverMessageId: 6,
          },
        }
      });
    }
  }

  const status = db.get(botNumber, key, false) === true;
  return await message.send({
    text: `⚙️ *AutoRead*\n> Status: ${
      status ? "✅ ON" : "❌ OFF"
    }\n\nUse:\n• autoread on\n• autoread off`,
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: "120363403408693274@newsletter",
        newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
        serverMessageId: 6,
      },
    }
  });
});

Module({
  command: "mode",
  package: "owner",
  description: "Toggle bot mode (public / private)",
})(async (message, match) => {
  if (!message.isFromMe) return message.send(theme.isfromMe);

  const botNumber = resolveBotNumber(message.conn);
  if (!botNumber) return message.send("❌ Bot number not found.");

  const input = match?.trim().toLowerCase();
  const key = "mode"; // true = public, false = private

  if (input === "public" || input === "private") {
    await message.react("⏳");
    try {
      if (input === "public") {
        db.setHot(botNumber, key, true);
      } else {
        db.setHot(botNumber, key, false);
      }

      await message.react("✅");
      return message.send({
        text: `✅ *Bot mode set to* \`${input.toUpperCase()}\``,
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: "120363403408693274@newsletter",
            newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
            serverMessageId: 6,
          },
        }
      });
    } catch (err) {
      await message.react("❌");
      return message.send({
        text: "❌ *Failed to update bot mode*",
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: "120363403408693274@newsletter",
            newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
            serverMessageId: 6,
          },
        }
      });
    }
  }

  const isPublic = db.get(botNumber, key, true) === true;

  return message.send({
    text: `⚙️ *INCONNU XD Mode*\n` +
    `> Status: ${isPublic ? "🌍 PUBLIC" : "🔒 PRIVATE"}\n\n` +
    `*Usage:*\n` +
    `• mode public\n` +
    `• mode private`,
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: "120363403408693274@newsletter",
        newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
        serverMessageId: 6,
      },
    }
  });
});
