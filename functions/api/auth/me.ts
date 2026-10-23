import { getUserId, type SessionEnv } from '../../_lib/session'

interface Env extends SessionEnv {
  DB: D1Database
}

export const onRequestGet = async ({
  request,
  env,
}: {
  request: Request
  env: Env
}) => {
  const userId = await getUserId(request, env)
  if (!userId) return Response.json({ user: null })

  const user = await env.DB.prepare(
    'SELECT id, email, name FROM users WHERE id = ?1',
  )
    .bind(userId)
    .first()

  return Response.json({ user: user ?? null })
}