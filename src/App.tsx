import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import Login from './pages/Login'
import Placeholder from './pages/Placeholder'
import Vocab from './pages/Vocab'
import Study from './pages/Study'
import Overview from './pages/Overview'
import Stats from './pages/Stats'
import DictationList from './pages/DictationList'
import DictationNew from './pages/DictationNew'
import DictationPlay from './pages/DictationPlay'

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="vocab" element={<Vocab />} />
          <Route path="study" element={<Study />} />
          <Route path="dictation" element={<DictationList />} />
          <Route path="dictation/new" element={<DictationNew />} />
          <Route path="dictation/:id" element={<DictationPlay />} />
          <Route path="stats" element={<Stats />} />
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