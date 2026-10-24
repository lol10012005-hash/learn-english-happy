import { describe, expect, it } from 'vitest'
import {
  advance, checkAnswer, classify, createSession, currentWord, DEFAULT_GAME,
  evaluate, giveUp, hint, hintText, pickSession, verdict,
  type GameSettings, type StudyWord,
} from './engine'

const mk = (word: string, due: string | null = null): StudyWord => ({
  id: 1, key: word, word, meaning: 'nghĩa', example: '', extra: '', unit: 'Unit 1', book: 'B', due,
})
const noShuffle: GameSettings = { ...DEFAULT_GAME, shuffle: false }
const start = (...w: string[]) => createSession(w.map((x) => mk(x)), noShuffle)

describe('điểm theo lần thử', () => {
  it('đúng ngay lần 1 = 100', () => {
    const s = checkAnswer(start('necessary'), 'necessary', false)
    expect(s.state).toBe('correct')
    expect(s.lastPts).toBe(100)
    expect(s.firstTry).toBe(1)
  })
  it('đúng ở lần 2 = 60, lần 3 = 30', () => {
    let s = checkAnswer(start('apple'), 'xxx', true)
    expect(s.state).toBe('ask')
    s = checkAnswer(s, 'apple', true)
    expect(s.lastPts).toBe(60)
    expect(s.firstTry).toBe(0)

    let t = checkAnswer(start('apple'), 'x', true)
    t = checkAnswer(t, 'y', true)
    t = checkAnswer(t, 'apple', true)
    expect(t.lastPts).toBe(30)
  })
  it('không phân biệt hoa thường và khoảng trắng thừa', () => {
    const s = checkAnswer(start('Ice cream'), '  ice   CREAM ', false)
    expect(s.state).toBe('correct')
  })
  it('gõ chưa đủ thì không bị tính sai khi tự chấm', () => {
    const s = checkAnswer(start('apple'), 'app', false)
    expect(s.state).toBe('ask')
    expect(s.bad).toBe(0)
  })
})

describe('gợi ý', () => {
  it('dùng gợi ý thì đúng lần 1 còn 50 điểm và không tính "đúng ngay"', () => {
    let s = hint(start('apple'))
    expect(hintText(s)).toBe('Gợi ý: a …  (5 chữ)')
    s = checkAnswer(s, 'apple', false)
    expect(s.lastPts).toBe(50)
    expect(s.firstTry).toBe(0)
  })
  it('sai 1 lần rồi dùng gợi ý, đúng lần 2 = 60 x 0.5 = 30', () => {
    let s = checkAnswer(start('apple'), 'x', true)
    s = hint(s)
    s = checkAnswer(s, 'apple', false)
    expect(s.lastPts).toBe(30)
  })
  it('gợi ý tối đa là độ dài - 1', () => {
    let s = start('abc')
    for (let i = 0; i < 10; i++) s = hint(s)
    expect(s.hintLevel).toBe(2)
    expect(s.stats[0].hints).toBe(2)
  })
  it('tự gợi ý sau 2 lần sai và không tính là xin gợi ý', () => {
    let s = checkAnswer(start('banana'), 'x', true)
    expect(s.hintLevel).toBe(0)
    s = checkAnswer(s, 'y', true)
    expect(s.hintLevel).toBe(1)
    expect(s.stats[0].hints).toBe(0)
    s = checkAnswer(s, 'banana', true)
    expect(s.lastPts).toBe(30) // lần 3, không bị trừ 50%
  })
})

describe('hết lượt và bỏ qua', () => {
  it('sai 3 lần thì thất bại', () => {
    let s = start('apple')
    s = checkAnswer(s, 'a', true)
    s = checkAnswer(s, 'b', true)
    s = checkAnswer(s, 'c', true)
    expect(s.state).toBe('failed')
    expect(s.stats[0].failed).toBe(true)
    expect(s.combo).toBe(0)
    expect(s.events).toEqual(['wrong', 'fail'])
    expect(classify(s.stats[0])).toBe(0)
  })
  it('giveUp = thất bại ngay', () => {
    const s = giveUp(start('apple'))
    expect(s.state).toBe('failed')
  })
})

describe('combo và kết thúc', () => {
  it('chuỗi 5 đúng liên tiếp bắn sự kiện combo', () => {
    let s = start('a1', 'a2', 'a3', 'a4', 'a5')
    for (let i = 0; i < 5; i++) {
      const w = currentWord(s)!.word
      s = checkAnswer(s, w, false)
      if (i < 4) expect(s.events).toEqual(['correct'])
      s = advance(s)
    }
    expect(s.maxCombo).toBe(5)
    expect(s.score).toBe(500)
    expect(s.over).toBe(true)
  })
  it('sai thì mất combo', () => {
    let s = start('a', 'bb')
    s = advance(checkAnswer(s, 'a', false))
    expect(s.combo).toBe(1)
    s = checkAnswer(s, 'x', true)
    expect(s.combo).toBe(0)
    expect(s.maxCombo).toBe(1)
  })
  it('không advance khi chưa trả lời xong', () => {
    const s = start('apple')
    expect(advance(s)).toBe(s)
  })
  it('danh sách rỗng thì over ngay', () => {
    expect(createSession([], noShuffle).over).toBe(true)
  })
})

describe('đánh giá', () => {
  it('phân loại từng từ', () => {
    expect(classify({ word: mk('a'), wrong: 0, hints: 0, failed: false, done: true })).toBe(2)
    expect(classify({ word: mk('a'), wrong: 1, hints: 0, failed: false, done: true })).toBe(1)
    expect(classify({ word: mk('a'), wrong: 0, hints: 1, failed: false, done: true })).toBe(1)
    expect(classify({ word: mk('a'), wrong: 0, hints: 0, failed: true, done: true })).toBe(0)
  })
  it('ngưỡng cả bài giống bản Python', () => {
    expect(verdict([0, 0, 0])).toBeNull()
    expect(verdict([1, 1, 8])).toBe(2) // 80% thuộc, 10% không thuộc
    expect(verdict([2, 0, 8])).toBe(1) // 20% không thuộc > 10%
    expect(verdict([0, 7, 3])).toBe(0) // 30% thuộc < 40% => không thuộc bài
    expect(verdict([4, 2, 4])).toBe(0) // không thuộc 40%
    expect(verdict([0, 5, 5])).toBe(1)
  })
  it('evaluate sắp từ yếu lên đầu và bỏ từ chưa làm', () => {
    let s = start('a', 'bb', 'ccc')
    s = advance(checkAnswer(s, 'a', false))
    s = advance(giveUp(s))
    const { evals, counts } = evaluate(s.stats)
    expect(counts).toEqual([1, 0, 1])
    expect(evals[0].stat.word.word).toBe('bb')
  })
})

describe('chọn từ cho lượt học', () => {
  const deck = [mk('new1'), mk('later', '2026-12-01'), mk('due2', '2026-10-23'), mk('due1', '2026-10-01')]
  it('từ đến hạn trước (cũ nhất trước), rồi từ mới', () => {
    expect(pickSession(deck, '2026-10-24', 10).map((w) => w.word)).toEqual(['due1', 'due2', 'new1'])
  })
  it('giới hạn số từ', () => {
    expect(pickSession(deck, '2026-10-24', 2).map((w) => w.word)).toEqual(['due1', 'due2'])
  })
  it('includeAll thêm cả từ chưa đến hạn', () => {
    expect(pickSession(deck, '2026-10-24', 10, true).map((w) => w.word)).toContain('later')
  })
})