import os from "os";
import { Module, getCommands } from "../lib/plugins.js";
import config from "../config.js";

function runtime(secs) {
  const pad = (s) => s.toString().padStart(2, "0");
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

function buildGroupedCommands() {
  const cmds = getCommands();
  return cmds
    .filter((cmd) => cmd && cmd.command && cmd.command !== "undefined")
    .reduce((acc, cmd) => {
      const pkg = (cmd.package || "uncategorized").toLowerCase();
      if (!acc[pkg]) acc[pkg] = [];
      acc[pkg].push(cmd.command);
      return acc;
    }, {});
}

// ✅ MENU V2 UNIQUE
function buildMenuV2(userName, runtimeStr, ram, time, prefix, groupedCommands) {
  let menu = `
╭───────────────⭓
│ 👤 User : ${userName}
│ ⏱ Runtime : ${runtimeStr}
│ 🕒 Time : ${time}
│ 💾 RAM : ${ram}
│ 🌐 Mode : Public
│ ⚙️ Version : 2.0.0
╰───────────────⭓
`;

  const categories = Object.keys(groupedCommands).sort();

  for (const cat of categories) {
    const icon = groupedCommands[cat].length > 3 ? "👥" : "📌";
    menu += `\n╭─${icon} ${cat.toUpperCase()}\n`;
    groupedCommands[cat].sort().forEach((cmd) => {
      menu += `│ • ${prefix}${cmd}\n`;
    });
    menu += `╰───────────────⭓\n`;
  }

  menu += `\n✨ *MINI INCONNU XD BOT* ✨`;
  return menu;
}

Module({
  command: "menu",
  package: "general",
  description: "Show bot commands (single menu style)"
})(async (message) => {
  try {
    await message.react("📜");

    const time = new Date().toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    const userName = message.pushName || "User";
    const usedGB = ((os.totalmem() - os.freemem()) / 1073741824).toFixed(2);
    const totGB = (os.totalmem() / 1073741824).toFixed(2);
    const ram = `${usedGB} / ${totGB} GB`;
    const runtimeStr = runtime(process.uptime());

    const grouped = buildGroupedCommands();
    const menuText = buildMenuV2(
      userName,
      runtimeStr,
      ram,
      time,
      config.prefix,
      grouped
    );

    await message.conn.sendMessage(message.from, {
      image: { url: "https://i.postimg.cc/XvsZgKCb/IMG-20250731-WA0527.jpg" },
      caption: menuText,
      mimetype: "image/jpeg",
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: "120363403408693274@newsletter",
          newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
          serverMessageId: 6,
        },
      },
    });
  } catch (err) {
    console.error("❌ Menu error:", err);
    await message.reply(`❌ Error: ${err?.message || err}`);
  }
});
