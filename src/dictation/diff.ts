// Chấm bài nghe chép: so văn bản người học gõ với văn bản gốc, từng từ một.
// Module độc lập, không dùng DOM/React, chạy được ở trình duyệt lẫn máy chủ.

export type ItemType = 'correct' | 'spelling' | 'misheard' | 'missing' | 'extra'

export type GradeOptions = {
  strict?: boolean // true = chấm cả dấu câu và chữ hoa/thường
  homophones?: 'misheard' | 'spelling' // từ đồng âm (there/their) tính là nghe sai hay sai chính tả
}

export type Counts = {
  correct: number // từ gốc gõ đúng
  spelling: number // từ gốc nghe đúng nhưng gõ sai
  misheard: number // từ gốc nghe sai
  missing: number // từ gốc bị bỏ sót
  extra: number // từ gõ thừa (không thuộc văn bản gốc)
}

// Ngưỡng độ tương đồng ký tự để phân biệt "sai chính tả" với "nghe sai"
export const SPELL_SIM = 0.7
const MIN_LEN_FOR_SPELLING = 5 // từ quá ngắn (cat/car, the/they) là từ khác nhau, không phải lỗi gõ
const SPELL_COST = 0.4

// ---------------------------------------------------------------- tách từ

// Từ = chuỗi chữ hoặc số, giữ dấu nháy và gạch nối bên trong (don't, well-known) và số có dấu phân cách (1,000 hay 3.5)
const TOKEN_RE = /\d+(?:[.,]\d+)+|[\p{L}\p{N}]+(?:['’‘`´\-‐‑][\p{L}\p{N}]+)*/gu

export function countTokens(text: string): number {
  return text.match(TOKEN_RE)?.length ?? 0
}

type Unit = {
  key: string // dạng so sánh: chữ thường, dấu nháy và gạch nối đã chuẩn hóa
  sq: string // key bỏ dấu cách, nháy, gạch nối, dấu phụ (dont = don't, wellknown = well-known)
  num: number | null // giá trị số nếu là số (5, five, twenty-one)
  exp: string[] // các cách viết đầy đủ nếu là từ rút gọn (I'm -> i am)
}

export type Token = Unit & {
  raw: string // chữ hiển thị (giữ nguyên hoa/thường)
  norm: string // raw đã chuẩn hóa dấu nháy, còn nguyên hoa/thường
  start: number
  end: number
  lead: string // dấu câu dính ngay trước từ (như dấu ngoặc kép mở)
  trail: string // dấu câu dính ngay sau từ (như dấu chấm, phẩy)
  hom: number // nhóm từ đồng âm, -1 nếu không có
}

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const squash = (s: string) => fold(s).replace(/[\s'\-]/g, '')
const normPunct = (s: string) => s.replace(/[’‘´`]/g, "'").replace(/[“”]/g, '"')

const UNIT_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
}
const TEEN_WORDS: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS_WORDS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}

// Các kiểu từ được phép đứng sau nhau trong số viết bằng chữ (U đơn vị, T mười-mười chín, D chục, H hundred, K thousand, A and)
const NEXT: Record<string, string> = {
  '': 'UTD', U: 'HK', T: 'HK', D: 'UHK', H: 'AUTDK', K: 'AUTDH', A: 'UTD',
}

function parseNumberWords(words: string[]): number | null {
  if (words.length === 0 || words.length > 9) return null
  if (words.length === 1 && words[0] === 'zero') return 0
  let total = 0
  let cur = 0
  let prev = ''
  for (const w of words) {
    let kind = ''
    let value = 0
    if (w in UNIT_WORDS) [kind, value] = ['U', UNIT_WORDS[w]]
    else if (w in TEEN_WORDS) [kind, value] = ['T', TEEN_WORDS[w]]
    else if (w in TENS_WORDS) [kind, value] = ['D', TENS_WORDS[w]]
    else if (w === 'hundred') kind = 'H'
    else if (w === 'thousand') kind = 'K'
    else if (w === 'and') kind = 'A'
    else return null
    if (!NEXT[prev].includes(kind)) return null
    if (kind === 'U' || kind === 'T' || kind === 'D') cur += value
    else if (kind === 'H') cur *= 100
    else if (kind === 'K') {
      total += cur * 1000
      cur = 0
    }
    prev = kind
  }
  return prev === 'A' ? null : total + cur
}

function numberValue(key: string): number | null {
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(key) || /^\d+(?:\.\d+)?$/.test(key)) {
    return Number(key.replace(/,/g, ''))
  }
  if (!/[a-z]/.test(key)) return null
  return parseNumberWords(key.split(/[\s-]+/).filter(Boolean))
}

const NUMBER_WORDS = new Set([
  ...Object.keys(UNIT_WORDS), ...Object.keys(TEEN_WORDS), ...Object.keys(TENS_WORDS),
  'zero', 'hundred', 'thousand', 'and',
])

// spans[e] = các cụm từ số viết bằng chữ dài từ 3 từ trở lên kết thúc ngay trước vị trí e,
// kèm giá trị (one hundred and five -> 105). Cụm 2 từ do cặp từ xử lý.
function numberSpans(tokens: Array<{ key: string }>): Array<Array<[number, number]>> {
  const spans: Array<Array<[number, number]>> = []
  let run = 0
  for (let e = 0; e <= tokens.length; e++) {
    spans[e] = []
    for (let len = 3; len <= Math.min(run, 8); len++) {
      const words = tokens.slice(e - len, e).flatMap((t) => t.key.split('-'))
      const v = parseNumberWords(words)
      if (v !== null) spans[e].push([len, v])
    }
    if (e < tokens.length) {
      run = tokens[e].key.split('-').every((w) => NUMBER_WORDS.has(w)) ? run + 1 : 0
    }
  }
  return spans
}

const IRREGULAR: Record<string, string[]> = {
  "can't": ['cannot', 'can not'],
  "won't": ['will not'],
  "shan't": ['shall not'],
  "let's": ['let us'],
  "ain't": ['am not', 'is not', 'are not'],
  "y'all": ['you all'],
}

function expand(key: string): string[] {
  if (IRREGULAR[key]) return IRREGULAR[key]
  let m: RegExpExecArray | null
  if ((m = /^(.+)n't$/.exec(key))) return [`${m[1]} not`]
  if ((m = /^(.+)'re$/.exec(key))) return [`${m[1]} are`]
  if ((m = /^(.+)'m$/.exec(key))) return [`${m[1]} am`]
  if ((m = /^(.+)'ll$/.exec(key))) return [`${m[1]} will`, `${m[1]} shall`]
  if ((m = /^(.+)'ve$/.exec(key))) return [`${m[1]} have`]
  if ((m = /^(.+)'d$/.exec(key))) return [`${m[1]} would`, `${m[1]} had`]
  if ((m = /^(.+)'s$/.exec(key))) return [`${m[1]} is`, `${m[1]} has`]
  return []
}

// Nhóm từ đồng âm (nghe giống nhau, viết khác nhau)
const HOMOPHONE_GROUPS = [
  ['there', 'their', "they're"], ['to', 'too', 'two'], ['your', "you're"],
  ['its', "it's"], ['write', 'right', 'rite'], ['know', 'no'], ['see', 'sea'],
  ['hear', 'here'], ['whether', 'weather'], ['which', 'witch'], ['buy', 'by', 'bye'],
  ['one', 'won'], ['for', 'four', 'fore'], ['be', 'bee'], ['new', 'knew'],
  ['would', 'wood'], ['whole', 'hole'], ['piece', 'peace'], ['week', 'weak'],
  ['wait', 'weight'], ['where', 'wear'], ['meet', 'meat'], ['sun', 'son'],
  ['flower', 'flour'], ['hour', 'our'], ['plain', 'plane'], ['role', 'roll'],
  ['sale', 'sail'], ['tail', 'tale'], ['threw', 'through'], ['than', 'then'],
  ['accept', 'except'], ['affect', 'effect'], ['brake', 'break'], ['dear', 'deer'],
  ['die', 'dye'], ['eye', 'i'], ['made', 'maid'], ['mail', 'male'], ['pair', 'pear'],
  ['principal', 'principle'], ['steal', 'steel'], ['wave', 'waive'],
]
const HOMOPHONE_INDEX = new Map<string, number>()
HOMOPHONE_GROUPS.forEach((g, i) => g.forEach((w) => HOMOPHONE_INDEX.set(w, i)))

function makeUnit(key: string): Unit {
  return { key, sq: squash(key), num: numberValue(key), exp: expand(key) }
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  for (const m of text.matchAll(TOKEN_RE)) {
    const raw = m[0]
    const norm = raw.replace(/[’‘`´]/g, "'").replace(/[‐‑]/g, '-').normalize('NFC')
    const key = norm.toLowerCase()
    tokens.push({
      ...makeUnit(key),
      raw,
      norm,
      start: m.index,
      end: m.index + raw.length,
      lead: '',
      trail: '',
      hom: HOMOPHONE_INDEX.get(key) ?? -1,
    })
  }
  // Dấu câu nằm giữa hai từ: phần sát từ trước là "trail", phần sát từ sau là "lead"
  for (let k = 0; k <= tokens.length; k++) {
    const from = k === 0 ? 0 : tokens[k - 1].end
    const to = k === tokens.length ? text.length : tokens[k].start
    const gap = text.slice(from, to)
    const firstSpace = gap.search(/\s/)
    if (k > 0) tokens[k - 1].trail = firstSpace === -1 ? gap : gap.slice(0, firstSpace)
    if (k < tokens.length) {
      const m = /\S*$/.exec(gap)
      tokens[k].lead = m ? m[0] : ''
    }
  }
  return tokens
}

// ---------------------------------------------------------------- so sánh hai từ

function osa(a: string, b: string): number {
  const la = a.length
  const lb = b.length
  if (!la) return lb
  if (!lb) return la
  let prev2 = new Array<number>(lb + 1).fill(0)
  let prev = Array.from({ length: lb + 1 }, (_, j) => j)
  let cur = new Array<number>(lb + 1).fill(0)
  for (let i = 1; i <= la; i++) {
    cur[0] = i
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1) // đảo hai chữ cái liền nhau (recieve)
      }
      cur[j] = v
    }
    ;[prev2, prev, cur] = [prev, cur, prev2]
  }
  return prev[lb]
}

