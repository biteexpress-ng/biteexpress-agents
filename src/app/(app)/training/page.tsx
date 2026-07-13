"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CircleCheckBig, RefreshCw, TriangleAlert } from "lucide-react";
import {
  getTrainingVideos,
  markVideoWatched,
} from "@/lib/api/agent";
import { ApiRequestError, type TrainingVideo } from "@/lib/api/types";
import { useAuthStore } from "@/stores/auth";
import { buttonClassName, Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoCard } from "@/components/training/video-card";
import { ProgressBar } from "@/components/training/progress-bar";

type LoadState = "loading" | "error" | "ready";

export default function TrainingPage() {
  const agent = useAuthStore((s) => s.agent);
  const setAgent = useAuthStore((s) => s.setAgent);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [trainingComplete, setTrainingComplete] = useState(false);

  const [openId, setOpenId] = useState<number | null>(null);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [markError, setMarkError] = useState<{ id: number; message: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoadState("loading");
    setLoadError(null);
    try {
      const res = await getTrainingVideos();
      const sorted = [...res.videos].sort((a, b) => a.sort_order - b.sort_order);
      setVideos(sorted);
      setTrainingComplete(res.training_complete);
      setLoadState("ready");
    } catch (err) {
      setLoadError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn't load your training. Check your connection and try again.",
      );
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleMarkDone(id: number) {
    setMarkingId(id);
    setMarkError(null);
    const prevVideos = videos;
    const prevComplete = trainingComplete;

    // Optimistic — flip to watched immediately.
    setVideos((list) =>
      list.map((v) => (v.id === id ? { ...v, watched: true } : v)),
    );

    try {
      const res = await markVideoWatched(id);
      setVideos((list) =>
        list.map((v) => (v.id === id ? { ...v, watched: res.watched } : v)),
      );
      setTrainingComplete(res.training_complete);
      if (res.training_complete && agent && !agent.training_complete) {
        setAgent({ ...agent, training_complete: true });
      }
      setOpenId(null);
    } catch (err) {
      // Revert the optimistic change and surface the reason on the card.
      setVideos(prevVideos);
      setTrainingComplete(prevComplete);
      setMarkError({
        id,
        message:
          err instanceof ApiRequestError
            ? err.message
            : "Couldn't save that. Check your connection and try again.",
      });
    } finally {
      setMarkingId(null);
    }
  }

  const watched = videos.filter((v) => v.watched).length;
  const total = videos.length;
  const pct = total > 0 ? Math.round((watched / total) * 100) : 0;

  return (
    <section className="fade-up">
      <header>
        <h1 className="font-sans text-xl font-semibold text-ink-900">
          Get certified
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Watch every video, then take the quiz to unlock your referral code.
        </p>
      </header>

      {loadState === "loading" && <TrainingSkeleton />}

      {loadState === "error" && (
        <div className="mt-6">
          <Alert tone="error" icon={<TriangleAlert className="size-5" />}>
            {loadError}
          </Alert>
          <Button
            variant="secondary"
            className="mt-4"
            fullWidth
            onClick={() => void load()}
          >
            <RefreshCw className="size-4" aria-hidden />
            Try again
          </Button>
        </div>
      )}

      {loadState === "ready" && total === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-center">
          <p className="text-base font-medium text-ink-900">
            No training videos yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your videos will appear here as soon as they&apos;re published. Check
            back soon.
          </p>
        </div>
      )}

      {loadState === "ready" && total > 0 && (
        <>
          {trainingComplete ? (
            <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-success-soft text-[color:var(--color-success-strong)]">
                  <CircleCheckBig className="size-6" aria-hidden />
                </span>
                <div>
                  <h2 className="font-sans text-lg font-semibold text-ink-900">
                    Training complete
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    You&apos;ve watched every video. One step left.
                  </p>
                </div>
              </div>
              <Link
                href="/quiz"
                className={buttonClassName({
                  fullWidth: true,
                  className: "mt-5",
                })}
              >
                Take the quiz
              </Link>
            </div>
          ) : (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-ink-800">
                  {watched} of {total} videos done
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {pct}%
                </span>
              </div>
              <ProgressBar
                value={watched}
                max={total}
                label={`${watched} of ${total} videos done`}
              />
            </div>
          )}

          <ul className="mt-6 flex flex-col gap-3">
            {videos.map((video) => (
              <li key={video.id}>
                <VideoCard
                  video={video}
                  open={openId === video.id}
                  onToggle={() =>
                    setOpenId((cur) => (cur === video.id ? null : video.id))
                  }
                  onMarkDone={() => void handleMarkDone(video.id)}
                  marking={markingId === video.id}
                  error={markError?.id === video.id ? markError.message : null}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function TrainingSkeleton() {
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-8" />
      </div>
      <Skeleton className="h-1.5 w-full" />
      <ul className="mt-6 flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4"
          >
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-12" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
