import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import StudyPlay from '../components/StudyPlay'
import StudyResult from '../components/StudyResult'
import { saveSession, todayIso, type SaveState } from '../progress/api'
import { fetchStudyWords } from '../study/api'
import {
  createSession,
  DEFAULT_GAME,
  MODES,
  pickSession,
  type Mode,
  type Session,
  type StudyWord,
} from '../study/engine'
import { fetchLibrary, type LibrarySource } from '../vocab/api'

type Phase =
  | { kind: 'select' }
  | { kind: 'play'; session: Session; run: number }
  | { kind: 'result'; session: Session; save: SaveState }

export default function Study() {
  const [params] = useSearchParams()
  const review = params.get('review') === '1'

  const [phase, setPhase] = useState<Phase>({ kind: 'select' })
  const [sources, setSources] = useState<LibrarySource[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [limit, setLimit] = useState(20)
  const [mode, setMode] = useState<Mode>(3)
  const [shuffle, setShuffle] = useState(true)
  const [includeAll, setIncludeAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [runs, setRuns] = useState(0)
  const savedRef = useRef(new WeakSet<Session>())

  useEffect(() => {
    fetchLibrary()
      .then((d) => {
        setSources(d.sources)
        // Từ trang Tổng quan bấm "Ôn từ đến hạn": chọn sẵn tất cả unit
        if (review) {
          setSelected(
            new Set(
              d.sources.flatMap((s) =>
                s.books.flatMap((b) => b.units.map((u) => u.id)),
              ),
            ),
          )
        }
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Không tải được thư viện'),
      )
  }, [review])

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function begin(words: StudyWord[]) {
    const settings = { ...DEFAULT_GAME, shuffle }
    setRuns((r) => r + 1)
    setPhase({
      kind: 'play',
      session: createSession(words, settings, Math.random, mode),
      run: runs + 1,
    })
  }

  async function handleStart() {
    setError('')
    if (selected.size === 0) {
      setError('Hãy chọn ít nhất một unit.')
      return
    }
    setBusy(true)
    try {
      const deck = await fetchStudyWords([...selected])
      const picked = pickSession(deck, todayIso(), limit, includeAll)
      if (picked.length === 0) {
        setError(
          'Không có từ nào đến hạn ôn. Hãy bật "Học cả từ chưa đến hạn" hoặc chọn thêm unit.',
        )
        return
      }
      begin(picked)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được từ vựng')
    } finally {
      setBusy(false)
    }
  }

  // Lưu kết quả lượt học (SM-2, chuỗi ngày, thống kê)
  const persist = useCallback(async (session: Session, unitIds: number[]) => {
    setPhase({ kind: 'result', session, save: { status: 'saving' } })
    const update = (save: SaveState) =>
      setPhase((p) =>
        p.kind === 'result' && p.session === session ? { ...p, save } : p,
      )
    try {
      const info = await saveSession(session, unitIds)
      update({ status: 'saved', info })
    } catch (e) {
      update({
        status: 'error',
        message: e instanceof Error ? e.message : 'Lỗi không xác định',
      })
    }
  }, [])

  const handleFinish = useCallback(
    (session: Session) => {
      if (savedRef.current.has(session)) return
      savedRef.current.add(session)
      void persist(session, [...selected])
    },
    [persist, selected],
  )

  if (phase.kind === 'play') {
    return (
      <StudyPlay
        key={phase.run}
        initial={phase.session}
        onFinish={handleFinish}
        onQuit={() => setPhase({ kind: 'select' })}
      />
    )
  }

  if (phase.kind === 'result') {
    return (
      <StudyResult
        session={phase.session}
        save={phase.save}
        onRetrySave={() => void persist(phase.session, [...selected])}
        onPracticeWeak={begin}
        onNew={() => setPhase({ kind: 'select' })}
      />
    )
  }

  const hasUnits = sources?.some((s) => s.books.some((b) => b.units.length > 0))

  return (
    <section className="card">
      <h1>Học từ vựng</h1>
      {review && (
        <p className="mode-note">
          Đã chọn tất cả unit. Từ đến hạn ôn được xếp trước, rồi đến từ mới.
        </p>
      )}

      <fieldset className="mode-pick">
        <legend>Chế độ học</legend>
        {([1, 2, 3] as Mode[]).map((m) => (
          <label key={m} className={mode === m ? 'mode-card active' : 'mode-card'}>
            <input
              type="radio"
              name="mode"
              checked={mode === m}
              onChange={() => setMode(m)}
            />
            <span>
              <strong>
                {m}. {MODES[m].name}
              </strong>
              <br />
              <small>{MODES[m].desc}</small>
            </span>
          </label>
        ))}
        {mode === 1 && (
          <p className="mode-note">
            Từ nào chưa có câu ví dụ trong Sheet sẽ hiện nghĩa thay cho câu.
          </p>
        )}
      </fieldset>

      {sources === null && !error && <p className="loading">Đang tải...</p>}
      {sources && !hasUnits && (
        <p>
          Bạn chưa có từ nào.{' '}
          <Link to="/vocab">Thêm Google Sheet ở mục Từ vựng</Link> trước nhé.
        </p>
      )}

      {sources?.map((s) =>
        s.books.map((b) => (
          <div key={b.id} className="tab-box">
            <h3>{b.name}</h3>
            <div className="unit-checks">
              {b.units.map((u) => (
                <label key={u.id} className="check">
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggle(u.id)}
                  />
                  <span>
                    {u.name} ({u.count} từ)
                  </span>
                </label>
              ))}
            </div>
          </div>
        )),
      )}

      {hasUnits && (
        <>
          <div className="study-options">
            <label className="map-field">
              <span>Số từ mỗi lượt</span>
              <input
                type="number"
                min={1}
                max={200}
                value={limit}
                onChange={(e) =>
                  setLimit(Math.min(200, Math.max(1, Number(e.target.value) || 1)))
                }
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={shuffle}
                onChange={(e) => setShuffle(e.target.checked)}
              />
              <span>Xáo trộn thứ tự</span>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={includeAll}
                onChange={(e) => setIncludeAll(e.target.checked)}
              />
              <span>Học cả từ chưa đến hạn ôn</span>
            </label>
          </div>
          <button className="primary-btn" onClick={handleStart} disabled={busy}>
            {busy ? 'Đang tải từ...' : 'Bắt đầu học'}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}