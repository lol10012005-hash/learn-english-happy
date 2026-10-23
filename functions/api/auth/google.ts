import { createRemoteJWKSet, jwtVerify } from 'jose'
import { createSessionCookie } from '../../_lib/session'

interface Env {
  DB: D1Database
  GOOGLE_CLIENT_ID: string
  SESSION_SECRET: string
}

const GOOGLE_KEYS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
)

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request
  env: Env
}) => {
  if (!env.SESSION_SECRET) {
    return Response.json({ error: 'Máy chủ chưa cấu hình SESSION_SECRET' }, { status: 500 })
  }

  let credential = ''
  try {
    const body = (await request.json()) as { credential?: string }
    credential = body.credential ?? ''
  } catch {
    return Response.json({ error: 'Dữ liệu gửi lên không hợp lệ' }, { status: 400 })
  }
  if (!credential) {
    return Response.json({ error: 'Thiếu token' }, { status: 400 })
  }

  try {
    const { payload } = await jwtVerify(credential, GOOGLE_KEYS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: env.GOOGLE_CLIENT_ID,
    })

    if (!payload.sub || payload.email_verified !== true) {
      return Response.json({ error: 'Tài khoản Google chưa xác minh email' }, { status: 401 })
    }

    const sub = payload.sub
    const email = String(payload.email ?? '')
    const name = String(payload.name ?? email)

    await env.DB.prepare(
      `INSERT INTO users (google_sub, email, name) VALUES (?1, ?2, ?3)
       ON CONFLICT(google_sub) DO UPDATE SET email = excluded.email, name = excluded.name`,
    )
      .bind(sub, email, name)
      .run()

    const user = await env.DB.prepare(
      'SELECT id, email, name FROM users WHERE google_sub = ?1',
    )
      .bind(sub)
      .first<{ id: number; email: string; name: string }>()

    if (!user) {
      return Response.json({ error: 'Không tạo được người dùng' }, { status: 500 })
    }

    const cookie = await createSessionCookie(env, user.id)
    return new Response(JSON.stringify({ user }), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie,
      },
    })
  } catch {
    return Response.json({ error: 'Token Google không hợp lệ hoặc đã hết hạn' }, { status: 401 })
  }
}