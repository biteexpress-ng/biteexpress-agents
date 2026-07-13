"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

interface NameStepProps {
  onSubmit: (firstName: string, lastName: string) => void;
  loading: boolean;
  error: string | null;
}

export function NameStep({ onSubmit, loading, error }: NameStepProps) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!first.trim() || !last.trim()) {
      setLocalError("Enter the customer's first and last name.");
      return;
    }
    setLocalError(null);
    onSubmit(first.trim(), last.trim());
  }

  return (
    <form onSubmit={submit} noValidate className="slide-in">
      <Alert tone="info" className="mb-5" live="status" icon={<Info className="size-5" />}>
        You&apos;re creating an account for them, on their phone number.
      </Alert>

      <div className="flex flex-col gap-5">
        <Field label="Customer's first name" htmlFor="first_name">
          <Input
            id="first_name"
            autoComplete="off"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
          />
        </Field>
        <Field
          label="Customer's last name"
          htmlFor="last_name"
          error={localError ?? undefined}
        >
          <Input
            id="last_name"
            autoComplete="off"
            value={last}
            onChange={(e) => setLast(e.target.value)}
            aria-invalid={!!localError}
            aria-describedby={localError ? "last_name-error" : undefined}
          />
        </Field>
      </div>

      {error && (
        <Alert tone="error" className="mt-4">
          {error}
        </Alert>
      )}

      <Button type="submit" fullWidth loading={loading} className="mt-6">
        Create their account
      </Button>
    </form>
  );
}
