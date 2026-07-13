"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MailCheck, TriangleAlert } from "lucide-react";
import { forgotPassword } from "@/lib/api/agent";
import { ApiRequestError } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const schema = z.object({
  login: z.string().trim().min(1, "Enter your email or phone number"),
});
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { login: "" },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await forgotPassword({ login: values.login });
      // The API is deliberately generic (it never says whether an account
      // exists), so success just means "we processed it".
      setSent(true);
    } catch (err) {
      setFormError(
        err instanceof ApiRequestError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  if (sent) {
    return (
      <section className="fade-up">
        <div className="rounded-2xl border border-border bg-surface p-6 text-center shadow-soft">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-success-soft text-[color:var(--color-success-strong)]">
            <MailCheck className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 font-sans text-xl font-semibold text-ink-900">
            Check your email
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            If an account matches what you entered, we&apos;ve sent a link to
            reset your password. It expires in 1 hour.
          </p>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-brand-red underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="fade-up">
      <header className="mb-8">
        <h1 className="font-sans text-2xl font-semibold text-ink-900">
          Reset password
        </h1>
        <p className="mt-1.5 text-base text-muted-foreground">
          Enter your email or phone and we&apos;ll send you a link to set a new
          password.
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
        <Field label="Email or phone" htmlFor="login" error={errors.login?.message}>
          <Input
            id="login"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={!!errors.login}
            aria-describedby={errors.login ? "login-error" : undefined}
            {...register("login")}
          />
        </Field>

        <Button type="submit" fullWidth loading={isSubmitting} className="mt-1">
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="font-medium text-brand-red underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </section>
  );
}
