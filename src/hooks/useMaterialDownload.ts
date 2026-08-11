import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { downloadMaterial } from "@/lib/materials";

type DownloadableMaterial = { id: string; file_url: string; file_name: string | null };

/**
 * Tracks which material is currently being prepared so the Preview/Download
 * button pair can show a spinner and disable itself until the link is ready.
 */
export function useMaterialDownload() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const inFlight = useRef(false);

  const download = useCallback(async (material: DownloadableMaterial) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setDownloadingId(material.id);
    const id = toast.loading("Preparing your download…");
    try {
      await downloadMaterial(material);
      toast.success("Download started", { id });
    } catch (err) {
      toast.error("Could not download this file", { id, description: (err as Error)?.message });
    } finally {
      inFlight.current = false;
      setDownloadingId(null);
    }
  }, []);

  const isDownloading = useCallback((id: string) => downloadingId === id, [downloadingId]);

  return { download, downloadingId, isDownloading, busy: downloadingId !== null };
}
