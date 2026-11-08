"use client"

import * as React from "react"
import { Popover } from "@base-ui/react/popover"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { cn } from "cn"

// Dropdown milik aplikasi dengan API yang sama seperti <select> (name, value/defaultValue,
// onChange(e.target.value), required, disabled, <option>/<optgroup>), tetapi daftar
// pilihannya digambar sendiri — tidak memakai daftar bawaan browser/HP.

interface Opt {
  value: string
  label: React.ReactNode
  text: string
  disabled: boolean
}
interface Group {
  label: string
  options: Opt[]
}

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join("")
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children)
  return ""
}

/** Kenali <NativeSelectOption>/<NativeSelectOptGroup> dari props-nya (aman lintas server/klien). */
function collect(children: React.ReactNode): (Opt | Group)[] {
  const out: (Opt | Group)[] = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<{ value?: unknown; label?: string; disabled?: boolean; children?: React.ReactNode }>(child)) return
    const p = child.props
    if (p.value === undefined && typeof p.label === "string") {
      out.push({ label: p.label, options: collect(p.children).filter((o): o is Opt => "value" in o) })
    } else if (child.type === React.Fragment) {
      out.push(...collect(p.children))
    } else {
      out.push({ value: String(p.value ?? textOf(p.children)), label: p.children, text: textOf(p.children), disabled: !!p.disabled })
    }
  })
  return out
}

type ChangeLike = { target: { value: string; name: string }; currentTarget: { value: string; name: string } }

type NativeSelectProps = {
  id?: string
  name?: string
  value?: string
  defaultValue?: string
  onChange?: (e: ChangeLike) => void
  required?: boolean
  disabled?: boolean
  className?: string
  size?: "sm" | "default"
  children?: React.ReactNode
  "aria-label"?: string
  "aria-invalid"?: boolean
}

