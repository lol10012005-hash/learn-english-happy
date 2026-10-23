import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // bỏ qua nếu trình duyệt chặn localStorage
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

const NAV_ITEMS = [
  { to: '/', label: 'Tổng quan', icon: '🏠' },
  { to: '/vocab', label: 'Từ vựng', icon: '📚' },
  { to: '/dictation', label: 'Nghe chép', icon: '🎧' },
  { to: '/stats', label: 'Thống kê', icon: '📈' },
  { to: '/settings', label: 'Cài đặt', icon: '⚙️' },
]

export default function Layout() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('theme', theme)
    } catch {
      // bỏ qua
    }
  }, [theme])

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Learn English Happy</span>
        <button
          className="theme-btn"
          aria-label="Đổi giao diện sáng hoặc tối"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? '☀️ Sáng' : '🌙 Tối'}
        </button>
      </header>

      <nav className="nav" aria-label="Menu chính">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              isActive ? 'nav-link active' : 'nav-link'
            }
          >
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}