const SUFFIXES = ['s', 'es', 'ed', 'd', 'ing', 'ly', 'er', 'ers', 'est']

// apple/apples, walk/walked: khác đuôi từ là lỗi nghe, không phải lỗi gõ
function suffixOnly(a: string, b: string): boolean {
  const [s, l] = a.length <= b.length ? [a, b] : [b, a]
  return l.length > s.length && l.startsWith(s) && SUFFIXES.includes(l.slice(s.length))
}

function unitsMatch(a: Unit, b: Unit): 'exact' | 'spelling' | null {
  if (a.key === b.key) return 'exact'
  if (a.num !== null && a.num === b.num) return 'exact' // 5 = five
  if (a.sq === b.sq) return 'spelling' // dont, its, wellknown, café/cafe
  if (a.exp.includes(b.key) || b.exp.includes(a.key)) return 'spelling' // I'm / I am
  return null
}

function sameSurface(a: Token, b: Token): boolean {
  return (
    a.norm === b.norm &&
    normPunct(a.lead) === normPunct(b.lead) &&
    normPunct(a.trail) === normPunct(b.trail)
  )
}

type Pair = { type: 'correct' | 'spelling' | 'misheard'; cost: number; hom: boolean }
type Opt = { strict: boolean; homophones: 'misheard' | 'spelling' }

