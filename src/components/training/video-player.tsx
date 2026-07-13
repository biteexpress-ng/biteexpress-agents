interface VideoPlayerProps {
  youtubeId: string;
  title: string;
}

/** Responsive privacy-mode YouTube embed. */
export function VideoPlayer({ youtubeId, title }: VideoPlayerProps) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-ink-900">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?rel=0`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        loading="lazy"
        className="size-full border-0"
      />
    </div>
  );
}
