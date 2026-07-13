"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TriangleAlert } from "lucide-react";
import { login } from "@/lib/api/agent";
import { ApiRequestError } from "@/lib/api/types";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert } from "@/components/ui/alert";

const schema = z.object({
  login: z.string().trim().min(1, "Enter your email or phone number"),
  password: z.string().min(1, "Enter your password"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { login: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const { token, agent } = await login({
        login: values.login,
        password: values.password,
        platform: "web",
      });
      setSession(token, agent);
      router.replace(agent.certified ? "/" : "/training");
    } catch (err) {
      setFormError(
        err instanceof ApiRequestError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  return (
    <section className="fade-up">
      <header className="mb-8">
        <h1 className="font-sans text-2xl font-semibold text-ink-900">Sign in</h1>
        <p className="mt-1.5 text-base text-muted-foreground">
          Welcome back. Enter your details to continue.
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

        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
        </Field>

        <Button type="submit" fullWidth loading={isSubmitting} className="mt-1">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Trouble signing in? Contact your BiteExpress agent lead.
      </p>
    </section>
  );
}
