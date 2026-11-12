import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const SECRET = "career-ops-local-emulator-secret";
const PORT = Number(process.env.SYNC_EMULATOR_PORT || 54321);

const anonKey = signJwt({ role: "anon", iss: "career-ops-emulator", iat: 1700000000, exp: 2000000000 });
const serviceKey = signJwt({ role: "service_role", iss: "career-ops-emulator", iat: 1700000000, exp: 2000000000 });

const users = new Map();
const tokens = new Map();
const refreshTokens = new Map();
const records = new Map();
const mailbox = [];

if (process.argv.includes("--print-keys")) {
  console.log(JSON.stringify({ url: `http://127.0.0.1:${PORT}`, anonKey, serviceKey }, null, 2));
  process.exit(0);
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin || "*";
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("access-control-allow-headers", req.headers["access-control-request-headers"] || "*");
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("access-control-allow-credentials", "true");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  const body = await readBody(req);
  try {
    await route(req, res, url, body);
  } catch (error) {
    send(res, 500, { error: error instanceof Error ? error.message : "emulator error", msg: error instanceof Error ? error.message : "emulator error" });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`sync emulator http://127.0.0.1:${PORT}`);
  console.log(`anon ${anonKey}`);
  console.log(`service ${serviceKey}`);
});

async function route(req, res, url, body) {
  if (url.pathname === "/debug/records") {
    send(res, 200, [...records.values()].map((row) => ({ user_id: row.user_id, collection: row.collection, record_id: row.record_id, updated_at: row.updated_at, deleted_at: row.deleted_at, fullName: row.payload?.fullName || null })));
    return;
  }
  if (url.pathname === "/mailbox") {
    const email = url.searchParams.get("email");
    send(res, 200, { links: mailbox.filter((item) => !email || item.email === email) });
    return;
  }
  if (url.pathname === "/auth/v1/health" || url.pathname === "/auth/v1/settings") {
    send(res, 200, { external: { google: false }, disable_signup: false });
    return;
  }
  if (url.pathname === "/auth/v1/otp" && req.method === "POST") {
    const email = String(body.email || "").trim().toLowerCase();
    if (!email.includes("@")) {
      send(res, 400, { error: "Enter an email address.", msg: "Enter an email address." });
      return;
    }
    const user = ensureUser(email);
    const token = randomUUID();
    const redirect = url.searchParams.get("redirect_to") || body.email_redirect_to || "http://127.0.0.1:43123/auth/callback";
    tokens.set(token, { userId: user.id, redirect, email });
    const link = `http://127.0.0.1:${PORT}/auth/v1/verify?token=${token}&type=magiclink&redirect_to=${encodeURIComponent(redirect)}`;
    mailbox.push({ email, url: link, createdAt: new Date().toISOString() });
    console.log(`magic link for ${email}: ${link}`);
    send(res, 200, {});
    return;
  }
  if (url.pathname === "/auth/v1/verify" && req.method === "GET") {
    const pending = tokens.get(url.searchParams.get("token") || "");
    if (!pending) {
      send(res, 403, { error: "That sign-in link has expired.", msg: "That sign-in link has expired." });
      return;
    }
    tokens.delete(url.searchParams.get("token") || "");
    const session = issueSession(users.get(pending.userId));
    const redirect = url.searchParams.get("redirect_to") || pending.redirect;
    const hash = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: String(session.expires_in),
      expires_at: String(session.expires_at),
      token_type: "bearer",
      type: "magiclink",
    });
    res.writeHead(302, { location: `${redirect}#${hash.toString()}` });
    res.end();
    return;
  }
  if (url.pathname === "/auth/v1/user" && req.method === "GET") {
    const user = userFrom(req);
    if (!user) {
      send(res, 401, { error: "Not signed in.", msg: "Not signed in." });
      return;
    }
    send(res, 200, publicUser(user));
    return;
  }
  if (url.pathname === "/auth/v1/token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "refresh_token") {
      const userId = refreshTokens.get(body.refresh_token);
      const user = userId ? users.get(userId) : null;
      if (!user) {
        send(res, 401, { error: "Refresh failed.", msg: "Refresh failed." });
        return;
      }
      send(res, 200, issueSession(user));
      return;
    }
    send(res, 400, { error: "Unsupported grant.", msg: "Unsupported grant." });
    return;
  }
  if (url.pathname === "/auth/v1/logout" && req.method === "POST") {
    send(res, 204, null);
    return;
  }
  if (url.pathname === "/auth/v1/authorize") {
    send(res, 501, { error: "Google sign-in needs a hosted Supabase project.", msg: "Google sign-in needs a hosted Supabase project." });
    return;
  }
  if (url.pathname === "/rest/v1/user_records" && req.method === "GET") {
    const actor = actorFrom(req);
    if (!actor) {
      send(res, 401, { message: "Not signed in.", code: "401" });
      return;
    }
    const wanted = url.searchParams.get("collection");
    const collections = wanted?.startsWith("in.(") ? wanted.slice(4, -1).split(",") : null;
    const rows = [...records.values()].filter((row) => {
      if (actor.role !== "service_role" && row.user_id !== actor.sub) return false;
      if (collections && !collections.includes(row.collection)) return false;
      return true;
    });
    send(res, 200, rows);
    return;
  }
  if (url.pathname === "/rest/v1/user_records" && req.method === "POST") {
    const actor = actorFrom(req);
    if (!actor) {
      send(res, 401, { message: "Not signed in.", code: "401" });
      return;
    }
    const rows = Array.isArray(body) ? body : [];
    for (const row of rows) {
      const userId = actor.role === "service_role" ? row.user_id : actor.sub;
      if (!userId) continue;
      const key = `${userId}/${row.collection}/${row.record_id}`;
      const previous = records.get(key);
      const incoming = Date.parse(row.updated_at || "") || 0;
      const current = previous ? Date.parse(previous.updated_at) || 0 : 0;
      const prefer = String(req.headers.prefer || "");
      if (previous && prefer.includes("ignore-duplicates")) continue;
      if (previous && incoming < current) continue;
      records.set(key, {
        user_id: userId,
        collection: row.collection,
        record_id: row.record_id,
        payload: row.payload ?? {},
        updated_at: row.updated_at,
        deleted_at: row.deleted_at || null,
      });
    }
    res.writeHead(201, { "content-type": "application/json" });
    res.end("[]");
    return;
  }
  if (url.pathname === "/rest/v1/rpc/upsert_records" && req.method === "POST") {
    const actor = actorFrom(req);
    if (!actor || actor.role === "anon") {
      send(res, 401, { message: "Not signed in.", code: "401" });
      return;
    }
    const rows = Array.isArray(body.rows) ? body.rows : [];
    for (const row of rows) {
      const key = `${actor.sub}/${row.collection}/${row.record_id}`;
      const previous = records.get(key);
      const incoming = Date.parse(row.updated_at || "") || 0;
      const current = previous ? Date.parse(previous.updated_at) || 0 : 0;
      if (previous && incoming < current) continue;
      records.set(key, {
        user_id: actor.sub,
        collection: row.collection,
        record_id: row.record_id,
        payload: row.payload ?? {},
        updated_at: row.updated_at,
        deleted_at: row.deleted_at || null,
      });
    }
    send(res, 200, null);
    return;
  }
  send(res, 404, { error: `No emulator route for ${req.method} ${url.pathname}`, msg: `No emulator route for ${url.pathname}` });
}

function ensureUser(email) {
  for (const user of users.values()) if (user.email === email) return user;
  const user = { id: randomUUID(), email };
  users.set(user.id, user);
  return user;
}

function issueSession(user) {
  const access = signJwt({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
  const refresh = randomUUID();
  refreshTokens.set(refresh, user.id);
  return {
    access_token: access,
    refresh_token: refresh,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: publicUser(user),
  };
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
}

function actorFrom(req) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token === serviceKey) return { role: "service_role", sub: null };
  const payload = verifyJwt(token);
  if (!payload) return null;
  if (payload.role === "service_role") return { role: "service_role", sub: null };
  if (payload.role !== "authenticated" || !users.has(payload.sub)) return null;
  return { role: "authenticated", sub: payload.sub };
}

function userFrom(req) {
  const actor = actorFrom(req);
  if (!actor?.sub) return null;
  return users.get(actor.sub) ?? null;
}

function signJwt(payload) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyJwt(token) {
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) return null;
  const expected = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  if (expected !== signature) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve({});
      }
    });
  });
}

function send(res, status, payload) {
  if (payload == null) {
    res.writeHead(status);
    res.end();
    return;
  }
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}
