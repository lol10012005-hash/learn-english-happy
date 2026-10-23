import { SignJWT, jwtVerify } from 'jose'

export const COOKIE_NAME = 'leh_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 ngày

export interface SessionEnv {
  SESSION_SECRET: string
}

function secretKey(env: SessionEnv) {
  return new TextEncoder().encode(env.SESSION_SECRET)
}

export async function createSessionCookie(env: SessionEnv, userId: number) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey(env))
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') ?? ''
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return rest.join('=')
  }
  return null
}

export async function getUserId(
  request: Request,
  env: SessionEnv,
): Promise<number | null> {
  const token = readCookie(request, COOKIE_NAME)
  if (!token || !env.SESSION_SECRET) return null
  try {
    const { payload } = await jwtVerify(token, secretKey(env), {
      algorithms: ['HS256'],
    })
    const id = Number(payload.sub)
    return Number.isInteger(id) && id > 0 ? id : null
  } catch {
    return null
  }
}