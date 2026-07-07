import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { downloadMaterial } from "@/lib/materials";
import { toast } from "sonner";

export type PreviewableMaterial = {
  id: string;
  title: string;
  file_url: string;
  file_name: string | null;
  file_type?: string | null;
};

export function MaterialPreviewDialog({
  material,
  onClose,
}: {
  material: PreviewableMaterial | null;
  onClose: () => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSignedUrl(null);
    if (!material?.file_url) return;
    setLoading(true);
    supabase.storage
      .from("learning-materials")
      .createSignedUrl(material.file_url, 60 * 10)
      .then(({ data }) => {
        if (cancelled) return;
        setSignedUrl(data?.signedUrl ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [material?.file_url]);

  const isPdf =
    !!material &&
    ((material.file_type ?? "").includes("pdf") ||
      (material.file_name ?? "").toLowerCase().endsWith(".pdf"));
  const isImage = !!material && (material.file_type ?? "").startsWith("image/");
  const canPreview = !!signedUrl && (isPdf || isImage);

  return (
    <Dialog open={!!material} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-border">
          <DialogTitle className="text-base truncate pr-8 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {material?.title ?? "Preview"}
          </DialogTitle>
        </DialogHeader>
        <div className="bg-muted/40 min-h-[70vh]">
          {loading || !signedUrl ? (
            <div className="h-[70vh] grid place-items-center text-sm text-muted-foreground">
              Loading preview…
            </div>
          ) : canPreview ? (
            isPdf ? (
              <iframe src={signedUrl} title={material?.title ?? "Preview"} className="w-full h-[75vh] bg-background" />
            ) : (
              <img src={signedUrl} alt={material?.title ?? "Preview"} className="w-full max-h-[75vh] object-contain bg-background" />
            )
          ) : (
            <div className="h-[70vh] grid place-items-center text-center px-6">
              <div>
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-semibold">Preview not supported</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {material?.file_name ?? "This file"} can't be shown here. Use Download to open it.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border">
          <div className="text-xs text-muted-foreground truncate">{material?.file_name}</div>
          <div className="flex gap-2">
            {material && (
              <Button
                size="sm"
                onClick={async () => {
                  const id = toast.loading("Preparing your download…");
                  try {
                    await downloadMaterial(material as never);
                    toast.success("Download started", { id });
                  } catch (err) {
                    toast.error("Could not download", { id, description: (err as Error)?.message });
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