function pair(a: Token, b: Token, opt: Opt): Pair {
  const m = unitsMatch(a, b)
  if (m === 'exact') {
    if (opt.strict && a.key === b.key && !sameSurface(a, b)) {
      return { type: 'spelling', cost: SPELL_COST, hom: false }
    }
    return { type: 'correct', cost: 0, hom: false }
  }
  if (m === 'spelling') return { type: 'spelling', cost: SPELL_COST, hom: false }

  const hom = a.hom >= 0 && a.hom === b.hom
  if (hom && opt.homophones === 'spelling') return { type: 'spelling', cost: SPELL_COST, hom }

  const la = a.key.length
  const lb = b.key.length
  const max = Math.max(la, lb)
  let sim = 0
  if (max >= MIN_LEN_FOR_SPELLING && Math.abs(la - lb) <= max * 0.3) {
    sim = 1 - osa(a.key, b.key) / max
    if (sim >= SPELL_SIM && !suffixOnly(a.key, b.key)) {
      return { type: 'spelling', cost: SPELL_COST, hom }
    }
  }
  // Hơi đắt hơn "thiếu + thừa" khi ghép sai hai từ liền nhau, để ưu tiên giữ lại các từ khớp
  return { type: 'misheard', cost: 1.1 - 0.1 * sim, hom }
}

