"use client";

import { useEffect, useRef } from "react";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}

/**
 * Confirm using the native <dialog> element — free focus trap, Escape-to-close,
 * top-layer stacking, and backdrop, without a modal library.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onClose,
  loading = false,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        // Escape key: block while a request is in flight.
        if (loading) e.preventDefault();
        else onClose();
      }}
      onClick={(e) => {
        if (loading) return;
        if (e.target === ref.current) onClose(); // backdrop click
      }}
      className="m-auto w-[calc(100vw-2.5rem)] max-w-sm rounded-2xl border border-border bg-surface p-6 text-left shadow-elevated"
    >
      <h2 className="font-sans text-lg font-semibold text-ink-900">{title}</h2>
      {description && (
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      )}
      <div className="mt-6 flex gap-3">
        <Button
          variant="secondary"
          fullWidth
          onClick={onClose}
          disabled={loading}
        >
          {cancelLabel}
        </Button>
        <Button fullWidth onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
