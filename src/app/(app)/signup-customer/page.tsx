"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  confirmAssistedSignup,
  initiateAssistedSignup,
} from "@/lib/api/agent";
import { ApiRequestError } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { buttonClassName } from "@/components/ui/button";
import { PhoneStep } from "@/components/signup/phone-step";
import { OtpStep } from "@/components/signup/otp-step";
import { NameStep } from "@/components/signup/name-step";
import { DoneStep } from "@/components/signup/done-step";

type Step = "phone" | "otp" | "name" | "done";
type GateCode = "not-certified" | "program-inactive";

const STEP_INDEX: Record<Exclude<Step, "done">, number> = {
  phone: 0,
  otp: 1,
  name: 2,
};

function readGate(err: unknown): GateCode | null {
  if (!(err instanceof ApiRequestError) || err.status !== 403) return null;
  const raw = (err.raw ?? {}) as { code?: string };
  const code = raw.code ?? err.errors[0]?.code;
  return code === "not-certified" || code === "program-inactive" ? code : null;
}

function isPhoneExists(err: unknown): boolean {
  if (!(err instanceof ApiRequestError)) return false;
  const raw = (err.raw ?? {}) as { code?: string };
  return err.status === 409 || raw.code === "phone-exists";
}

export default function SignupCustomerPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [maskedName, setMaskedName] = useState("");
  const [gate, setGate] = useState<GateCode | null>(null);

  const [initiating, setInitiating] = useState(false);
  const [resending, setResending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneGuidance, setPhoneGuidance] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const PHONE_EXISTS_COPY =
    "This number already has a BiteExpress account, so it can't be linked to you. Ask them to order — or sign up someone new.";

  async function handlePhoneNext(e164: string) {
    setPhone(e164);
    setInitiating(true);
    setPhoneError(null);
    setPhoneGuidance(null);
    try {
      await initiateAssistedSignup({ phone: e164 });
      setOtpError(null);
      setStep("otp");
    } catch (err) {
      const g = readGate(err);
      if (g) return setGate(g);
      if (isPhoneExists(err)) return setPhoneGuidance(PHONE_EXISTS_COPY);
      setPhoneError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn't send the code. Check your connection and try again.",
      );
    } finally {
      setInitiating(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setOtpError(null);
    try {
      await initiateAssistedSignup({ phone });
    } catch (err) {
      const g = readGate(err);
      if (g) return setGate(g);
      setOtpError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn't resend the code. Try again.",
      );
    } finally {
      setResending(false);
    }
  }

  function handleOtpNext(value: string) {
    setOtp(value);
    setOtpError(null);
    setStep("name");
  }

  async function handleNameSubmit(firstName: string, lastName: string) {
    setConfirming(true);
    setNameError(null);
    try {
      const res = await confirmAssistedSignup({
        phone,
        otp,
        first_name: firstName,
        last_name: lastName,
      });
      setMaskedName(res.customer.name_masked);
      setStep("done");
    } catch (err) {
      const g = readGate(err);
      if (g) return setGate(g);
      if (isPhoneExists(err)) {
        setPhoneGuidance(PHONE_EXISTS_COPY);
        setStep("phone");
        return;
      }
      if (err instanceof ApiRequestError && err.status === 400) {
        setOtpError("That code didn't match or has expired. Enter it again.");
        setStep("otp");
        return;
      }
      setNameError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn't create the account. Check your connection and try again.",
      );
    } finally {
      setConfirming(false);
    }
  }

  function reset() {
    setStep("phone");
    setPhone("");
    setOtp("");
    setMaskedName("");
    setPhoneError(null);
    setPhoneGuidance(null);
    setOtpError(null);
    setNameError(null);
  }

  if (gate) {
    return (
      <GateState
        title={
          gate === "not-certified"
            ? "Get certified first"
            : "Program not active yet"
        }
        body={
          gate === "not-certified"
            ? "Finish training and pass the quiz to start signing up customers."
            : "The agent program isn't active right now. Check back soon."
        }
        href={gate === "not-certified" ? "/training" : "/"}
        actionLabel={gate === "not-certified" ? "Go to training" : "Go home"}
      />
    );
  }

  function back() {
    if (step === "otp") setStep("phone");
    else if (step === "name") setStep("otp");
    else router.push("/customers");
  }

  return (
    <section className="fade-up">
      {step !== "done" && (
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={back}
              aria-label="Back"
              className="grid size-10 cursor-pointer place-items-center rounded-lg text-ink-600 transition-colors hover:bg-canvas-sunken hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
            >
              <ArrowLeft className="size-5" aria-hidden />
            </button>
            <h1 className="font-sans text-xl font-semibold text-ink-900">
              Sign up a customer
            </h1>
          </div>
          <ol className="mt-3 flex items-center gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i === STEP_INDEX[step as Exclude<Step, "done">]
                    ? "bg-brand-red"
                    : i < STEP_INDEX[step as Exclude<Step, "done">]
                      ? "bg-ink-400"
                      : "bg-ink-200",
                )}
              />
            ))}
          </ol>
        </div>
      )}

      {step === "phone" && (
        <PhoneStep
          onNext={handlePhoneNext}
          loading={initiating}
          error={phoneError}
          guidance={phoneGuidance}
        />
      )}
      {step === "otp" && (
        <OtpStep
          phone={phone}
          onNext={handleOtpNext}
          onResend={handleResend}
          resending={resending}
          error={otpError}
        />
      )}
      {step === "name" && (
        <NameStep
          onSubmit={handleNameSubmit}
          loading={confirming}
          error={nameError}
        />
      )}
      {step === "done" && (
        <DoneStep maskedName={maskedName} onAnother={reset} />
      )}
    </section>
  );
}

function GateState({
  title,
  body,
  href,
  actionLabel,
}: {
  title: string;
  body: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <section className="fade-up">
      <div className="mt-2 rounded-2xl border border-border bg-surface p-6 text-center shadow-card">
        <h1 className="font-sans text-lg font-semibold text-ink-900">{title}</h1>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
          {body}
        </p>
        <Link
          href={href}
          className={buttonClassName({
            variant: "secondary",
            fullWidth: true,
            className: "mt-6",
          })}
        >
          {actionLabel}
        </Link>
      </div>
    </section>
  );
}
