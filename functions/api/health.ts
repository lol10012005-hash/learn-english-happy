interface Env {
  DB: D1Database;
}

export const onRequestGet = async ({ env }: { env: Env }) => {
  const row = await env.DB.prepare("SELECT 1 AS ok").first();
  return Response.json({ status: "ok", db: row });
};