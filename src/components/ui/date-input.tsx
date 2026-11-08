"use client"

import * as React from "react"
import { Popover } from "@base-ui/react/popover"
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon } from "lucide-react"
import { cn } from "cn"

// Pemilih tanggal & jam milik aplikasi (pengganti <input type="date|time"> bawaan).
// Nilai tetap berformat ISO (YYYY-MM-DD / HH:MM) di input tersembunyi, jadi form & server
// action tidak berubah.

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
const DAYS_LONG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]

const pad = (n: number) => String(n).padStart(2, "0")
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
function parseIso(s?: string | null): Date | null {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) : null
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const addMonths = (d: Date, n: number) => {
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1)
  return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()))
}
const sameDay = (a: Date | null, b: Date | null) => !!a && !!b && toIso(a) === toIso(b)

type ChangeLike = { target: { value: string; name: string }; currentTarget: { value: string; name: string } }

const TRIGGER =
  "flex h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-input bg-card py-1 pr-3 pl-3.5 text-left text-base outline-none transition-colors hover:border-ring/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-popup-open:border-ring md:h-10 md:text-sm dark:bg-input/30"
const POPUP =
  "origin-(--transform-origin) rounded-2xl bg-popover p-3 text-popover-foreground shadow-float ring-1 ring-foreground/10 outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"

function HiddenField(props: { name?: string; value: string; required?: boolean; min?: string; max?: string; kind: "tanggal" | "jam"; disabled?: boolean }) {
  if (!props.name) return null
  return (
    <input
      name={props.name}
      value={props.value}
      required={props.required}
      disabled={props.disabled}
      // type=date/time pada input tersembunyi agar min/max tetap divalidasi; tidak pernah tampil.
      type={props.kind === "tanggal" ? "date" : "time"}
      min={props.min}
      max={props.max}
      onChange={() => {}}
      tabIndex={-1}
      aria-hidden
      data-kind={props.kind}
      className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0"
    />
  )
}

