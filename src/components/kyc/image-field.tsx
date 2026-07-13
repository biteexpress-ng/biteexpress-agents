"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB — matches the server's max:2048 (KB)

interface ImageFieldProps {
  id: string;
  label: string;
  hint?: string;
  /** Camera hint for mobile: "user" (selfie/passport) or "environment" (ID doc). */
  capture?: "user" | "environment";
  value: File | null;
  onChange: (file: File | null) => void;
  onError: (message: string | null) => void;
  error?: string;
  existingUrl?: string | null;
}

export function ImageField({
  id,
  label,
  hint,
  capture,
  value,
  onChange,
  onError,
  error,
  existingUrl,
}: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > MAX_BYTES) {
      onError("That image is over 2MB. Please choose a smaller photo.");
      onChange(null);
      e.target.value = "";
      return;
    }
    onError(null);
    onChange(file);
  }

  function remove() {
    onChange(null);
    onError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const shown = preview ?? existingUrl ?? null;

  return (
    <div className="flex flex-col gap-2">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-ink-800">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      </div>

      {shown && (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shown}
            alt=""
            className="max-h-40 rounded-xl border border-border object-cover"
          />
          {value && (
            <button
              type="button"
              onClick={remove}
              aria-label="Remove photo"
              className="absolute -right-2 -top-2 grid size-8 cursor-pointer place-items-center rounded-full bg-ink-900 text-ink-0 shadow-soft"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        capture={capture}
        onChange={pick}
        className="sr-only"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <label
        htmlFor={id}
        className="inline-flex min-h-12 w-fit cursor-pointer items-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-base font-medium text-ink-900 transition-colors hover:bg-canvas-sunken focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-red"
      >
        <Camera className="size-5" aria-hidden />
        {shown ? "Replace photo" : "Choose photo"}
      </label>

      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-error">
          {error}
        </p>
      )}
    </div>
  );
}
