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

export async function downloadMaterial(material: { id: string; file_url: string; file_name: string | null }) {
  // file_url is the storage path inside bucket 'learning-materials'
  const { data, error } = await supabase.storage
    .from("learning-materials")
    .createSignedUrl(material.file_url, 60 * 5);
  if (error || !data) throw error ?? new Error("Could not generate download link");

  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.download = material.file_name ?? "download";
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();

  const { error: insertError } = await supabase.from("downloads").insert({ material_id: material.id });
  if (insertError) {
    console.warn("[downloads] failed to record download", insertError);
  }
}