// ---------------------------------------------------------------- căn chỉnh hai dãy từ

const M = 1 // 1 từ gốc <-> 1 từ gõ
const G = 2 // 2 từ gốc <-> 1 từ gõ (I am -> I'm, twenty one -> 21)
const S = 3 // 1 từ gốc <-> 2 từ gõ (I'm -> I am)
const D = 4 // thiếu từ gốc
const I = 5 // thừa từ gõ

type Step = { op: number; i: number; j: number; k: number } // i, j: vị trí bắt đầu; k: số từ của nhóm (G, S)

function pairUnits(tokens: Token[]): Unit[] {
  const out: Unit[] = []
  for (let k = 0; k + 1 < tokens.length; k++) out.push(makeUnit(tokens[k].key + ' ' + tokens[k + 1].key))
  return out
}

function align(orig: Token[], typed: Token[], opt: Opt, band: number | null): Step[] {
  const n = orig.length
  const m = typed.length
  const oPairs = pairUnits(orig)
  const tPairs = pairUnits(typed)
  const oSpans = numberSpans(orig)
  const tSpans = numberSpans(typed)
  const lows: number[] = []
  const highs: number[] = []
  const costs: Float64Array[] = []
  const ops: Uint8Array[] = []
  const ks: Uint8Array[] = []

  const get = (i: number, j: number) =>
    j < lows[i] || j > highs[i] ? Infinity : costs[i][j - lows[i]]

  for (let i = 0; i <= n; i++) {
    const center = n === 0 ? 0 : Math.round((i * m) / n)
    const lo = band === null ? 0 : Math.max(0, center - band)
    const hi = band === null ? m : Math.min(m, center + band)
    lows[i] = lo
    highs[i] = hi
    costs[i] = new Float64Array(hi - lo + 1).fill(Infinity)
    ops[i] = new Uint8Array(hi - lo + 1)
    ks[i] = new Uint8Array(hi - lo + 1)
    for (let j = lo; j <= hi; j++) {
      if (i === 0 && j === 0) {
        costs[0][0] = 0
        continue
      }
      let best = Infinity
      let bo = 0
      let bk = 0
      if (i > 0 && j > 0) {
        const c = get(i - 1, j - 1)
        if (c < Infinity) {
          const v = c + pair(orig[i - 1], typed[j - 1], opt).cost
          if (v < best) [best, bo] = [v, M]
        }
      }
      if (i > 1 && j > 0) {
        const g = unitsMatch(oPairs[i - 2], typed[j - 1])
        const c = g ? get(i - 2, j - 1) : Infinity
        if (c < Infinity) {
          const v = c + (g === 'exact' ? 0 : SPELL_COST)
          if (v < best) [best, bo, bk] = [v, G, 2]
        }
      }
      if (j > 0) {
        for (const [k, val] of oSpans[i]) {
          if (typed[j - 1].num !== val) continue
          const c = get(i - k, j - 1)
          if (c < best) [best, bo, bk] = [c, G, k]
        }
      }
      if (i > 0 && j > 1) {
        const g = unitsMatch(orig[i - 1], tPairs[j - 2])
        const c = g ? get(i - 1, j - 2) : Infinity
        if (c < Infinity) {
          const v = c + (g === 'exact' ? 0 : SPELL_COST)
          if (v < best) [best, bo, bk] = [v, S, 2]
        }
      }
      if (i > 0) {
        for (const [k, val] of tSpans[j]) {
          if (orig[i - 1].num !== val) continue
          const c = get(i - 1, j - k)
          if (c < best) [best, bo, bk] = [c, S, k]
        }
      }
      if (i > 0) {
        const v = get(i - 1, j) + 1
        if (v < best) [best, bo] = [v, D]
      }
      if (j > 0) {
        const v = get(i, j - 1) + 1
        if (v < best) [best, bo] = [v, I]
      }
      costs[i][j - lo] = best
      ops[i][j - lo] = bo
      ks[i][j - lo] = bk
    }
  }

  const steps: Step[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    const op = ops[i][j - lows[i]]
    const k = ks[i][j - lows[i]]
    const di = op === M ? 1 : op === G ? k : op === S ? 1 : op === D ? 1 : 0
    const dj = op === M ? 1 : op === G ? 1 : op === S ? k : op === D ? 0 : 1
    if (op === 0) throw new Error('Không căn chỉnh được hai văn bản')
    i -= di
    j -= dj
    steps.push({ op, i, j, k })
  }
  return steps.reverse()
}

