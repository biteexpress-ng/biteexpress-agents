"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, TriangleAlert } from "lucide-react";
import { submitKyc } from "@/lib/api/agent";
import { ApiRequestError, type IdentityType } from "@/lib/api/types";
import { gateMessage } from "@/lib/api/messages";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { ImageField } from "./image-field";

export const ID_TYPES: { value: IdentityType; label: string }[] = [
  { value: "nin", label: "National ID (NIN)" },
  { value: "drivers_license", label: "Driver's licence" },
  { value: "voters_card", label: "Voter's card" },
  { value: "passport", label: "International passport" },
];

export function identityTypeLabel(type: IdentityType | null): string {
  return ID_TYPES.find((t) => t.value === type)?.label ?? "";
}

const schema = z.object({
  identity_type: z.enum(["nin", "drivers_license", "voters_card", "passport"], {
    message: "Choose an ID type",
  }),
  bank_name: z.string().trim().min(1, "Enter your bank name"),
  bank_account_number: z
    .string()
    .regex(/^\d{10}$/, "Enter your 10-digit account number"),
  bank_account_name: z.string().trim().min(1, "Enter the account name"),
});
type FormValues = z.infer<typeof schema>;

interface KycFormProps {
  defaults?: { bank_name?: string; bank_account_name?: string };
  onSubmitted: () => void;
}

export function KycForm({ defaults, onSubmitted }: KycFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      bank_name: defaults?.bank_name ?? "",
      bank_account_number: "",
      bank_account_name: defaults?.bank_account_name ?? "",
    },
  });

  const [photo, setPhoto] = useState<File | null>(null);
  const [idImage, setIdImage] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedType = watch("identity_type");

  async function onSubmit(values: FormValues) {
    setFormError(null);
    let ok = true;
    if (!photo) {
      setPhotoError("Add a photo of yourself.");
      ok = false;
    }
    if (!idImage) {
      setIdError("Add a photo of your ID.");
      ok = false;
    }
    if (!ok || !photo || !idImage) return;

    const fd = new FormData();
    fd.append("photo", photo);
    fd.append("identity_type", values.identity_type);
    fd.append("identity_image", idImage);
    fd.append("bank_name", values.bank_name);
    fd.append("bank_account_number", values.bank_account_number);
    fd.append("bank_account_name", values.bank_account_name);

    try {
      await submitKyc(fd);
      onSubmitted();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.status === 409) {
          setFormError(gateMessage("kyc-locked"));
          return;
        }
        if (err.status === 422) {
          let unmapped = false;
          for (const e of err.errors) {
            if (e.code === "photo") setPhotoError(e.message);
            else if (e.code === "identity_image") setIdError(e.message);
            else if (
              e.code === "identity_type" ||
              e.code === "bank_name" ||
              e.code === "bank_account_number" ||
              e.code === "bank_account_name"
            ) {
              setError(e.code as keyof FormValues, { message: e.message });
            } else {
              unmapped = true;
            }
          }
          if (unmapped) setFormError(err.message);
          return;
        }
        setFormError(err.message);
        return;
      }
      setFormError("Couldn't submit. Check your connection and try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      {formError && (
        <Alert tone="error" icon={<TriangleAlert className="size-5" />}>
          {formError}
        </Alert>
      )}

      <ImageField
        id="kyc-photo"
        label="Your photo"
        hint="A clear photo of your face."
        capture="user"
        value={photo}
        onChange={setPhoto}
        onError={setPhotoError}
        error={photoError ?? undefined}
      />

      <fieldset>
        <legend className="text-sm font-medium text-ink-800">ID type</legend>
        <div className="mt-2 grid grid-cols-1 gap-2">
          {ID_TYPES.map((opt) => {
            const active = selectedType === opt.value;
            return (
              <label
                key={opt.value}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border bg-surface px-4 py-3 text-base transition-colors",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-red",
                  active
                    ? "border-brand-red bg-[color-mix(in_srgb,var(--color-brand-red)_6%,#ffffff)] text-ink-900"
                    : "border-border text-ink-800 hover:border-border-strong",
                )}
              >
                <input
                  type="radio"
                  value={opt.value}
                  className="sr-only"
                  {...register("identity_type")}
                />
                <span className="flex-1">{opt.label}</span>
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
                    active
                      ? "border-brand-red bg-brand-red text-primary-foreground"
                      : "border-border-strong",
                  )}
                  aria-hidden
                >
                  {active && <Check className="size-4" />}
                </span>
              </label>
            );
          })}
        </div>
        {errors.identity_type && (
          <p role="alert" className="mt-1 text-sm font-medium text-error">
            {errors.identity_type.message}
          </p>
        )}
      </fieldset>

      <ImageField
        id="kyc-id-image"
        label="Photo of your ID"
        hint="Make sure the details are readable."
        capture="environment"
        value={idImage}
        onChange={setIdImage}
        onError={setIdError}
        error={idError ?? undefined}
      />

      <Field label="Bank name" htmlFor="bank_name" error={errors.bank_name?.message}>
        <Input
          id="bank_name"
          autoComplete="off"
          aria-invalid={!!errors.bank_name}
          {...register("bank_name")}
        />
      </Field>

      <Field
        label="Account number"
        htmlFor="bank_account_number"
        error={errors.bank_account_number?.message}
        hint="Your 10-digit account number."
      >
        <Input
          id="bank_account_number"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          aria-invalid={!!errors.bank_account_number}
          {...register("bank_account_number")}
        />
      </Field>

      <Field
        label="Account name"
        htmlFor="bank_account_name"
        error={errors.bank_account_name?.message}
        hint="Exactly as your bank knows you."
      >
        <Input
          id="bank_account_name"
          autoComplete="off"
          aria-invalid={!!errors.bank_account_name}
          {...register("bank_account_name")}
        />
      </Field>

      <Button type="submit" fullWidth loading={isSubmitting}>
        Submit for review
      </Button>
    </form>
  );
}
