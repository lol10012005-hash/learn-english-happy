// Âm thanh tổng hợp bằng Web Audio (không cần file âm thanh)
import type { GameEvent } from './engine'

type AudioCtor = typeof AudioContext

let ctx: AudioContext | null = null
let muted = readMuted()

function readMuted(): boolean {
  try {
    return localStorage.getItem('muted') === '1'
  } catch {
    return false
  }
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(value: boolean): void {
  muted = value
  try {
    localStorage.setItem('muted', value ? '1' : '0')
  } catch {
    // bỏ qua nếu trình duyệt chặn localStorage
  }
}

function getContext(): AudioContext | null {
  if (!ctx) {
    const Ctor: AudioCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
    if (!Ctor) return null
    try {
      ctx = new Ctor()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(
  c: AudioContext,
  freq: number,
  at: number,
  dur: number,
  type: OscillatorType,
  vol: number,
) {
  const osc = c.createOscillator()
  const gain = c.createGain()
  const t = c.currentTime + at
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

export function playEvent(event: GameEvent): void {
  if (muted) return
  const c = getContext()
  if (!c) return
  switch (event) {
    case 'correct':
      tone(c, 660, 0, 0.12, 'sine', 0.2)
      tone(c, 880, 0.1, 0.18, 'sine', 0.2)
      break
    case 'wrong':
      tone(c, 220, 0, 0.18, 'sawtooth', 0.12)
      break
    case 'fail':
      tone(c, 330, 0.05, 0.15, 'triangle', 0.18)
      tone(c, 247, 0.2, 0.15, 'triangle', 0.18)
      tone(c, 196, 0.35, 0.3, 'triangle', 0.18)
      break
    case 'combo':
      ;[523, 659, 784, 1047].forEach((f, i) => tone(c, f, 0.25 + i * 0.08, 0.15, 'square', 0.1))
      break
    case 'done':
      ;[523, 659, 784, 1047].forEach((f, i) => tone(c, f, i * 0.13, 0.25, 'sine', 0.22))
      break
    case 'click':
      tone(c, 800, 0, 0.05, 'square', 0.08)
      break
  }
}