import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  fetchReadings,
  summarize,
  SENSOR_COLORS,
  SENSOR_LABELS,
  type RoomSummary,
  type SensorStats,
} from "@/lib/temperatures"
import {
  HumidityChart,
  TemperatureChart,
} from "@/app/_components/temperature-chart"

export const dynamic = "force-dynamic"
export const revalidate = 0

function describeError(e: unknown): string {
  const parts: string[] = []
  let current: unknown = e
  while (current) {
    if (current instanceof Error) {
      parts.push(`${current.name}: ${current.message}`)
      current = (current as { cause?: unknown }).cause
    } else {
      parts.push(String(current))
      break
    }
  }
  return parts.join("\n  ↳ caused by ")
}

export default async function Page() {
  let summaries: RoomSummary[] = []
  let error: string | null = null
  let stack: string | null = null

  try {
    const readings = await fetchReadings()
    summaries = summarize(readings)
  } catch (e) {
    console.error("[dashboard] fetch failed:", e)
    error = describeError(e)
    stack = e instanceof Error ? (e.stack ?? null) : null
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-medium tracking-tight">
            Server Room Monitor
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live temperature & humidity from on-prem sensors.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          Refreshed{" "}
          <span className="font-mono text-foreground">
            {new Date().toLocaleTimeString()}
          </span>
        </div>
      </header>

      {error && (
        <Card>
          <CardHeader>
            <CardTitle>Failed to load data</CardTitle>
            <CardDescription>
              Endpoint:{" "}
              <code className="font-mono">
                http://activesaip.thomasbechu.me/temperatures
              </code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap text-destructive">
              {error}
            </pre>
            {stack && (
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer">Stack trace</summary>
                <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 font-mono whitespace-pre-wrap">
                  {stack}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {summaries.map((s) => (
        <RoomPanel key={s.room} summary={s} />
      ))}

      {!error && summaries.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No data</CardTitle>
            <CardDescription>Endpoint returned no readings.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}

function RoomPanel({ summary }: { summary: RoomSummary }) {
  const { room, count, latest, earliest, sensors, humidity, series } = summary
  const hottest = sensors.reduce((a, b) => (b.current > a.current ? b : a))

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-heading text-xl font-medium">Room {room}</h2>
          <Badge variant="secondary">{count.toLocaleString()} readings</Badge>
          <ThermalBadge sensor={hottest} />
        </div>
        <div className="text-xs text-muted-foreground">
          {new Date(earliest.time).toLocaleString()} →{" "}
          {new Date(latest.time).toLocaleString()}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {sensors.map((s) => (
          <SensorCard key={s.index} sensor={s} />
        ))}
        <Card size="sm">
          <CardHeader>
            <CardDescription>Humidity</CardDescription>
            <CardTitle className="font-mono text-2xl">
              {humidity.current.toFixed(0)}%
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            min {humidity.min.toFixed(0)} · avg {humidity.avg.toFixed(0)} · max{" "}
            {humidity.max.toFixed(0)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Temperatures</CardTitle>
          <CardDescription>
            Per-sensor readings, downsampled to {series.length} points across the
            full window.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemperatureChart data={series} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Humidity</CardTitle>
          <CardDescription>Relative humidity (%) over time.</CardDescription>
        </CardHeader>
        <CardContent>
          <HumidityChart data={series} />
        </CardContent>
      </Card>
    </section>
  )
}

function SensorCard({ sensor }: { sensor: SensorStats }) {
  const trend =
    sensor.delta > 0 ? "up" : sensor.delta < 0 ? "down" : "flat"
  const trendChar = trend === "up" ? "▲" : trend === "down" ? "▼" : "•"
  const trendClass =
    trend === "up"
      ? "text-destructive"
      : trend === "down"
        ? "text-primary"
        : "text-muted-foreground"

  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: SENSOR_COLORS[sensor.index] }}
          />
          {SENSOR_LABELS[sensor.index]}
        </CardDescription>
        <CardTitle className="flex items-baseline gap-2 font-mono text-2xl">
          {sensor.current.toFixed(1)}°
          <span className={`text-xs ${trendClass}`}>
            {trendChar} {Math.abs(sensor.delta).toFixed(1)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        min {sensor.min.toFixed(1)} · avg {sensor.avg.toFixed(1)} · max{" "}
        {sensor.max.toFixed(1)}
      </CardContent>
    </Card>
  )
}

function ThermalBadge({ sensor }: { sensor: SensorStats }) {
  if (sensor.current >= 30) {
    return (
      <Badge variant="destructive">
        Hot · {SENSOR_LABELS[sensor.index]} {sensor.current.toFixed(1)}°
      </Badge>
    )
  }
  if (sensor.current >= 26) {
    return (
      <Badge variant="outline">
        Warm · {SENSOR_LABELS[sensor.index]} {sensor.current.toFixed(1)}°
      </Badge>
    )
  }
  return (
    <Badge variant="secondary">
      Normal · max {sensor.current.toFixed(1)}°
    </Badge>
  )
}
