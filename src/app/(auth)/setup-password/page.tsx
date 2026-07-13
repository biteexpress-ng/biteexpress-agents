"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { setupPassword } from "@/lib/api/agent";
import { ApiRequestError } from "@/lib/api/types";
import { Button, buttonClassName } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert } from "@/components/ui/alert";

const schema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters"),
    password_confirmation: z.string(),
  })
  .refine((v) => v.password === v.password_confirmation, {
    message: "Passwords don't match",
    path: ["password_confirmation"],
  });
type FormValues = z.infer<typeof schema>;

function SetupPasswordForm() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";
  const linkValid = email !== "" && token !== "";

  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", password_confirmation: "" },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await setupPassword({
        email,
        token,
        password: values.password,
        password_confirmation: values.password_confirmation,
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 400) {
        setFormError("Your link has expired. Contact support to get a new one.");
      } else {
        setFormError(
          err instanceof ApiRequestError
            ? err.message
            : "Something went wrong. Please try again.",
        );
      }
    }
  }

  if (!linkValid) {
    return (
      <section className="fade-up">
        <h1 className="font-sans text-2xl font-semibold text-ink-900">
          Set your password
        </h1>
        <Alert
          tone="error"
          icon={<TriangleAlert className="size-5" />}
          className="mt-6"
        >
          This setup link is incomplete. Open the link from your approval email
          again, or contact support to get a new one.
        </Alert>
      </section>
    );
  }

  if (done) {
    return (
      <section className="fade-up text-center">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-success-soft text-[color:var(--color-success)]">
          <CheckCircle2 className="size-8" aria-hidden />
        </div>
        <h1 className="font-sans text-2xl font-semibold text-ink-900">
          Password set
        </h1>
        <p className="mx-auto mt-1.5 max-w-xs text-base text-muted-foreground">
          You can now sign in with your email or phone and your new password.
        </p>
        <Link
          href="/login"
          className={buttonClassName({ fullWidth: true, className: "mt-8" })}
        >
          Sign in
        </Link>
      </section>
    );
  }

  return (
    <section className="fade-up">
      <header className="mb-8">
        <h1 className="font-sans text-2xl font-semibold text-ink-900">
          Set your password
        </h1>
        <p className="mt-1.5 text-base text-muted-foreground">
          Create a password for{" "}
          <span className="font-medium text-ink-800">{email}</span>.
        </p>
      </header>

      {formError && (
        <Alert
          tone="error"
          icon={<TriangleAlert className="size-5" />}
          className="mb-5"
        >
          {formError}
        </Alert>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-5"
      >
        <Field
          label="New password"
          htmlFor="password"
          error={errors.password?.message}
          hint="At least 8 characters."
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            aria-describedby={
              errors.password ? "password-error" : "password-hint"
            }
            {...register("password")}
          />
        </Field>

        <Field
          label="Confirm password"
          htmlFor="password_confirmation"
          error={errors.password_confirmation?.message}
        >
          <PasswordInput
            id="password_confirmation"
            autoComplete="new-password"
            aria-invalid={!!errors.password_confirmation}
            aria-describedby={
              errors.password_confirmation
                ? "password_confirmation-error"
                : undefined
            }
            {...register("password_confirmation")}
          />
        </Field>

        <Button type="submit" fullWidth loading={isSubmitting} className="mt-1">
          Set password
        </Button>
      </form>
    </section>
  );
}

export default function SetupPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetupPasswordForm />
    </Suspense>
  );
}
