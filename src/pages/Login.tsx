import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import GoogleSignIn from '../components/GoogleSignIn'

export default function Login() {
  const { user, loading, setUser } = useAuth()
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

  if (loading) return <p className="loading">Đang tải...</p>
  if (user) return <Navigate to="/" replace />

  return (
    <div className="login-wrap">
      <section className="card login-card">
        <h1>Learn English Happy</h1>
        <p>Đăng nhập bằng tài khoản Google để bắt đầu học.</p>
        <GoogleSignIn onCredential={handleCredential} />
        {error && <p role="alert">Lỗi: {error}</p>}
      </section>
    </div>
  )
}