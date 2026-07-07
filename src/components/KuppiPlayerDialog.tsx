import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Video, ExternalLink, Maximize2 } from "lucide-react";
import { toYoutubeEmbed } from "@/lib/kuppi";

type PlayingItem = {
  title: string;
  video_url: string;
  presenter_name?: string | null;
};

export function KuppiPlayerDialog({
  item,
  onClose,
}: {
  item: PlayingItem | null;
  onClose: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const embed = item ? toYoutubeEmbed(item.video_url) : null;
  // Autoplay + inline-play in fullscreen when available.
  const src = embed ? `${embed}${embed.includes("?") ? "&" : "?"}autoplay=1&rel=0&playsinline=1` : null;

  useEffect(() => {
    if (!item) return;
    // Small delay so the iframe is mounted before requesting fullscreen.
    const t = setTimeout(() => {
      const el = wrapRef.current;
      if (el && document.fullscreenEnabled && !document.fullscreenElement) {
        el.requestFullscreen?.().catch(() => {
          /* silently ignore if browser blocks it */
        });
      }
    }, 100);
    return () => clearTimeout(t);
  }, [item]);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && item) {
        // user pressed Esc — close the dialog too.
        onClose();
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [item, onClose]);

  const requestFs = () => {
    wrapRef.current?.requestFullscreen?.().catch(() => {});
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base flex items-center gap-2 min-w-0 flex-1">
              <Video className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{item?.title ?? "Kuppi"}</span>
            </DialogTitle>
            <Button size="sm" variant="ghost" onClick={requestFs} className="h-8 gap-1.5">
              <Maximize2 className="h-3.5 w-3.5" /> Fullscreen
            </Button>
          </div>
        </DialogHeader>
        <div ref={wrapRef} className="bg-black aspect-video fullscreen:aspect-auto fullscreen:h-screen fullscreen:w-screen">
          {item && (src ? (
            <iframe
              src={src}
              title={item.title}
              className="w-full h-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <div className="h-full grid place-items-center text-center px-6 text-white/80">
              <div>
                <ExternalLink className="mx-auto h-8 w-8" />
                <p className="mt-3 font-semibold">This video is hosted outside YouTube.</p>
                <p className="mt-1 text-sm">Open it in a new tab to watch.</p>
                <Button asChild size="sm" className="mt-3">
                  <a href={item.video_url} target="_blank" rel="noopener">
                    <ExternalLink className="mr-2 h-4 w-4" /> Open link
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>
        {item?.presenter_name && (
          <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
            Presented by <b className="text-foreground">{item.presenter_name}</b>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
