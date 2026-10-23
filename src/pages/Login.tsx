import { useState } from 'react'
import GoogleSignIn from '../components/GoogleSignIn'

type User = { id: number; email: string; name: string }

export default function Login() {
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')

  async function handleCredential(credential: string) {
    setError('')
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Đăng nhập thất bại')
      setUser(data.user)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đăng nhập thất bại')
    }
  }

  return (
    <section className="card">
      <h1>Đăng nhập</h1>
      {user ? (
        <p>
          Xin chào <strong>{user.name}</strong> ({user.email}). Đăng nhập
          thành công, mã người dùng của bạn là {user.id}.
        </p>
      ) : (
        <>
          <p>Đăng nhập bằng tài khoản Google để bắt đầu học.</p>
          <GoogleSignIn onCredential={handleCredential} />
        </>
      )}
      {error && <p role="alert">Lỗi: {error}</p>}
    </section>
  )
}