function NativeSelect({
  id,
  name,
  value: controlled,
  defaultValue,
  onChange,
  required,
  disabled,
  className,
  size = "default",
  children,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: NativeSelectProps) {
  const items = React.useMemo(() => collect(children), [children])
  const flat = React.useMemo(() => items.flatMap((i) => ("options" in i ? i.options : [i])), [items])
  // Seperti <select>: tanpa nilai awal, pilihan pertama yang aktif terpilih.
  const firstEnabled = flat.find((o) => !o.disabled)?.value ?? ""
  const [inner, setInner] = React.useState(defaultValue ?? (flat.some((o) => o.value === "") ? "" : firstEnabled))
  const value = controlled ?? inner
  const selected = flat.find((o) => o.value === value)
  const placeholder = flat.find((o) => o.value === "")
  const isPlaceholder = !selected || (selected.value === "" && selected.disabled)

  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(-1)
  const listRef = React.useRef<HTMLDivElement>(null)
  const typed = React.useRef({ text: "", at: 0 })
  const baseId = React.useId()
  const optId = (i: number) => `${baseId}-o${i}`
  const selectable = flat.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0)

  function choose(v: string) {
    if (controlled === undefined) setInner(v)
    if (v !== value) onChange?.({ target: { value: v, name: name ?? "" }, currentTarget: { value: v, name: name ?? "" } })
    setOpen(false)
  }

  function openList(next: boolean) {
    if (disabled) return
    setOpen(next)
    if (next) {
      const i = flat.findIndex((o) => o.value === value && !o.disabled)
      setActive(i >= 0 ? i : (selectable[0] ?? -1))
    }
  }

  React.useEffect(() => {
    if (!open || active < 0) return
    document.getElementById(optId(active))?.scrollIntoView({ block: "nearest" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active])

  function move(delta: number) {
    if (!selectable.length) return
    const pos = selectable.indexOf(active)
    const next = pos < 0 ? 0 : Math.min(selectable.length - 1, Math.max(0, pos + delta))
    setActive(selectable[next])
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") move(1)
    else if (e.key === "ArrowUp") move(-1)
    else if (e.key === "Home") setActive(selectable[0] ?? -1)
    else if (e.key === "End") setActive(selectable.at(-1) ?? -1)
    else if (e.key === "PageDown") move(8)
    else if (e.key === "PageUp") move(-8)
    else if (e.key === "Enter" || e.key === " ") {
      if (active >= 0) choose(flat[active].value)
    } else if (e.key === "Tab") {
      setOpen(false)
      return
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      // Ketik huruf awal untuk melompat.
      const now = Date.now()
      typed.current.text = (now - typed.current.at > 700 ? "" : typed.current.text) + e.key.toLowerCase()
      typed.current.at = now
      const hit = selectable.find((i) => flat[i].text.toLowerCase().startsWith(typed.current.text))
      if (hit !== undefined) setActive(hit)
    } else return
    e.preventDefault()
  }

  function onTriggerKey(e: React.KeyboardEvent) {
    if (open) return
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      openList(true)
    }
  }

  const renderOpt = (o: Opt) => {
    const i = flat.indexOf(o)
    // Petunjuk "Pilih …" (kosong & nonaktif) cukup tampil di tombol, bukan di daftar.
    if (o.value === "" && o.disabled) return null
    const on = o.value === value
    return (
      <div
        key={`${o.value}-${i}`}
        id={optId(i)}
        role="option"
        aria-selected={on}
        aria-disabled={o.disabled || undefined}
        onMouseMove={() => !o.disabled && setActive(i)}
        onClick={() => !o.disabled && choose(o.value)}
        className={cn(
          "flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm",
          o.disabled ? "cursor-default text-muted-foreground" : "cursor-pointer",
          i === active && !o.disabled && "bg-secondary",
          on && "font-semibold text-primary",
        )}
      >
        <span className="flex-1">{o.label}</span>
        {on && !o.disabled && <CheckIcon className="size-4 shrink-0" aria-hidden />}
      </div>
    )
  }

  return (
    <div
      data-slot="native-select-wrapper"
      data-field-anchor
      className={cn("relative w-full min-w-0 [contain:inline-size]", disabled && "opacity-50", className)}
    >
      {name && (
        <input
          name={name}
          value={value}
          required={required}
          disabled={disabled}
          onChange={() => {}}
          tabIndex={-1}
          aria-hidden
          data-kind="pilihan"
          data-required-message={placeholder && placeholder.disabled ? `${placeholder.text}.` : undefined}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0"
        />
      )}
      <Popover.Root open={open} onOpenChange={openList}>
        <Popover.Trigger
          id={id}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-haspopup="listbox"
          onKeyDown={onTriggerKey}
          data-size={size}
          className={cn(
            "flex h-11 w-full min-w-0 items-center rounded-xl border border-input bg-card py-1 pr-9 pl-3.5 text-left text-base outline-none transition-colors hover:border-ring/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=sm]:h-8 data-popup-open:border-ring md:h-10 md:text-sm dark:bg-input/30",
          )}
        >
          <span className={cn("truncate", isPlaceholder && "text-muted-foreground")}>{selected?.label ?? placeholder?.label ?? "Pilih"}</span>
          <ChevronDownIcon
            className={cn("pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
            aria-hidden
          />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="start" sideOffset={6} className="isolate z-50">
            <Popover.Popup
              initialFocus={listRef}
              className="flex max-h-[min(22rem,var(--available-height))] w-[max(var(--anchor-width),12rem)] max-w-[calc(100vw-2rem)] origin-(--transform-origin) flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-float ring-1 ring-foreground/10 outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
            >
              <div
                ref={listRef}
                role="listbox"
                tabIndex={0}
                aria-labelledby={id}
                aria-activedescendant={active >= 0 ? optId(active) : undefined}
                onKeyDown={onListKey}
                className="overflow-y-auto overscroll-contain p-1.5 outline-none"
              >
                {items.map((it, gi) =>
                  "options" in it ? (
                    <div key={`g-${it.label}-${gi}`} role="group" aria-label={it.label} className="pt-1">
                      <div className="px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{it.label}</div>
                      {it.options.map(renderOpt)}
                    </div>
                  ) : (
                    renderOpt(it)
                  ),
                )}
                {flat.length === 0 && <p className="px-3 py-4 text-center text-sm text-muted-foreground">Tidak ada pilihan.</p>}
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

/** Satu pilihan. Dibaca oleh <NativeSelect>; tidak dirender sendiri. */
function NativeSelectOption(props: { value?: string; disabled?: boolean; children?: React.ReactNode; className?: string }) {
  void props
  return null
}

/** Kelompok pilihan berjudul. */
function NativeSelectOptGroup(props: { label: string; children?: React.ReactNode; className?: string }) {
  void props
  return null
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption }
