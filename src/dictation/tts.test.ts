import { describe, expect, it } from 'vitest'
import { SentencePlayer, type PlayerState, type Synth } from './tts'

class FakeSynth implements Synth {
  spoken: Array<{ text: string; speed: number }> = []
  cancels = 0
  ends: Array<() => void> = []
  errors: Array<() => void> = []
  speak(text: string, o: { speed: number; onEnd: () => void; onError: () => void }) {
    this.spoken.push({ text, speed: o.speed })
    this.ends.push(o.onEnd)
    this.errors.push(o.onError)
  }
  cancel() {
    this.cancels++
  }
  finish() {
    this.ends[this.ends.length - 1]()
  }
}

const S = ['One.', 'Two.', 'Three.']
function setup(mode: 'flow' | 'step' = 'step') {
  const synth = new FakeSynth()
  const log = { listens: 0, errors: 0, last: null as PlayerState | null }
  const p = new SentencePlayer(
    S,
    synth,
    {
      onChange: (s) => (log.last = s),
      onListenStart: () => log.listens++,
      onError: () => log.errors++,
    },
    mode,
  )
  return { p, synth, log }
}

describe('chế độ từng câu', () => {
  it('đọc một câu rồi dừng, bấm tiếp thì sang câu kế, hết bài thì quay lại câu đầu', () => {
    const { p, synth, log } = setup('step')
    p.play()
    expect(synth.spoken.map((s) => s.text)).toEqual(['One.'])
    expect(log.listens).toBe(1)
    synth.finish()
    expect(log.last).toMatchObject({ playing: false, finished: true, index: 0 })

    p.play()
    expect(synth.spoken.at(-1)?.text).toBe('Two.')
    synth.finish()
    p.play()
    expect(synth.spoken.at(-1)?.text).toBe('Three.')
    synth.finish()
    expect(log.listens).toBe(1)

    p.play() // hết bài, quay lại đầu: một lần nghe mới
    expect(synth.spoken.at(-1)?.text).toBe('One.')
    expect(log.listens).toBe(2)
  })
  it('nghe lại câu không tính là lần nghe mới', () => {
    const { p, synth, log } = setup('step')
    p.play()
    synth.finish()
    p.replay()
    expect(synth.spoken.map((s) => s.text)).toEqual(['One.', 'One.'])
    expect(log.listens).toBe(1)
  })
})

describe('chế độ liền mạch', () => {
  it('đọc hết các câu liên tiếp rồi về đầu bài', () => {
    const { p, synth, log } = setup('flow')
    p.play()
    synth.finish()
    synth.finish()
    expect(synth.spoken.map((s) => s.text)).toEqual(['One.', 'Two.', 'Three.'])
    synth.finish()
    expect(log.last).toMatchObject({ playing: false, index: 0, finished: false })
    expect(log.listens).toBe(1)
    p.play()
    expect(log.listens).toBe(2)
  })
  it('đổi chế độ khi đang đọc thì áp dụng từ câu kế', () => {
    const { p, synth, log } = setup('flow')
    p.play()
    p.setMode('step')
    synth.finish()
    expect(synth.spoken).toHaveLength(1)
    expect(log.last).toMatchObject({ playing: false, finished: true })
  })
})

describe('tạm dừng, tốc độ, di chuyển', () => {
  it('tạm dừng giữa câu đầu rồi phát lại không tính thêm lần nghe', () => {
    const { p, synth, log } = setup('step')
    p.play()
    p.pause()
    expect(log.last?.playing).toBe(false)
    p.play()
    expect(synth.spoken.map((s) => s.text)).toEqual(['One.', 'One.'])
    expect(log.listens).toBe(1)
  })
  it('đổi tốc độ khi đang đọc thì đọc lại câu đó với tốc độ mới', () => {
    const { p, synth, log } = setup('step')
    p.play()
    p.setSpeed(0.75)
    expect(synth.spoken.map((s) => s.speed)).toEqual([1, 0.75])
    expect(log.listens).toBe(1)
  })
  it('đổi tốc độ khi đang dừng thì chỉ ghi nhận, chưa đọc', () => {
    const { p, synth, log } = setup('step')
    p.setSpeed(1.25)
    expect(synth.spoken).toHaveLength(0)
    expect(log.last?.speed).toBe(1.25)
  })
  it('câu sau, câu trước và giới hạn đầu cuối', () => {
    const { p, synth } = setup('step')
    p.play()
    p.next()
    p.next()
    p.next() // đã ở câu cuối: không làm gì
    expect(synth.spoken.map((s) => s.text)).toEqual(['One.', 'Two.', 'Three.'])
    p.prev()
    expect(synth.spoken.at(-1)?.text).toBe('Two.')
    p.prev()
    p.prev() // đã ở câu đầu: đọc lại câu đầu
    expect(synth.spoken.at(-1)?.text).toBe('One.')
  })
})

describe('an toàn', () => {
  it('bỏ qua sự kiện kết thúc muộn của lượt đã bị hủy', () => {
    const { p, synth, log } = setup('flow')
    p.play()
    const stale = synth.ends[0]
    p.pause()
    stale()
    expect(log.last?.playing).toBe(false)
    expect(synth.spoken).toHaveLength(1)
  })
  it('lỗi giọng đọc thì dừng và báo lỗi', () => {
    const { p, synth, log } = setup('step')
    p.play()
    synth.errors[0]()
    expect(log.last?.playing).toBe(false)
    expect(log.errors).toBe(1)
  })
  it('destroy hủy đang đọc và không phát sự kiện nữa', () => {
    const { p, synth, log } = setup('flow')
    p.play()
    const before = synth.cancels
    p.destroy()
    expect(synth.cancels).toBe(before + 1)
    synth.finish()
    expect(synth.spoken).toHaveLength(1)
    p.play()
    expect(synth.spoken).toHaveLength(1)
    expect(log.errors).toBe(0)
  })
  it('bài không có câu nào thì không làm gì', () => {
    const synth = new FakeSynth()
    const p = new SentencePlayer([], synth, { onChange: () => {}, onListenStart: () => {}, onError: () => {} })
    p.play()
    expect(synth.spoken).toHaveLength(0)
  })
})