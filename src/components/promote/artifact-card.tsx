"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RefreshCw, Share2 } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type RenderFn = (code: string, firstName: string) => Promise<Blob>;

interface ArtifactCardProps {
  title: string;
  description: string;
  code: string;
  firstName: string;
  render: RenderFn;
  /** Download filename, e.g. `biteexpress-poster-CODE.png`. */
  filename: string;
  /** Intrinsic pixel size, used for the preview aspect ratio and alt text. */
  width: number;
  height: number;
  /** Alt text for the rendered preview; the code is appended for a11y. */
  previewAlt: string;
  /** Optional text posted alongside the file via Web Share. */
  shareText?: string;
  /** Letterbox colour behind the preview (light paper vs dark surface). */
  frameClassName?: string;
}

type State = "rendering" | "ready" | "error";

/**
 * Renders one artifact (poster or status image) to a Blob on the client, shows
 * a scaled-down live preview, and exposes Share (Web Share with the PNG file,
 * guarded) and Download. Rendering shows a skeleton; a failure shows a quiet
 * retry, never a crash or blank.
 */
export function ArtifactCard({
  title,
  description,
  code,
  firstName,
  render,
  filename,
  width,
  height,
  previewAlt,
  shareText,
  frameClassName = "bg-canvas-sunken",
}: ArtifactCardProps) {
  const [state, setState] = useState<State>("rendering");
  const [url, setUrl] = useState<string | null>(null);
  const [canShareFile, setCanShareFile] = useState(false);
  const fileRef = useRef<File | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setState("rendering");

    render(code, firstName)
      .then((blob) => {
        if (!active) return;
        const file = new File([blob], filename, { type: "image/png" });
        fileRef.current = file;
        setCanShareFile(
          typeof navigator !== "undefined" &&
            typeof navigator.canShare === "function" &&
            navigator.canShare({ files: [file] }),
        );
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("error");
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [code, firstName, render, filename, attempt]);

  const download = useCallback(() => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [url, filename]);

  const share = useCallback(async () => {
    const file = fileRef.current;
    if (file && canShareFile) {
      try {
        await navigator.share({ files: [file], title, text: shareText });
        return;
      } catch {
        // User dismissed the sheet or share failed: fall through to download so
        // the action is never a dead end.
      }
    }
    download();
  }, [canShareFile, download, shareText, title]);

  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>

      <div
        className={`mx-auto mt-4 w-full max-w-[260px] overflow-hidden rounded-xl border border-border ${frameClassName}`}
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {state === "ready" && url ? (
          <img
            src={url}
            alt={`${previewAlt} Referral code ${code}.`}
            width={width}
            height={height}
            className="h-full w-full object-contain"
          />
        ) : state === "error" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Could not build this image.
            </p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium text-brand-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
            >
              <RefreshCw className="size-4" aria-hidden />
              Try again
            </button>
          </div>
        ) : (
          <Skeleton className="h-full w-full rounded-none" />
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={share}
          disabled={state !== "ready"}
          className={buttonClassName()}
        >
          <Share2 className="size-5" aria-hidden />
          Share
        </button>
        <button
          type="button"
          onClick={download}
          disabled={state !== "ready"}
          className={buttonClassName({ variant: "secondary" })}
        >
          <Download className="size-5" aria-hidden />
          Download
        </button>
      </div>
    </article>
  );
}