// ---------------------------------------------------------------- kết quả

export type GradeItem = {
  type: ItemType
  orig: string[] // từ gốc (hiển thị)
  typed: string[] // từ người học gõ
  origRange: [number, number] // vị trí trong dãy từ gốc [từ, đến)
  typedRange: [number, number]
  homophone: boolean
}

export type GradeResult = {
  items: GradeItem[]
  counts: Counts
  total: number // tổng số từ gốc
  listenPct: number
  typePct: number
  score: number
  strict: boolean
  origTokens: Token[]
  typedTokens: Token[]
}

const round1 = (x: number) => Math.round(x * 10) / 10

// % nghe đúng = (đúng + sai chính tả) / tổng từ gốc
// % gõ đúng  = đúng / tổng từ gốc
// Điểm tổng  = (đúng + 0,5 x sai chính tả) / (tổng từ gốc + từ thừa)
export function scoreFromCounts(c: Counts): {
  total: number
  listenPct: number
  typePct: number
  score: number
} {
  const total = c.correct + c.spelling + c.misheard + c.missing
  if (total === 0) return { total: 0, listenPct: 0, typePct: 0, score: 0 }
  return {
    total,
    listenPct: round1(((c.correct + c.spelling) / total) * 100),
    typePct: round1((c.correct / total) * 100),
    score: round1(((c.correct + 0.5 * c.spelling) / (total + c.extra)) * 100),
  }
}

const MAX_FULL_CELLS = 600_000

