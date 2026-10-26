// Bộ điều khiển đọc văn bản từng câu bằng giọng đọc của trình duyệt.
// Không dùng DOM trực tiếp: giọng đọc được truyền vào qua "Synth" nên kiểm thử được.

export type PlayMode = 'flow' | 'step' // flow = đọc liền mạch, step = đọc từng câu rồi dừng

export type PlayerState = {
  index: number // câu hiện tại (bắt đầu từ 0)
  total: number
  playing: boolean
  finished: boolean // câu hiện tại đã đọc xong (chế độ từng câu đang chờ bấm tiếp)
  mode: PlayMode
  speed: number // hệ số tốc độ: 0.75, 1, 1.25
}

export type Synth = {
  speak(
    text: string,
    options: { speed: number; lang: string; onEnd: () => void; onError: () => void },
  ): void
  cancel(): void
}

type Listeners = {
  onChange: (state: PlayerState) => void
  onListenStart: () => void // mỗi lần bắt đầu nghe từ câu đầu tiên của bài
  onError: () => void
}

export class SentencePlayer {
  private index = 0
  private playing = false
  private finished = false
  private pausedMid = false
  private speed = 1
  private speaking = false
  private gen = 0 // đánh số lượt đọc để bỏ qua sự kiện muộn của lượt đã bị hủy
  private dead = false
  private sentences: string[]
  private synth: Synth
  private on: Listeners
  private mode: PlayMode
  private lang: string

  constructor(
    sentences: string[],
    synth: Synth,
    on: Listeners,
    mode: PlayMode = 'step',
    lang = 'en-US',
  ) {
    this.sentences = sentences
    this.synth = synth
    this.on = on
    this.mode = mode
    this.lang = lang
  }

  get state(): PlayerState {
    return {
      index: this.index,
      total: this.sentences.length,
      playing: this.playing,
      finished: this.finished,
      mode: this.mode,
      speed: this.speed,
    }
  }

  private emit() {
    if (!this.dead) this.on.onChange(this.state)
  }

  private read(i: number, count: boolean) {
    if (this.dead || i < 0 || i >= this.sentences.length) return
    if (this.speaking) this.synth.cancel()
    this.index = i
    this.playing = true
    this.finished = false
    this.pausedMid = false
    this.speaking = true
    const g = ++this.gen
    if (count && i === 0) this.on.onListenStart()
    this.synth.speak(this.sentences[i], {
      speed: this.speed,
      lang: this.lang,
      onEnd: () => this.ended(g),
      onError: () => this.failed(g),
    })
    this.emit()
  }

  private ended(g: number) {
    if (g !== this.gen || this.dead) return
    this.speaking = false
    if (this.mode === 'flow') {
      if (this.index + 1 < this.sentences.length) {
        this.read(this.index + 1, true)
        return
      }
      // Hết bài: về đầu để lần phát sau tính là một lần nghe mới
      this.index = 0
      this.playing = false
      this.finished = false
    } else {
      this.playing = false
      this.finished = true
    }
    this.emit()
  }

  private failed(g: number) {
    if (g !== this.gen || this.dead) return
    this.speaking = false
    this.playing = false
    this.finished = false
    this.emit()
    this.on.onError()
  }

  play() {
    if (this.playing || this.sentences.length === 0) return
    const resume = this.pausedMid
    let i = this.index
    if (this.finished) i = this.index + 1 < this.sentences.length ? this.index + 1 : 0
    this.read(i, !resume)
  }

  pause() {
    if (!this.playing) return
    this.gen++
    this.synth.cancel()
    this.speaking = false
    this.playing = false
    this.finished = false
    this.pausedMid = true // bấm phát lại sẽ đọc lại câu đang dở, không tính là lần nghe mới
    this.emit()
  }

  toggle() {
    if (this.playing) this.pause()
    else this.play()
  }

  replay() {
    this.read(this.index, false)
  }

  next() {
    if (this.index + 1 < this.sentences.length) this.read(this.index + 1, true)
  }

  prev() {
    this.read(Math.max(0, this.index - 1), true)
  }

  setSpeed(speed: number) {
    this.speed = speed
    if (this.playing) this.read(this.index, false) // áp dụng tốc độ mới ngay
    else this.emit()
  }

  setMode(mode: PlayMode) {
    this.mode = mode
    this.emit()
  }

  destroy() {
    this.dead = true
    this.gen++
    if (this.speaking) this.synth.cancel()
    this.speaking = false
  }
}