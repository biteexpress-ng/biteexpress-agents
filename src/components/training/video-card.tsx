"use client";

import { Check, ChevronDown, Play } from "lucide-react";
import type { TrainingVideo } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { VideoPlayer } from "./video-player";

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface VideoCardProps {
  video: TrainingVideo;
  open: boolean;
  onToggle: () => void;
  onMarkDone: () => void;
  marking: boolean;
  error?: string | null;
}

export function VideoCard({
  video,
  open,
  onToggle,
  onMarkDone,
  marking,
  error,
}: VideoCardProps) {
  const duration = formatDuration(video.duration_seconds);
  const panelId = `video-${video.id}-panel`;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full cursor-pointer items-center gap-3 p-4 text-left transition-colors hover:bg-canvas-sunken/60"
      >
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full",
            video.watched
              ? "bg-success-soft text-[color:var(--color-success-strong)]"
              : "bg-canvas-sunken text-ink-500",
          )}
        >
          {video.watched ? (
            <Check className="size-5" aria-hidden />
          ) : (
            <Play className="size-5" aria-hidden />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium text-ink-900">
            {video.title}
          </span>
          <span className="mt-0.5 block text-sm">
            {video.watched ? (
              <span className="inline-flex items-center gap-1 font-medium text-[color:var(--color-success-strong)]">
                <Check className="size-3.5" aria-hidden />
                Done
              </span>
            ) : duration ? (
              <span className="tabular-nums text-muted-foreground">
                {duration}
              </span>
            ) : (
              <span className="text-muted-foreground">Video</span>
            )}
          </span>
        </span>

        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-ink-400 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div id={panelId} className="border-t border-border p-4">
          <VideoPlayer youtubeId={video.youtube_video_id} title={video.title} />

          {error && (
            <Alert tone="error" className="mt-4">
              {error}
            </Alert>
          )}

          {video.watched ? (
            <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-medium text-[color:var(--color-success-strong)]">
              <Check className="size-4" aria-hidden />
              You&apos;ve completed this video
            </p>
          ) : (
            <Button
              className="mt-4"
              fullWidth
              loading={marking}
              onClick={onMarkDone}
            >
              Mark as done
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
