import { getUserId, type SessionEnv } from '../_lib/session'

export const onRequest = async ({
  request,
  env,
  next,
  data,
}: {
  request: Request
  env: SessionEnv
  next: () => Promise<Response>
  data: Record<string, unknown>
}) => {
  const url = new URL(request.url)

  // Chặn yêu cầu ghi dữ liệu đến từ trang web khác (chống CSRF)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('Origin')
    if (origin && origin !== url.origin) {
      return Response.json({ error: 'Nguồn yêu cầu không hợp lệ' }, { status: 403 })
    }
  }

  // Các đường dẫn công khai
  if (url.pathname === '/api/health' || url.pathname.startsWith('/api/auth/')) {
    return next()
  }

  if (!env.SESSION_SECRET) {
    return Response.json({ error: 'Máy chủ chưa cấu hình SESSION_SECRET' }, { status: 500 })
  }

  const userId = await getUserId(request, env)
  if (!userId) {
    return Response.json({ error: 'Bạn chưa đăng nhập' }, { status: 401 })
  }

  data.userId = userId
  return next()
}