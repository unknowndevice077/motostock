// Edge Function: phone-side of the QR scanner pairing feature.
//
// GET  — serves a scanner page (no login, no app install) that loads jsQR
//        from a CDN (the phone already needs internet access to reach this
//        function at all, so one more small script is a non-issue). The
//        page reads its own `?token=` from the URL, so this same HTML is
//        returned for every request; the token is only ever validated
//        against phone_sessions, never trusted as-is.
// POST — the page's own camera loop posts each decoded part-number code
//        here as { token, code }. Validated against phone_sessions with the
//        service role (the phone has no Supabase session of its own — see
//        supabase/migrations/0004_phone_scan.sql for why), then looks the
//        part up and records a scan_events row the paired laptop is
//        subscribed to via Realtime.
//
// Deploy: npx supabase functions deploy scan-relay --no-verify-jwt
// (this function MUST run with verify_jwt disabled — the phone has no
// Supabase JWT to send. See supabase/config.toml.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (req.method === "GET") {
    const token = url.searchParams.get("token") ?? "";
    const session = await validSession(admin, token);
    return html(session ? scannerPage(token) : expiredPage());
  }

  if (req.method === "POST") {
    let body: { token?: string; code?: string };
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "Invalid request." }, 400);
    }
    const token = body.token ?? "";
    const code = (body.code ?? "").trim();
    if (!token || !code) return json({ ok: false, error: "Missing token or code." }, 400);

    const session = await validSession(admin, token);
    if (!session) return json({ ok: false, error: "This code has expired — ask staff to open Phone Scanner again." }, 401);

    const { data: part, error: partError } = await admin
      .from("parts")
      .select("id, part_name, part_number, stock, selling_price")
      .eq("shop_id", session.shop_id)
      .eq("part_number", code)
      .is("deleted_at", null)
      .maybeSingle();

    if (partError) return json({ ok: false, error: "Lookup failed, try again." }, 500);
    if (!part) return json({ ok: false, error: `No part with number "${code}".` }, 404);

    await admin.from("scan_events").insert({
      shop_id: session.shop_id,
      phone_session_id: session.id,
      part_id: part.id,
      part_name: part.part_name,
      part_number: part.part_number,
      stock: part.stock,
    });
    await admin.from("phone_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", session.id);

    return json({ ok: true, part: { name: part.part_name, stock: part.stock, price: part.selling_price } }, 200);
  }

  return json({ error: "Method not allowed." }, 405);
});

async function validSession(admin: ReturnType<typeof createClient>, token: string) {
  if (!token) return null;
  const { data, error } = await admin
    .from("phone_sessions")
    .select("id, shop_id, expires_at, revoked_at")
    .eq("id", token)
    .maybeSingle();
  if (error || !data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function html(body: string): Response {
  return new Response(body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function expiredPage(): string {
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<title>MotoStock Scanner</title>
<style>body{background:#020617;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}
.card{max-width:22rem}h1{font-size:1.1rem;color:#fbbf24}p{color:#94a3b8;font-size:.9rem}</style></head>
<body><div class="card"><h1>This code has expired</h1><p>Ask staff to open Phone Scanner on the laptop again for a fresh QR code.</p></div></body></html>`;
}

function scannerPage(token: string): string {
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MotoStock Scanner</title>
<style>
  * { box-sizing: border-box; }
  body { background:#020617; color:#e2e8f0; font-family:system-ui,-apple-system,sans-serif; margin:0; min-height:100vh; display:flex; flex-direction:column; }
  header { padding:14px 16px; border-bottom:1px solid #1e293b; }
  header h1 { font-size:.95rem; margin:0; font-weight:700; }
  header p { font-size:.75rem; color:#64748b; margin:2px 0 0; }
  .stage { position:relative; flex:1; background:#000; overflow:hidden; }
  video { width:100%; height:100%; object-fit:cover; }
  .frame { position:absolute; inset:12%; border:2px solid rgba(96,165,250,.65); border-radius:16px; pointer-events:none; }
  .status { position:absolute; left:0; right:0; bottom:16px; text-align:center; font-size:.8rem; color:#94a3b8; padding:0 16px; }
  .flash { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:6px;
    background:rgba(2,6,23,.94); opacity:0; pointer-events:none; transition:opacity .15s; text-align:center; padding:24px; }
  .flash.show { opacity:1; }
  .flash .ok { color:#34d399; font-size:1.3rem; font-weight:800; }
  .flash .err { color:#f87171; font-size:1.1rem; font-weight:700; }
  .flash .meta { color:#94a3b8; font-size:.85rem; }
</style>
</head>
<body>
<header>
  <h1>MotoStock &mdash; Phone Scanner</h1>
  <p>Point the camera at a part's QR label. Scans appear on the laptop instantly.</p>
</header>
<div class="stage">
  <video id="video" playsinline autoplay muted></video>
  <div class="frame"></div>
  <div class="status" id="status">Starting camera&hellip;</div>
</div>
<div class="flash" id="flash"></div>
<canvas id="canvas" style="display:none"></canvas>
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
<script>
(function () {
  var TOKEN = ${JSON.stringify(token)};
  var video = document.getElementById("video");
  var canvas = document.getElementById("canvas");
  var ctx = canvas.getContext("2d", { willReadFrequently: true });
  var statusEl = document.getElementById("status");
  var flashEl = document.getElementById("flash");
  var lastCode = null;
  var lastAt = 0;
  var COOLDOWN_MS = 1500;

  function flash(html, ms) {
    flashEl.innerHTML = html;
    flashEl.classList.add("show");
    setTimeout(function () { flashEl.classList.remove("show"); }, ms || 1400);
  }

  async function submit(code) {
    statusEl.textContent = "Looking up " + code + "…";
    try {
      var res = await fetch(location.pathname + location.search, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: TOKEN, code: code }),
      });
      var data = await res.json();
      if (data.ok) {
        flash('<div class="ok">✓ ' + escapeHtml(data.part.name) + '</div><div class="meta">' + data.part.stock + ' left · ₱' + Number(data.part.price).toLocaleString() + '</div>');
      } else {
        flash('<div class="err">' + escapeHtml(data.error || "Scan failed") + '</div>');
      }
    } catch (e) {
      flash('<div class="err">Network error — check your connection</div>');
    }
    statusEl.textContent = "Point the camera at a part's QR label";
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = String(s);
    return d.innerHTML;
  }

  function onDecoded(text) {
    var now = Date.now();
    if (text === lastCode && now - lastAt < COOLDOWN_MS) return;
    lastCode = text;
    lastAt = now;
    submit(text);
  }

  function tick() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
      if (result && result.data) onDecoded(result.data);
    }
    requestAnimationFrame(tick);
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(function (stream) {
      video.srcObject = stream;
      statusEl.textContent = "Point the camera at a part's QR label";
      requestAnimationFrame(tick);
    })
    .catch(function () {
      statusEl.textContent = "Camera access denied — allow camera access and reload this page.";
    });
})();
</script>
</body>
</html>`;
}
