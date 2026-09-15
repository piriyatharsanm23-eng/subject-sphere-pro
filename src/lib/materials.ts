import { supabase } from "@/integrations/supabase/client";

export const MATERIAL_TYPES = [
  { value: "note", label: "Notes", badge: "bg-badge-note/10 text-badge-note border border-badge-note/30" },
  { value: "past_paper", label: "Past Papers", badge: "bg-badge-paper/10 text-badge-paper border border-badge-paper/30" },
  { value: "assignment", label: "Assignments", badge: "bg-badge-assignment/10 text-badge-assignment border border-badge-assignment/30" },
  { value: "other", label: "Tutorials", badge: "bg-badge-other/10 text-badge-other border border-badge-other/30" },
] as const;

export type MaterialType = typeof MATERIAL_TYPES[number]["value"];

export function materialTypeLabel(t: string) {
  // legacy "lecture_slide" rows are shown as Notes in the updated catalog
  if (t === "lecture_slide") return "Notes";
  return MATERIAL_TYPES.find((m) => m.value === t)?.label ?? "Notes";
}
export function materialTypeBadge(t: string) {
  if (t === "lecture_slide") return MATERIAL_TYPES[0].badge;
  return MATERIAL_TYPES.find((m) => m.value === t)?.badge ?? MATERIAL_TYPES[0].badge;
}

/** Signed link to a stored file. `download` forces a save instead of opening. */
export async function signedMaterialUrl(
  filePath: string,
  opts?: { download?: string | null; expiresIn?: number },
) {
  const { data, error } = await supabase.storage
    .from("learning-materials")
    .createSignedUrl(
      filePath,
      opts?.expiresIn ?? 60 * 10,
      opts?.download ? { download: opts.download } : undefined,
    );
  if (error || !data?.signedUrl) throw error ?? new Error("Could not generate link");
  return data.signedUrl;
}

export async function downloadMaterial(material: { id: string; file_url: string; file_name: string | null }) {
  // file_url is the storage path inside bucket 'learning-materials'
  const url = await signedMaterialUrl(material.file_url, {
    download: material.file_name ?? "download",
    expiresIn: 60 * 5,
  });

  // The `download` attribute is ignored for cross-origin URLs (all mobile
  // browsers), so rely on the signed URL's attachment header and navigate.
  window.location.href = url;
}
