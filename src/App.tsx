import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Placeholder from './pages/Placeholder'
import Login from './pages/Login'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          index
          element={<Placeholder title="Tổng quan" note="Từ đến hạn ôn, streak và bài nghe chép gần đây sẽ hiện ở đây." />}
        />
        <Route
          path="vocab"
          element={<Placeholder title="Từ vựng" note="Thư viện quyển và unit từ Google Sheet của bạn." />}
        />
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
        <Route path="login" element={<Login />} />
        <Route
          path="*"
          element={<Placeholder title="Không tìm thấy trang" note="Địa chỉ này không tồn tại." />}
        />
      </Route>
    </Routes>
  )
}