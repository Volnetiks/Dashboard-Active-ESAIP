// prettier-ignore
export type Reading = { id: number; time: string; room: string; temperatures: [number, number, number, number]; humidity: number }
// prettier-ignore
export type SensorStats = { index: number; min: number; max: number; avg: number; current: number; delta: number }
export type Range = { min: number; max: number; avg: number; current: number }
// prettier-ignore
export type SeriesPoint = { time: string; ts: number; s0: number; s1: number; s2: number; s3: number; humidity: number }
// prettier-ignore
export type RoomSummary = { room: string; count: number; latest: Reading; earliest: Reading; sensors: SensorStats[]; humidity: Range; series: SeriesPoint[] }

const SENSOR_INDICES = [0, 1, 2, 3] as const
export const SENSOR_LABELS = SENSOR_INDICES.map((i) => `Sensor ${i + 1}`)
export const SENSOR_COLORS = SENSOR_INDICES.map((i) => `var(--chart-${i + 1})`)

const ENDPOINT =
  process.env.TEMPERATURES_URL ?? "http://activesaip.thomasbechu.me/temperatures"
const SERIES_TARGET = 240

export async function fetchReadings(): Promise<Reading[]> {
  const res = await fetch(ENDPOINT, { cache: "no-store" })
  if (!res.ok) throw new Error(`Upstream ${res.status}`)
  return res.json()
}

const round = (n: number) => Math.round(n * 10) / 10

function buildPoint(r: Reading, overrides?: Partial<SeriesPoint>): SeriesPoint {
  const [s0, s1, s2, s3] = r.temperatures
  return { time: r.time, ts: new Date(r.time).getTime(), s0, s1, s2, s3, humidity: r.humidity, ...overrides }
}

function avgOver(slice: Reading[], get: (r: Reading) => number) {
  let sum = 0
  for (const r of slice) sum += get(r)
  return round(sum / slice.length)
}

function downsample(rs: Reading[], target: number): SeriesPoint[] {
  if (rs.length <= target) return rs.map((r) => buildPoint(r))
  const step = rs.length / target
  const out: SeriesPoint[] = []
  for (let i = 0; i < target; i++) {
    const slice = rs.slice(Math.floor(i * step), Math.floor((i + 1) * step))
    if (slice.length === 0) continue
    const mid = slice[Math.floor(slice.length / 2)]
    const [s0, s1, s2, s3] = SENSOR_INDICES.map((idx) =>
      avgOver(slice, (r) => r.temperatures[idx])
    )
    out.push(
      buildPoint(mid, { s0, s1, s2, s3, humidity: avgOver(slice, (r) => r.humidity) })
    )
  }
  return out
}

type Acc = { min: number; max: number; sum: number }
const newAcc = (): Acc => ({ min: Infinity, max: -Infinity, sum: 0 })
function feed(acc: Acc, v: number) {
  if (v < acc.min) acc.min = v
  if (v > acc.max) acc.max = v
  acc.sum += v
}
function finalize(acc: Acc, count: number, current: number): Range {
  return { min: round(acc.min), max: round(acc.max), avg: round(acc.sum / count), current }
}

function summarizeRoom(room: string, all: Reading[]): RoomSummary {
  all.sort((a, b) => a.id - b.id)
  const latest = all[all.length - 1]
  const earliest = all[0]
  const prev = all[all.length - 2] ?? latest

  const sensorAccs = SENSOR_INDICES.map(newAcc)
  const humidityAcc = newAcc()
  for (const r of all) {
    for (const i of SENSOR_INDICES) feed(sensorAccs[i], r.temperatures[i])
    feed(humidityAcc, r.humidity)
  }

  const sensors: SensorStats[] = SENSOR_INDICES.map((i) => ({
    index: i,
    ...finalize(sensorAccs[i], all.length, latest.temperatures[i]),
    delta: round(latest.temperatures[i] - prev.temperatures[i]),
  }))

  return {
    room,
    count: all.length,
    latest,
    earliest,
    sensors,
    humidity: finalize(humidityAcc, all.length, latest.humidity),
    series: downsample(all, SERIES_TARGET),
  }
}

export function summarize(readings: Reading[]): RoomSummary[] {
  const byRoom = new Map<string, Reading[]>()
  for (const r of readings) {
    const arr = byRoom.get(r.room) ?? []
    arr.push(r)
    byRoom.set(r.room, arr)
  }
  return Array.from(byRoom, ([room, rs]) => summarizeRoom(room, rs)).sort(
    (a, b) => a.room.localeCompare(b.room)
  )
}
