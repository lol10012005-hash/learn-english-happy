import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import Login from './pages/Login'
import Placeholder from './pages/Placeholder'
import Vocab from './pages/Vocab'

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route
            index
            element={<Placeholder title="Tổng quan" note="Từ đến hạn ôn, streak và bài nghe chép gần đây sẽ hiện ở đây." />}
          />
          <Route path="vocab" element={<Vocab />} />
          <Route
            path="dictation"
            element={<Placeholder title="Nghe chép" note="Danh sách bài nghe chép sẽ hiện ở đây." />}
          />
          <Route
            path="stats"
            element={<Placeholder title="Thống kê" note="Biểu đồ tiến bộ và lịch streak." />}
          />
          <Route
            path="settings"
            element={<Placeholder title="Cài đặt" note="Giọng đọc, giao diện, quản lý file Google." />}
          />
          <Route
            path="*"
            element={<Placeholder title="Không tìm thấy trang" note="Địa chỉ này không tồn tại." />}
          />
        </Route>
      </Route>
    </Routes>
  )
}