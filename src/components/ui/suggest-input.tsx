"use client"

import * as React from "react"
import { cn } from "cn"
import { Input } from "@/components/ui/input"

// Kolom teks dengan daftar saran milik aplikasi (pengganti <datalist> bawaan browser).
// Tetap bebas diketik; saran hanya membantu.

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim()

export function SuggestInput({
  suggestions,
  value: controlled,
  defaultValue,
  onValueChange,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "list"> & {
  suggestions: string[]
  value?: string
  defaultValue?: string
  onValueChange?: (v: string) => void
}) {
  const [inner, setInner] = React.useState(defaultValue ?? "")
  const value = controlled ?? inner
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(-1)
  const listId = React.useId()
  const q = norm(value)
  const matches = suggestions.filter((s) => norm(s) !== q && (!q || norm(s).includes(q))).slice(0, 8)
  const show = open && matches.length > 0

  function set(v: string) {
    if (controlled === undefined) setInner(v)
    onValueChange?.(v)
  }

  return (
    <div className={cn("relative w-full", className)}>
      <Input
        {...props}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          set(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!show) return
          if (e.key === "ArrowDown") setActive((a) => Math.min(matches.length - 1, a + 1))
          else if (e.key === "ArrowUp") setActive((a) => Math.max(-1, a - 1))
          else if (e.key === "Enter" && active >= 0) {
            set(matches[active])
            setOpen(false)
          } else if (e.key === "Escape") setOpen(false)
          else return
          e.preventDefault()
        }}
      />
      {show && (
        <div
          id={listId}
          role="listbox"
          // Tetap fokus di kolom teks saat memilih.
          onMouseDown={(e) => e.preventDefault()}
          className="animate-enter absolute inset-x-0 top-full z-40 mt-1.5 flex max-h-64 flex-col overflow-y-auto rounded-2xl bg-popover p-1.5 text-popover-foreground shadow-float ring-1 ring-foreground/10"
        >
          <span className="px-3 pt-1 pb-1 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">Saran</span>
          {matches.map((s, i) => (
            <div
              key={s}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseMove={() => setActive(i)}
              onClick={() => {
                set(s)
                setOpen(false)
              }}
              className={cn("flex min-h-10 cursor-pointer items-center rounded-lg px-3 text-sm", i === active && "bg-secondary")}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
