import { supabase } from "@/integrations/supabase/client";

export const MATERIAL_TYPES = [
  { value: "lecture_slide", label: "Lecture Slides", badge: "bg-[oklch(var(--badge-lecture))]/10 text-[oklch(var(--badge-lecture))] border border-[oklch(var(--badge-lecture))]/20" },
  { value: "note", label: "Notes", badge: "bg-[oklch(var(--badge-note))]/10 text-[oklch(var(--badge-note))] border border-[oklch(var(--badge-note))]/20" },
  { value: "past_paper", label: "Past Papers", badge: "bg-[oklch(var(--badge-paper))]/10 text-[oklch(var(--badge-paper))] border border-[oklch(var(--badge-paper))]/20" },
  { value: "assignment", label: "Assignments", badge: "bg-[oklch(var(--badge-assignment))]/10 text-[oklch(var(--badge-assignment))] border border-[oklch(var(--badge-assignment))]/20" },
  { value: "other", label: "Other", badge: "bg-[oklch(var(--badge-other))]/10 text-[oklch(var(--badge-other))] border border-[oklch(var(--badge-other))]/20" },
] as const;

export type MaterialType = typeof MATERIAL_TYPES[number]["value"];

export function materialTypeLabel(t: string) {
  return MATERIAL_TYPES.find((m) => m.value === t)?.label ?? "Other";
}
export function materialTypeBadge(t: string) {
  return MATERIAL_TYPES.find((m) => m.value === t)?.badge ?? MATERIAL_TYPES[4].badge;
}

export async function downloadMaterial(material: { id: string; file_url: string; file_name: string | null }) {
  // file_url is the storage path inside bucket 'learning-materials'
  const { data, error } = await supabase.storage
    .from("learning-materials")
    .createSignedUrl(material.file_url, 60 * 5);
  if (error || !data) throw error ?? new Error("Could not generate download link");

  // Trigger download
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.download = material.file_name ?? "download";
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Increment download count (fire & forget)
  await supabase.rpc("increment_download", { _material_id: material.id });
}
