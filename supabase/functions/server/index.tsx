import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.use("*", logger(console.log));

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.get("/make-server-6cfb8b21/health", (c) => {
  return c.json({ status: "ok" });
});

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function getAuthedUser(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await adminClient().auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// ── Auth ────────────────────────────────────────────────────────────────────

app.post("/make-server-6cfb8b21/auth/signup", async (c) => {
  const { email, password, full_name } = await c.req.json();
  if (!email || !password) return c.json({ error: "Email and password required" }, 400);

  const sb = adminClient();

  // Create user via admin API — auto-confirms email so no verification step needed
  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name ?? "" },
  });
  if (createErr) return c.json({ error: createErr.message }, 400);

  // Sign in immediately to get a session
  const { data: signed, error: signErr } = await sb.auth.signInWithPassword({ email, password });
  if (signErr || !signed.session) return c.json({ error: signErr?.message ?? "Sign-in failed" }, 400);

  const name = full_name || email.split("@")[0];
  return c.json({
    user: { id: created.user.id, email: created.user.email, name },
    access_token: signed.session.access_token,
    refresh_token: signed.session.refresh_token,
  });
});

app.post("/make-server-6cfb8b21/auth/login", async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ error: "Email and password required" }, 400);

  const { data, error } = await adminClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) return c.json({ error: error?.message ?? "Login failed" }, 401);

  const name = data.user.user_metadata?.full_name || email.split("@")[0];
  return c.json({
    user: { id: data.user.id, email: data.user.email, name },
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});

app.get("/make-server-6cfb8b21/auth/me", async (c) => {
  const user = await getAuthedUser(c.req.header("Authorization"));
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "";
  return c.json({ user: { id: user.id, email: user.email, name } });
});

app.post("/make-server-6cfb8b21/auth/refresh", async (c) => {
  const { refresh_token } = await c.req.json();
  if (!refresh_token) return c.json({ error: "refresh_token required" }, 400);
  const { data, error } = await adminClient().auth.refreshSession({ refresh_token });
  if (error || !data.session) return c.json({ error: "Invalid refresh token" }, 401);
  return c.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});

// ── Cart ────────────────────────────────────────────────────────────────────

app.get("/make-server-6cfb8b21/cart", async (c) => {
  const user = await getAuthedUser(c.req.header("Authorization"));
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const items = (await kv.get(`cart:${user.id}`)) ?? [];
  return c.json({ items });
});

app.post("/make-server-6cfb8b21/cart", async (c) => {
  const user = await getAuthedUser(c.req.header("Authorization"));
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const { items } = await c.req.json();
  await kv.set(`cart:${user.id}`, items);
  return c.json({ ok: true });
});

// ── Wishlist ─────────────────────────────────────────────────────────────────

app.get("/make-server-6cfb8b21/wishlist", async (c) => {
  const user = await getAuthedUser(c.req.header("Authorization"));
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const items = (await kv.get(`wishlist:${user.id}`)) ?? [];
  return c.json({ items });
});

app.post("/make-server-6cfb8b21/wishlist", async (c) => {
  const user = await getAuthedUser(c.req.header("Authorization"));
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const { items } = await c.req.json();
  await kv.set(`wishlist:${user.id}`, items);
  return c.json({ ok: true });
});

Deno.serve(app.fetch);
