import { describe, expect, it } from 'vitest'
import {
  blankExample, checkAnswer, createSession, currentWord, DEFAULT_GAME, hint,
  hintLines, maskWord, maxHint, exampleFilled,
  type GameSettings, type StudyWord,
} from './engine'

const seeded = (seed = 7) => () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}
const mk = (word: string, example = '', meaning = 'nghĩa'): StudyWord => ({
  id: 1, key: word, word, meaning, example, extra: '', unit: 'U', book: 'B', due: null,
})
const plain: GameSettings = { ...DEFAULT_GAME, shuffle: false }

describe('che từ trong câu ví dụ', () => {
  it('từ nguyên dạng', () => {
    expect(blankExample('It is necessary to study.', 'necessary')).toEqual({
      text: 'It is ____ to study.', form: 'necessary',
    })
  })
  it('nhận các dạng -s, -ing bỏ e, gấp đôi phụ âm, y -> ies', () => {
    expect(blankExample('She studies hard', 'study')?.form).toBe('studies')
    expect(blankExample('He is making tea', 'make')?.form).toBe('making')
    expect(blankExample('They stopped here', 'stop')?.form).toBe('stopped')
    expect(blankExample('He improves daily', 'improve')?.form).toBe('improves')
  })
  it('không che nhầm từ dài hơn chứa từ cần học', () => {
    expect(blankExample('The category is big', 'cat')).toBeNull()
  })
  it('không phân biệt hoa thường, nhận cả dạng [____] kiểu cũ', () => {
    expect(blankExample('Improve it now', 'improve')?.text).toBe('____ it now')
    expect(blankExample('I want to [____] my English', 'improve')?.text).toBe(
      'I want to ____ my English',
    )
  })
  it('không có câu hoặc không tìm thấy thì trả về null', () => {
    expect(blankExample('', 'x')).toBeNull()
    expect(blankExample('Nothing here', 'apple')).toBeNull()
  })
  it('điền từ vào câu sau khi trả lời', () => {
    expect(exampleFilled(mk('go', 'I [____] home'))).toBe('I go home')
  })
})

describe('che 40% chữ', () => {
  it('giữ chữ đầu, che đúng số chữ', () => {
    const out = maskWord('necessary', seeded()).split(' ')
    expect(out).toHaveLength(9)
    expect(out[0]).toBe('n')
    expect(out.filter((c) => c === '_')).toHaveLength(4)
  })
  it('không che dấu cách trong cụm từ', () => {
    const out = maskWord('ice cream', seeded(3))
    expect(out.replace(/ /g, '').includes('_')).toBe(true)
    expect(Array.from(out).filter((c) => c !== ' ' && c !== '_').join('')).toContain('i')
  })
  it('từ 1 chữ thì che hết', () => {
    expect(maskWord('a')).toBe('_')
  })
})

describe('chế độ 1: điền vào câu', () => {
  const words = [mk('study', 'She studies hard', 'học')]
  it('đề là câu đã che, nhận cả từ gốc lẫn dạng trong câu', () => {
    const s = createSession(words, plain, seeded(), 1)
    expect(s.card.kind).toBe('sentence')
    expect(s.card.prompt).toBe('She ____ hard')
    expect(checkAnswer(s, 'studies', false).state).toBe('correct')
    expect(checkAnswer(s, 'study', false).state).toBe('correct')
  })
  it('nghĩa là bước gợi ý đầu tiên', () => {
    let s = createSession(words, plain, seeded(), 1)
    expect(maxHint(s)).toBe(5) // 5 chữ cái + 1 bước nghĩa
    s = hint(s)
    expect(hintLines(s)).toEqual(['Nghĩa: học'])
    s = hint(s)
    expect(hintLines(s)).toEqual(['Nghĩa: học', 'Gợi ý: s …  (5 chữ)'])
    expect(checkAnswer(s, 'study', false).lastPts).toBe(50)
  })
  it('từ không có câu ví dụ thì hiện nghĩa như chế độ 3', () => {
    const s = createSession([mk('apple', '', 'quả táo')], plain, seeded(), 1)
    expect(s.card.kind).toBe('meaning')
    expect(s.card.prompt).toBe('quả táo')
    expect(maxHint(s)).toBe(4)
  })
})

describe('chế độ 2: hoàn thành từ', () => {
  it('đề là từ bị che, nghĩa hiện sẵn theo cài đặt', () => {
    const s = createSession([mk('necessary')], plain, seeded(), 2)
    expect(s.card.kind).toBe('masked')
    expect(s.card.prompt.startsWith('n ')).toBe(true)
    expect(s.card.meaningVisible).toBe(true)
    expect(checkAnswer(s, 'necessary', false).state).toBe('correct')
  })
  it('tắt hiện nghĩa thì nghĩa thành bước gợi ý', () => {
    const s = createSession([mk('necessary')], { ...plain, showMeaningMode2: false }, seeded(), 2)
    expect(s.card.meaningVisible).toBe(false)
    expect(maxHint(s)).toBe(9)
    expect(currentWord(s)?.word).toBe('necessary')
  })
})