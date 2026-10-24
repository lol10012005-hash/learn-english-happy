import {
  evaluate,
  LEVEL_NAMES,
  VERDICTS,
  verdict,
  type Level,
  type Session,
  type StudyWord,
} from '../study/engine'

type Props = {
  session: Session
  onPracticeWeak: (words: StudyWord[]) => void
  onNew: () => void
}

const LEVEL_ICON: Record<Level, string> = { 0: '✗', 1: '△', 2: '✓' }

export default function StudyResult({ session, onPracticeWeak, onNew }: Props) {
  const { evals, counts } = evaluate(session.stats)
  const level = verdict(counts)
  const weak = evals.filter((e) => e.level < 2).map((e) => e.stat.word)

  return (
    <section className="card">
      <h1>Kết quả</h1>
      {level !== null && (
        <div className={`verdict verdict-${level}`}>
          <strong>{VERDICTS[level].title}</strong>
          <p>{VERDICTS[level].text}</p>
        </div>
      )}

      <ul className="unit-list">
        <li>Điểm: <strong>{session.score}</strong></li>
        <li>Đúng ngay lần đầu: <strong>{session.firstTry}</strong></li>
        <li>Chuỗi đúng dài nhất: <strong>{session.maxCombo}</strong></li>
        <li>Đã thuộc: <strong>{counts[2]}</strong></li>
        <li>Chưa thuộc: <strong>{counts[1]}</strong></li>
        <li>Không thuộc: <strong>{counts[0]}</strong></li>
      </ul>

      <div className="table-scroll">
        <table className="result-table">
          <thead>
            <tr>
              <th>Từ</th>
              <th>Nghĩa</th>
              <th>Sai</th>
              <th>Gợi ý</th>
              <th>Đánh giá</th>
            </tr>
          </thead>
          <tbody>
            {evals.map(({ stat, level: lv }) => (
              <tr key={stat.word.key} className={`row-lv-${lv}`}>
                <td>{stat.word.word}</td>
                <td>{stat.word.meaning}</td>
                <td>{stat.wrong}</td>
                <td>{stat.hints}</td>
                <td>
                  {LEVEL_ICON[lv]} {LEVEL_NAMES[lv]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="play-actions">
        {weak.length > 0 && (
          <button className="primary-btn" onClick={() => onPracticeWeak(weak)}>
            Luyện {weak.length} từ chưa thuộc
          </button>
        )}
        <button className="ghost-btn" onClick={onNew}>
          Chọn bài khác
        </button>
      </div>
    </section>
  )
}