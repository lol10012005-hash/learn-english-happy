import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteLesson, fetchLessons, type LessonSummary } from '../dictation/api'

function formatDate(value: string): string {
  const date = new Date(value.replace(' ', 'T') + 'Z')
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN')
}

export default function DictationList() {
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchLessons()
      .then((d) => setLessons(d.lessons))
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Không tải được danh sách'),
      )
  }, [])

  async function handleDelete(lesson: LessonSummary) {
    if (!window.confirm(`Xóa bài "${lesson.title}"? Bài gõ dở trên máy này cũng sẽ không còn dùng được.`)) {
      return
    }
    try {
      await deleteLesson(lesson.id)
      setLessons((prev) => prev?.filter((l) => l.id !== lesson.id) ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không xóa được bài')
    }
  }

  return (
    <section className="card">
      <h1>Nghe chép</h1>
      <p>
        Nghe audio, gõ lại đoạn văn. Văn bản gốc lấy từ Google Docs của bạn, audio
        được lưu ngay trong máy bạn (không lưu trên máy chủ của ứng dụng).
      </p>
      <p>
        <Link className="primary-btn link-as-btn" to="/dictation/new">
          + Thêm bài nghe chép
        </Link>
      </p>

      {error && <p role="alert">{error}</p>}
      {lessons === null && !error && <p className="loading">Đang tải...</p>}
      {lessons && lessons.length === 0 && (
        <p>Chưa có bài nào. Bấm "Thêm bài nghe chép" để bắt đầu.</p>
      )}

      <ul className="lesson-list">
        {lessons?.map((l) => (
          <li key={l.id} className="lesson-item">
            <div>
              <strong>{l.title}</strong>
              <br />
              <small>
                {l.words} từ · {l.hasCues ? 'có mốc thời gian · ' : ''}
                {l.audioName ?? 'giọng đọc của trình duyệt'} · {formatDate(l.createdAt)}
              </small>
            </div>
            <div className="lesson-actions">
              <Link className="primary-btn link-as-btn" to={`/dictation/${l.id}`}>
                Làm bài
              </Link>
              <button className="ghost-btn" onClick={() => handleDelete(l)}>
                Xóa
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}