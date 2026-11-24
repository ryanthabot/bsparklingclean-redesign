// Cloudflare Pages Function: POST /api/inquiry
// Validates the estimate form and relays it as an email via Resend.
// Requires the RESEND_API_KEY secret in Pages project settings.

const INBOX = "info@bsparklingclean.com";
const FROM = "Brittney's Sparkling Clean <hello@bsparklingclean.com>";

// Anything that is not a string counts as empty. Line breaks are folded into spaces in
// the values that end up on one line (the name reaches the email's subject), and kept
// in the message itself.
const ONE_LINE = (s, max) => (typeof s === "string" ? s : "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
const TEXT = (s, max) => (typeof s === "string" ? s : "").replace(/\r\n?/g, "\n").trim().slice(0, max);
// The same test the browser's email field makes: some text, an @, some text
const EMAIL_RE = /^[^\s@]+@[^\s@]+$/;
const MAX_BODY = 10 * 1024;

export async function onRequestPost({ request, env }) {
  if (!env.RESEND_API_KEY) {
    return json({ ok: false, error: "Server not configured." }, 500);
  }

  if (Number(request.headers.get("content-length")) > MAX_BODY) {
    return json({ ok: false, error: "That message is too long. Please shorten it and try again." }, 413);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Bad request." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ ok: false, error: "Bad request." }, 400);
  }

  // Honeypot: bots fill hidden fields — silently accept and drop.
  if (ONE_LINE(body.website, 100)) return json({ ok: true });

  const name = ONE_LINE(body.name, 80);
  const email = ONE_LINE(body.email, 120);
  const phone = ONE_LINE(body.phone, 30);

  if (name.length < 2) {
    return json({ ok: false, error: "Please add your name." }, 400);
  }
  if (email && !EMAIL_RE.test(email)) {
    return json({ ok: false, error: "That email address doesn't look right." }, 400);
  }
  if (!email && !phone) {
    return json({ ok: false, error: "Add a phone number or an email so we can reach you." }, 400);
  }

  const message = TEXT(body.message, 2000);
  const fields = {
    Town: ONE_LINE(body.town, 50),
    "How often": ONE_LINE(body.often, 50),
  };

  const lines = [`Name: ${name}`];
  if (phone) lines.push(`Phone: ${phone}`);
  if (email) lines.push(`Email: ${email}`);
  for (const [label, value] of Object.entries(fields)) {
    if (value) lines.push(`${label}: ${value}`);
  }
  if (message) lines.push("", "Message:", message);
  lines.push("", "— Sent from the estimate form at www.bsparklingclean.com");

  const emailPayload = {
    from: FROM,
    to: [INBOX],
    subject: `New cleaning enquiry — ${name}`,
    text: lines.join("\n"),
  };
  if (email) emailPayload.reply_to = email; // so the business can hit "Reply" to answer the enquirer

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailPayload),
  });

  if (!resp.ok) {
    return json(
      { ok: false, error: "Could not send right now — please email us directly." },
      502
    );
  }
  return json({ ok: true });
}

export async function onRequest() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
