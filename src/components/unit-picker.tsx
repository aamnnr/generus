"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import { cn } from "cn";

// Pemilih wilayah berjenjang: daerah → desa → kelompok, tiap tingkat menjorok
// ke kanan dan bisa dibuka-tutup. Ketik untuk langsung mencari unit tertentu.

export interface TreeUnit {
  id: string;
  name: string;
  level: "daerah" | "desa" | "kelompok";
  parentId: string | null;
  /** False untuk leluhur yang hanya menjadi judul cabang. */
  selectable: boolean;
}

const LEVEL = { daerah: "Daerah", desa: "Desa", kelompok: "Kelompok" } as const;
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();

interface Row {
  unit: TreeUnit;
  depth: number;
  hasChildren: boolean;
}

export function UnitPicker({
  units,
  name,
  id,
  value: controlled,
  defaultValue,
  onValueChange,
  required,
  placeholder = "Pilih wilayah",
  emptyLabel,
  className,
  "aria-label": ariaLabel,
}: {
  units: TreeUnit[];
  /** Nama field form. Tanpa `name`, pakai `onValueChange`. */
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  required?: boolean;
  placeholder?: string;
  /** Pilihan kosong di paling atas, mis. "Semua wilayah". */
  emptyLabel?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? (required && units.filter((u) => u.selectable).length === 1 ? units.find((u) => u.selectable)!.id : ""));
  const value = controlled ?? inner;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const byId = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const children = useMemo(() => {
    const m = new Map<string | null, TreeUnit[]>();
    for (const u of units) {
      const p = u.parentId && byId.has(u.parentId) ? u.parentId : null;
      m.set(p, [...(m.get(p) ?? []), u]);
    }
    return m;
  }, [units, byId]);
  const ancestors = (uid: string) => {
    const out: string[] = [];
    for (let u = byId.get(uid); u?.parentId && byId.has(u.parentId); u = byId.get(u.parentId)) out.push(u.parentId);
    return out;
  };

  // Saat mencari: tampilkan unit yang cocok beserta leluhurnya, semua terbuka.
  const q = norm(query);
  const { matches, direct } = useMemo(() => {
    if (!q) return { matches: null, direct: null };
    const hit = new Set<string>();
    const own = new Set<string>();
    for (const u of units) {
      if (norm(`${LEVEL[u.level]} ${u.name}`).includes(q) || norm(u.name).includes(q)) {
        own.add(u.id);
        hit.add(u.id);
        for (let p = u.parentId; p && byId.has(p); p = byId.get(p)!.parentId) hit.add(p);
      }
    }
    return { matches: hit, direct: own };
  }, [q, units, byId]);

  const rows: Row[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const u of children.get(parent) ?? []) {
      if (matches && !matches.has(u.id)) continue;
      const hasChildren = (children.get(u.id)?.length ?? 0) > 0;
      rows.push({ unit: u, depth, hasChildren });
      if (hasChildren && (matches || expanded.has(u.id))) walk(u.id, depth + 1);
    }
  };
  walk(null, 0);
  const options = emptyLabel ? [null, ...rows] : rows;
  // active -1 = otomatis: unit pertama yang cocok dengan pencarian (bukan leluhurnya).
  const firstHit = direct ? Math.max(0, options.findIndex((o) => o && direct.has(o.unit.id) && o.unit.selectable)) : 0;
  const current = active < 0 ? firstHit : active;

  const selected = value ? byId.get(value) : undefined;
  const parent = selected?.parentId ? byId.get(selected.parentId) : undefined;

  function openPicker(next: boolean) {
    setOpen(next);
    if (!next) return;
    setQuery("");
    // Mulai dari tingkat atas yang tertutup; buka hanya jalur ke unit terpilih
    // (dan daerah bila hanya satu, agar desanya langsung terlihat).
    const roots = children.get(null) ?? [];
    const exp = new Set<string>(value ? ancestors(value) : []);
    if (roots.length === 1) exp.add(roots[0].id);
    setExpanded(exp);
    setActive(0);
  }

  function choose(uid: string) {
    if (controlled === undefined) setInner(uid);
    onValueChange?.(uid);
    setOpen(false);
  }

  function toggle(uid: string, to?: boolean) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (to ?? !next.has(uid)) next.add(uid);
      else next.delete(uid);
      return next;
    });
  }

  function activate(i: number) {
    const opt = options[i];
    if (opt === null) return choose("");
    if (!opt) return;
    if (opt.unit.selectable) choose(opt.unit.id);
    else if (opt.hasChildren && !matches) toggle(opt.unit.id);
  }

  function move(i: number) {
    const n = Math.max(0, Math.min(options.length - 1, i));
    setActive(n);
    listRef.current?.querySelector(`[data-index="${n}"]`)?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const opt = options[current];
    if (e.key === "ArrowDown") move(current + 1);
    else if (e.key === "ArrowUp") move(current - 1);
    else if (e.key === "Enter") activate(current);
    else if (e.key === "ArrowRight" && opt?.hasChildren && !matches) toggle(opt.unit.id, true);
    else if (e.key === "ArrowLeft" && opt && !matches) {
      if (opt.hasChildren && expanded.has(opt.unit.id)) toggle(opt.unit.id, false);
      else if (opt.unit.parentId) move(options.findIndex((o) => o?.unit.id === opt.unit.parentId));
    } else return;
    e.preventDefault();
  }

  return (
    <div data-field-anchor className={cn("relative w-full min-w-0", className)}>
      {name && (
        // Satu input: membawa nilai ke form sekaligus memicu validasi `required` (pesannya oleh FormValidation).
        <input
          name={name}
          value={value}
          required={required}
          onChange={() => {}}
          tabIndex={-1}
          aria-hidden
          data-kind="pilihan"
          data-required-message={`${placeholder}.`}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0"
        />
      )}
      <Popover.Root open={open} onOpenChange={openPicker}>
        <Popover.Trigger
          id={id}
          aria-label={ariaLabel}
          className="flex h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-input bg-card py-1 pr-9 pl-3.5 text-left text-base outline-none transition-colors hover:border-ring/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-popup-open:border-ring md:h-10 md:text-sm dark:bg-input/30"
        >
          {selected ? (
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="truncate">
                {LEVEL[selected.level]} {selected.name}
              </span>
              {parent && <span className="truncate text-xs text-muted-foreground">· {LEVEL[parent.level]} {parent.name}</span>}
            </span>
          ) : (
            <span className={cn("truncate", !emptyLabel && "text-muted-foreground")}>{emptyLabel ?? placeholder}</span>
          )}
          <ChevronDownIcon className={cn("pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="start" sideOffset={6} className="isolate z-50">
            <Popover.Popup
              initialFocus={inputRef}
              className="flex max-h-[min(26rem,var(--available-height))] w-[max(var(--anchor-width),18rem)] max-w-[calc(100vw-2rem)] origin-(--transform-origin) flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-float ring-1 ring-foreground/10 outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
            >
              <label className="flex items-center gap-2 border-b border-border px-3">
                <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(-1);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder="Ketik nama daerah, desa, atau kelompok"
                  aria-label="Cari wilayah"
                  role="combobox"
                  aria-expanded
                  aria-controls={listId}
                  aria-activedescendant={options.length ? `${listId}-${current}` : undefined}
                  className="h-11 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
                />
              </label>
              {/* mouseDown dicegah agar fokus tetap di kolom cari: mengetik setelah klik tetap mencari. */}
              <div
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label="Wilayah"
                onMouseDown={(e) => e.preventDefault()}
                className="overflow-y-auto overscroll-contain p-1.5"
              >
                {options.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada wilayah yang cocok.</p>}
                {options.map((opt, i) => {
                  if (opt === null) {
                    return (
                      <div
                        key="__empty"
                        id={`${listId}-${i}`}
                        data-index={i}
                        role="option"
                        aria-selected={!value}
                        onClick={() => choose("")}
                        onMouseMove={() => setActive(i)}
                        className={cn("flex min-h-10 cursor-pointer items-center rounded-lg px-3 text-sm", i === current && "bg-secondary")}
                      >
                        <span className="flex-1">{emptyLabel}</span>
                        {!value && <CheckIcon className="size-4 text-primary" aria-hidden />}
                      </div>
                    );
                  }
                  const { unit: u, depth, hasChildren } = opt;
                  const isOpen = !!matches || expanded.has(u.id);
                  return (
                    <div
                      key={u.id}
                      id={`${listId}-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={u.id === value}
                      aria-disabled={!u.selectable}
                      onMouseMove={() => setActive(i)}
                      style={{ paddingLeft: `${depth * 1.25}rem` }}
                      className={cn("flex min-h-10 items-center rounded-lg pr-2 text-sm", i === current && "bg-secondary")}
                    >
                      {hasChildren ? (
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => !matches && toggle(u.id)}
                          aria-label={`${isOpen ? "Tutup" : "Buka"} ${LEVEL[u.level]} ${u.name}`}
                          className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                        >
                          <ChevronRightIcon className={cn("size-4 transition-transform", isOpen && "rotate-90")} aria-hidden />
                        </button>
                      ) : (
                        <span className="w-9 shrink-0" />
                      )}
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => activate(i)}
                        className={cn(
                          "flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left",
                          !u.selectable && "cursor-default",
                        )}
                      >
                        <span className="shrink-0 text-xs text-muted-foreground">{LEVEL[u.level]}</span>
                        <span className={cn("truncate", u.level !== "kelompok" && "font-semibold", u.id === value && "text-primary")}>{u.name}</span>
                        {u.selectable && u.level !== "kelompok" && hasChildren && (
                          <span className="shrink-0 text-xs text-muted-foreground">(seluruh)</span>
                        )}
                      </button>
                      {u.id === value && <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden />}
                    </div>
                  );
                })}
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
