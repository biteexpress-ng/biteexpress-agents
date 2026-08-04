"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { Bank } from "@/lib/api/types";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface BankSelectProps {
  id: string;
  banks: Bank[];
  /** The current bank name (free text until an option is picked). */
  value: string;
  /** Fires with the option on pick, or null when the text no longer matches one. */
  onChange: (name: string, bank: Bank | null) => void;
  invalid?: boolean;
  describedBy?: string;
}

/**
 * Searchable single-select over the Paystack bank list, built as a filtering
 * combobox on the shared Input. Typing is always allowed; picking an option is
 * what attaches a bank_code. Callers fall back to a plain input when the list
 * is empty, so this component can assume at least one bank.
 */
export function BankSelect({
  id,
  banks,
  value,
  onChange,
  invalid,
  describedBy,
}: BankSelectProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter((b) => b.name.toLowerCase().includes(q));
  }, [banks, value]);

  const selected = useMemo(
    () => banks.find((b) => b.name === value) ?? null,
    [banks, value],
  );

  // Close on tap/click outside; the listbox lives inside the root div.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (active >= filtered.length) setActive(0);
  }, [filtered.length, active]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function pick(bank: Bank) {
    onChange(bank.name, bank);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[active]) {
        e.preventDefault();
        pick(filtered[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && filtered[active] ? `${listboxId}-${filtered[active].code}` : undefined
        }
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder="Search for your bank"
        value={value}
        onChange={(e) => {
          const text = e.target.value;
          onChange(text, banks.find((b) => b.name === text) ?? null);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="pr-11"
      />
      <ChevronDown
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-ink-400",
          "transition-transform duration-150",
          open && "rotate-180",
        )}
      />

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          ref={listRef}
          aria-label="Banks"
          className="absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-surface py-1.5 shadow-card"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-foreground" role="presentation">
              No bank matches that. Check the spelling, or keep typing the full
              name.
            </li>
          ) : (
            filtered.map((bank, i) => (
              <li
                key={bank.code}
                id={`${listboxId}-${bank.code}`}
                role="option"
                aria-selected={selected?.code === bank.code}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2 text-base text-ink-900",
                  i === active && "bg-canvas-sunken",
                )}
                onMouseEnter={() => setActive(i)}
                // pointerdown, so the pick lands before the input's blur.
                onPointerDown={(e) => {
                  e.preventDefault();
                  pick(bank);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{bank.name}</span>
                {selected?.code === bank.code && (
                  <Check className="size-4 shrink-0 text-brand-red" aria-hidden />
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
