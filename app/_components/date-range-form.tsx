"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { RiCalendarLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const pad = (n: number) => String(n).padStart(2, "0")

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i))
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i))

/** Format a Date to a `datetime-local` value (`YYYY-MM-DDTHH:mm`) in local time. */
function toLocalInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseLocalInput(value?: string): Date | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function DateTimePicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: Date | undefined
  onChange: (date: Date | undefined) => void
}) {
  const [open, setOpen] = React.useState(false)
  const hour = value ? pad(value.getHours()) : undefined
  const minute = value ? pad(value.getMinutes()) : undefined

  const handleDateSelect = (selected: Date | undefined) => {
    if (!selected) {
      onChange(undefined)
      return
    }
    const next = new Date(selected)
    if (value) {
      next.setHours(value.getHours(), value.getMinutes(), 0, 0)
    } else {
      next.setHours(0, 0, 0, 0)
    }
    onChange(next)
  }

  const setUnit = (unit: "hour" | "minute", raw: string) => {
    const base = value ? new Date(value) : new Date(new Date().setHours(0, 0, 0, 0))
    if (unit === "hour") base.setHours(Number(raw))
    else base.setMinutes(Number(raw))
    base.setSeconds(0, 0)
    onChange(base)
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 justify-start gap-2 px-2 text-xs font-normal"
            >
              <RiCalendarLine className="size-3.5" />
              {value ? value.toLocaleDateString() : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value}
              onSelect={handleDateSelect}
              captionLayout="dropdown"
              autoFocus
            />
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-1 font-mono">
          <Select value={hour} onValueChange={(v) => setUnit("hour", v)}>
            <SelectTrigger size="sm" className="h-7 w-[3.75rem] text-xs">
              <SelectValue placeholder="HH" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {HOURS.map((h) => (
                <SelectItem key={h} value={h} className="text-xs">
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">:</span>
          <Select value={minute} onValueChange={(v) => setUnit("minute", v)}>
            <SelectTrigger size="sm" className="h-7 w-[3.75rem] text-xs">
              <SelectValue placeholder="MM" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {MINUTES.map((m) => (
                <SelectItem key={m} value={m} className="text-xs">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

export function DateRangeForm({
  initialFrom,
  initialTo,
}: {
  initialFrom?: string
  initialTo?: string
}) {
  const router = useRouter()
  const [from, setFrom] = React.useState<Date | undefined>(
    parseLocalInput(initialFrom)
  )
  const [to, setTo] = React.useState<Date | undefined>(parseLocalInput(initialTo))

  const apply = () => {
    const params = new URLSearchParams({ view: "custom" })
    if (from) params.set("from", toLocalInput(from))
    if (to) params.set("to", toLocalInput(to))
    router.push(`/?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-end gap-3 text-xs">
      <DateTimePicker label="From" value={from} onChange={setFrom} />
      <DateTimePicker label="To" value={to} onChange={setTo} />
      <Button size="sm" className="h-7 px-3 text-xs" onClick={apply}>
        Apply
      </Button>
    </div>
  )
}