export function DateInput({
  id,
  name,
  value: controlled,
  defaultValue,
  onChange,
  required,
  disabled,
  min,
  max,
  placeholder = "Pilih tanggal",
  className,
  "aria-label": ariaLabel,
}: {
  id?: string
  name?: string
  value?: string
  defaultValue?: string
  onChange?: (e: ChangeLike) => void
  required?: boolean
  disabled?: boolean
  min?: string
  max?: string
  placeholder?: string
  className?: string
  "aria-label"?: string
}) {
  const [inner, setInner] = React.useState(defaultValue ?? "")
  const value = controlled ?? inner
  const selected = parseIso(value)
  const minD = parseIso(min)
  const maxD = parseIso(max)
  const [open, setOpen] = React.useState(false)
  const [view, setView] = React.useState<"hari" | "bulan" | "tahun">("hari")
  const [focus, setFocus] = React.useState<Date>(() => selected ?? new Date())
  const gridRef = React.useRef<HTMLDivElement>(null)

  const out = (d: Date) => (minD && toIso(d) < toIso(minD)) || (maxD && toIso(d) > toIso(maxD))

  function set(v: string) {
    if (controlled === undefined) setInner(v)
    if (v !== value) onChange?.({ target: { value: v, name: name ?? "" }, currentTarget: { value: v, name: name ?? "" } })
  }
  function pick(d: Date) {
    if (out(d)) return
    set(toIso(d))
    setOpen(false)
  }
  function onOpenChange(next: boolean) {
    if (disabled) return
    setOpen(next)
    if (next) {
      const today = new Date()
      setFocus(selected ?? (maxD && toIso(today) > toIso(maxD) ? maxD : minD && toIso(today) < toIso(minD) ? minD : today))
      setView("hari")
    }
  }

  // Fokus berpindah mengikuti tanggal aktif (keyboard).
  React.useEffect(() => {
    if (!open || view !== "hari") return
    const btn = gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${toIso(focus)}"]`)
    if (btn && document.activeElement !== btn && gridRef.current?.contains(document.activeElement)) btn.focus()
  }, [focus, open, view])

  function onGridKey(e: React.KeyboardEvent) {
    const step: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      PageUp: () => addMonths(focus, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focus, e.shiftKey ? 12 : 1),
      Home: () => addDays(focus, -((focus.getDay() + 6) % 7)),
      End: () => addDays(focus, 6 - ((focus.getDay() + 6) % 7)),
    }
    if (step[e.key]) {
      e.preventDefault()
      setFocus(step[e.key]())
    }
  }

  // Grid 6 minggu, mulai Senin.
  const first = new Date(focus.getFullYear(), focus.getMonth(), 1)
  const start = addDays(first, -((first.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  const today = new Date()
  const yearBase = focus.getFullYear() - (focus.getFullYear() % 12)

  const label = selected ? `${DAYS_LONG[selected.getDay()]}, ${selected.getDate()} ${MONTHS[selected.getMonth()]} ${selected.getFullYear()}` : placeholder

  const navBtn = "flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground tap disabled:pointer-events-none disabled:opacity-30"

  return (
    <div data-field-anchor className={cn("relative w-full min-w-0 [contain:inline-size]", className)}>
      <HiddenField name={name} value={value} required={required} min={min} max={max} kind="tanggal" disabled={disabled} />
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        <Popover.Trigger id={id} disabled={disabled} aria-label={ariaLabel ? `${ariaLabel}: ${label}` : undefined} className={TRIGGER}>
          <CalendarDaysIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className={cn("truncate", !selected && "text-muted-foreground")}>{label}</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={12} className="isolate z-50">
            <Popover.Popup initialFocus={() => gridRef.current?.querySelector<HTMLElement>("[tabindex='0']") ?? true} className={cn(POPUP, "w-[19.5rem]")}>
              <div className="mb-2 flex items-center justify-between gap-1">
                <button
                  type="button"
                  aria-label={view === "tahun" ? "12 tahun sebelumnya" : view === "bulan" ? "Tahun sebelumnya" : "Bulan sebelumnya"}
                  className={navBtn}
                  onClick={() => setFocus(view === "hari" ? addMonths(focus, -1) : addMonths(focus, view === "bulan" ? -12 : -144))}
                >
                  <ChevronLeftIcon className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setView(view === "hari" ? "bulan" : view === "bulan" ? "tahun" : "hari")}
                  className="tap flex h-9 items-center rounded-xl px-3 text-sm font-bold hover:bg-muted"
                  aria-live="polite"
                >
                  {view === "hari" && `${MONTHS[focus.getMonth()]} ${focus.getFullYear()}`}
                  {view === "bulan" && focus.getFullYear()}
                  {view === "tahun" && `${yearBase} – ${yearBase + 11}`}
                </button>
                <button
                  type="button"
                  aria-label={view === "tahun" ? "12 tahun berikutnya" : view === "bulan" ? "Tahun berikutnya" : "Bulan berikutnya"}
                  className={navBtn}
                  onClick={() => setFocus(view === "hari" ? addMonths(focus, 1) : addMonths(focus, view === "bulan" ? 12 : 144))}
                >
                  <ChevronRightIcon className="size-4" aria-hidden />
                </button>
              </div>

              {view === "hari" && (
                <div ref={gridRef} role="grid" aria-label={`${MONTHS[focus.getMonth()]} ${focus.getFullYear()}`} onKeyDown={onGridKey}>
                  <div role="row" className="grid grid-cols-7 pb-1">
                    {DAYS.map((d, i) => (
                      <span key={d} role="columnheader" className={cn("text-center text-[11px] font-semibold text-muted-foreground", i === 6 && "text-destructive/70")}>
                        {d}
                      </span>
                    ))}
                  </div>
                  {Array.from({ length: 6 }, (_, w) => (
                    <div role="row" key={w} className="grid grid-cols-7 gap-0.5">
                      {days.slice(w * 7, w * 7 + 7).map((d) => {
                        const iso = toIso(d)
                        const inMonth = d.getMonth() === focus.getMonth()
                        const isSel = sameDay(d, selected)
                        const isFocus = sameDay(d, focus)
                        const dis = !!out(d)
                        return (
                          <button
                            key={iso}
                            type="button"
                            role="gridcell"
                            data-iso={iso}
                            tabIndex={isFocus ? 0 : -1}
                            aria-selected={isSel}
                            aria-label={`${DAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`}
                            disabled={dis}
                            onClick={() => pick(d)}
                            onFocus={() => !isFocus && setFocus(d)}
                            className={cn(
                              "relative flex h-9 items-center justify-center rounded-xl text-sm tabular-nums outline-none transition-[background-color,transform] duration-150 active:scale-90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-25",
                              !inMonth && "text-muted-foreground/60",
                              isSel ? "bg-primary font-bold text-primary-foreground" : "hover:bg-secondary",
                              !isSel && sameDay(d, today) && "font-bold text-primary ring-1 ring-primary/40 ring-inset",
                            )}
                          >
                            {d.getDate()}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}

              {view === "bulan" && (
                <div className="grid grid-cols-3 gap-1.5">
                  {MONTHS_SHORT.map((m, i) => {
                    const on = selected?.getFullYear() === focus.getFullYear() && selected?.getMonth() === i
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setFocus(new Date(focus.getFullYear(), i, Math.min(focus.getDate(), 28)))
                          setView("hari")
                        }}
                        className={cn("tap h-11 rounded-xl text-sm font-medium", on ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}
                      >
                        {m}
                      </button>
                    )
                  })}
                </div>
              )}

              {view === "tahun" && (
                <div className="grid grid-cols-3 gap-1.5">
                  {Array.from({ length: 12 }, (_, i) => yearBase + i).map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => {
                        setFocus(new Date(y, focus.getMonth(), Math.min(focus.getDate(), 28)))
                        setView("bulan")
                      }}
                      className={cn("tap h-11 rounded-xl text-sm font-medium tabular-nums", selected?.getFullYear() === y ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                {!required && value ? (
                  <button type="button" onClick={() => (set(""), setOpen(false))} className="tap h-9 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                    Kosongkan
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  disabled={!!out(today)}
                  onClick={() => pick(today)}
                  className="tap h-9 rounded-xl px-3 text-sm font-semibold text-primary hover:bg-secondary disabled:opacity-40"
                >
                  Hari ini
                </button>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i))
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5))

export function TimeInput({
  id,
  name,
  defaultValue,
  required,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string
  name?: string
  defaultValue?: string
  required?: boolean
  disabled?: boolean
  className?: string
  "aria-label"?: string
}) {
  const [value, setValue] = React.useState(defaultValue ?? "")
  const [open, setOpen] = React.useState(false)
  const [h, m] = value ? value.split(":") : ["", ""]
  const minutes = m && !MINUTES.includes(m) ? [...MINUTES, m].sort() : MINUTES
  // Gulir kolom ke nilai terpilih saat dibuka (tanpa menggulir halaman).
  const centerSelected = React.useCallback((grid: HTMLDivElement | null) => {
    if (!grid) return
    const run = () =>
      grid.querySelectorAll<HTMLElement>("[aria-selected=true]").forEach((el) => {
        const list = el.parentElement!
        list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2
      })
    requestAnimationFrame(() => requestAnimationFrame(run))
  }, [])

  const cell = (on: boolean) =>
    cn("tap flex h-9 w-full shrink-0 items-center justify-center rounded-lg text-sm tabular-nums", on ? "bg-primary font-bold text-primary-foreground" : "hover:bg-secondary")

  return (
    <div data-field-anchor className={cn("relative w-full min-w-0 [contain:inline-size]", className)}>
      <HiddenField name={name} value={value} required={required} kind="jam" disabled={disabled} />
      <Popover.Root open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
        <Popover.Trigger id={id} disabled={disabled} aria-label={ariaLabel ? `${ariaLabel}: ${value || "belum dipilih"}` : undefined} className={TRIGGER}>
          <ClockIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className={cn("tabular-nums", !value && "text-muted-foreground")}>{value || "Pilih jam"}</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={12} className="isolate z-50">
            <Popover.Popup className={cn(POPUP, "w-48")}>
              <div ref={centerSelected} className="grid grid-cols-2 gap-2">
                {[
                  { title: "Jam", list: HOURS, cur: h, set: (x: string) => setValue(`${x}:${m || "00"}`) },
                  {
                    title: "Menit",
                    list: minutes,
                    cur: m,
                    set: (x: string) => {
                      setValue(`${h || "00"}:${x}`)
                      setOpen(false)
                    },
                  },
                ].map((col) => (
                  <div key={col.title} className="flex flex-col gap-1">
                    <span className="text-center text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{col.title}</span>
                    <div role="listbox" aria-label={col.title} className="relative flex h-56 flex-col gap-0.5 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin]">
                      {col.list.map((x) => (
                        <button key={x} type="button" role="option" aria-selected={x === col.cur} onClick={() => col.set(x)} className={cell(x === col.cur)}>
                          {x}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
