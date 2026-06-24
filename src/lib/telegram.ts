/** Minimal Telegram Bot API client — only what the webhook needs. */

const API_BASE = "https://api.telegram.org";

function token() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN not set");
  return t;
}

export async function sendMessage(
  chatId: number,
  text: string,
  opts: { reply_to_message_id?: number; parse_mode?: "Markdown" } = {},
) {
  // Telegram caps messages at 4096 chars. Split if needed.
  const MAX = 4000;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += MAX) {
    chunks.push(text.slice(i, i + MAX));
  }
  for (const chunk of chunks) {
    const res = await fetch(`${API_BASE}/bot${token()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        reply_to_message_id: opts.reply_to_message_id,
        parse_mode: opts.parse_mode,
        link_preview_options: { is_disabled: true },
      }),
    });
    if (!res.ok) {
      // Don't throw; log and continue so we don't double-handle on retry.
      console.error("Telegram sendMessage failed:", await res.text());
    }
  }
}

export async function sendDocument(
  chatId: number,
  doc: { buffer: Buffer; filename: string; mimeType?: string },
  opts: { caption?: string; reply_to_message_id?: number } = {},
) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (opts.caption) form.append("caption", opts.caption);
  if (opts.reply_to_message_id != null) {
    form.append("reply_to_message_id", String(opts.reply_to_message_id));
  }
  const blob = new Blob([new Uint8Array(doc.buffer)], {
    type: doc.mimeType ?? "application/octet-stream",
  });
  form.append("document", blob, doc.filename);

  const res = await fetch(`${API_BASE}/bot${token()}/sendDocument`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("Telegram sendDocument failed:", detail);
    return { ok: false, error: detail };
  }
  return { ok: true };
}

export async function sendChatAction(chatId: number, action: "typing") {
  await fetch(`${API_BASE}/bot${token()}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  }).catch(() => {
    // Ignore — typing indicator is best-effort.
  });
}

export function allowedUserIds(): Set<number> {
  const raw = process.env.ALLOWED_TELEGRAM_USER_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n)),
  );
}