function run(
  origText: string,
  typedText: string,
  options: GradeOptions,
  forceBand: number | null,
): GradeResult {
  const opt: Opt = {
    strict: options.strict ?? false,
    homophones: options.homophones ?? 'misheard',
  }
  const orig = tokenize(origText)
  const typed = tokenize(typedText)

  // Bỏ phần đầu và phần cuối giống hệt nhau để căn chỉnh nhanh hơn
  let pre = 0
  const maxPre = Math.min(orig.length, typed.length)
  while (
    pre < maxPre &&
    orig[pre].key === typed[pre].key &&
    pair(orig[pre], typed[pre], opt).type === 'correct'
  ) {
    pre++
  }
  let suf = 0
  const maxSuf = Math.min(orig.length, typed.length) - pre
  while (
    suf < maxSuf &&
    orig[orig.length - 1 - suf].key === typed[typed.length - 1 - suf].key &&
    pair(orig[orig.length - 1 - suf], typed[typed.length - 1 - suf], opt).type === 'correct'
  ) {
    suf++
  }

  const midO = orig.slice(pre, orig.length - suf)
  const midT = typed.slice(pre, typed.length - suf)
  let band: number | null = forceBand
  if (band === null && midO.length * midT.length > MAX_FULL_CELLS) {
    const lo = Math.max(1, Math.min(midO.length, midT.length))
    band = 200 + Math.ceil(Math.max(midO.length, midT.length) / lo)
  }
  const steps = align(midO, midT, opt, band)

  const items: GradeItem[] = []
  const pushItem = (
    type: ItemType,
    oFrom: number,
    oTo: number,
    tFrom: number,
    tTo: number,
    homophone = false,
  ) =>
    items.push({
      type,
      orig: orig.slice(oFrom, oTo).map((t) => t.raw),
      typed: typed.slice(tFrom, tTo).map((t) => t.raw),
      origRange: [oFrom, oTo],
      typedRange: [tFrom, tTo],
      homophone,
    })

  for (let k = 0; k < pre; k++) pushItem('correct', k, k + 1, k, k + 1)
  for (const s of steps) {
    const i = s.i + pre
    const j = s.j + pre
    if (s.op === M) {
      const p = pair(orig[i], typed[j], opt)
      pushItem(p.type, i, i + 1, j, j + 1, p.type === 'misheard' && p.hom)
    } else if (s.op === G) {
      // nhóm 2 từ: có thể là sai chính tả (do not / don't); nhóm dài hơn luôn là số (one hundred five = 105)
      const g = s.k === 2 ? unitsMatch(pairUnits(orig.slice(i, i + 2))[0], typed[j]) : 'exact'
      pushItem(g === 'exact' ? 'correct' : 'spelling', i, i + s.k, j, j + 1)
    } else if (s.op === S) {
      const g = s.k === 2 ? unitsMatch(orig[i], pairUnits(typed.slice(j, j + 2))[0]) : 'exact'
      pushItem(g === 'exact' ? 'correct' : 'spelling', i, i + 1, j, j + s.k)
    } else if (s.op === D) {
      pushItem('missing', i, i + 1, j, j)
    } else {
      pushItem('extra', i, i, j, j + 1)
    }
  }
  for (let k = suf; k > 0; k--) {
    const i = orig.length - k
    const j = typed.length - k
    pushItem('correct', i, i + 1, j, j + 1)
  }

  const counts: Counts = { correct: 0, spelling: 0, misheard: 0, missing: 0, extra: 0 }
  for (const it of items) {
    counts[it.type] += it.type === 'extra' ? it.typed.length : it.orig.length
  }
  const pct = scoreFromCounts(counts)
  return {
    items,
    counts,
    total: pct.total,
    listenPct: pct.listenPct,
    typePct: pct.typePct,
    score: pct.score,
    strict: opt.strict,
    origTokens: orig,
    typedTokens: typed,
  }
}

export function grade(
  origText: string,
  typedText: string,
  options: GradeOptions = {},
): GradeResult {
  return run(origText, typedText, options, null)
}

// Dùng để kiểm thử cách căn chỉnh theo dải hẹp (cho văn bản rất dài)
export function gradeBanded(
  origText: string,
  typedText: string,
  band: number,
  options: GradeOptions = {},
): GradeResult {
  return run(origText, typedText, options, band)
}

// ---------------------------------------------------------------- hiển thị

export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'item'; item: GradeItem; text: string }

// Chia văn bản (bài gõ hoặc văn bản gốc) thành các đoạn: chữ thường và các từ có kết quả chấm.
// Giữ nguyên dấu câu, khoảng trắng, xuống dòng của văn bản.
export function segments(
  text: string,
  result: GradeResult,
  side: 'typed' | 'orig',
): Segment[] {
  const tokens = side === 'typed' ? result.typedTokens : result.origTokens
  const out: Segment[] = []
  let pos = 0
  for (const item of result.items) {
    const [from, to] = side === 'typed' ? item.typedRange : item.origRange
    if (from === to) {
      // thiếu từ chỉ hiện ở bài gõ; từ thừa chỉ hiện ở bài gõ
      if (side === 'typed' && item.type === 'missing') out.push({ kind: 'item', item, text: '' })
      continue
    }
    const first = tokens[from]
    const last = tokens[to - 1]
    if (first.start > pos) out.push({ kind: 'text', text: text.slice(pos, first.start) })
    out.push({ kind: 'item', item, text: text.slice(first.start, last.end) })
    pos = last.end
  }
  if (pos < text.length) out.push({ kind: 'text', text: text.slice(pos) })
  return out
}

export type ErrorEntry = { type: Exclude<ItemType, 'correct'>; orig: string; typed: string; homophone: boolean }

export function errorList(result: GradeResult): ErrorEntry[] {
  return result.items
    .filter((it) => it.type !== 'correct')
    .map((it) => ({
      type: it.type as ErrorEntry['type'],
      orig: it.orig.join(' '),
      typed: it.typed.join(' '),
      homophone: it.homophone,
    }))
}