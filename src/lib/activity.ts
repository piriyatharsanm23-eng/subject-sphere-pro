import { supabase } from "@/integrations/supabase/client";

export const ACTION_TYPES = [
  "upload",
  "edit",
  "delete",
  "archive",
  "deadline_create",
  "deadline_edit",
  "deadline_delete",
  "deadline_archive",
  "admin_assign",
  "request_status_change",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export function actionLabel(a: string) {
  switch (a) {
    case "upload": return "Upload";
    case "edit": return "Edit";
    case "delete": return "Delete";
    case "archive": return "Archive";
    case "deadline_create": return "Deadline created";
    case "deadline_edit": return "Deadline edited";
    case "deadline_delete": return "Deadline deleted";
    case "deadline_archive": return "Deadline archived";
    case "admin_assign": return "Admin assigned";
    case "request_status_change": return "Request status";
    default: return a;
  }
}

export function actionBadge(a: string) {
  // green / blue / red / orange / purple per spec
  switch (a) {
    case "upload":
      return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30";
    case "edit":
    case "request_status_change":
      return "bg-sky-500/15 text-sky-300 border border-sky-500/30";
    case "delete":
    case "archive":
    case "deadline_delete":
      return "bg-rose-500/15 text-rose-300 border border-rose-500/30";
    case "deadline_create":
    case "deadline_edit":
    case "deadline_archive":
      return "bg-orange-500/15 text-orange-300 border border-orange-500/30";
    case "admin_assign":
      return "bg-violet-500/15 text-violet-300 border border-violet-500/30";
    default:
      return "bg-muted text-muted-foreground border border-border";
  }
}

export async function logActivity(params: {
  action_type: ActionType;
  description: string;
  target_type?: string | null;
  target_id?: string | null;
  semester_id?: string | null;
  subject_id?: string | null;
}) {
  // user_id, user_name and user_role are populated server-side by a BEFORE INSERT
  // trigger; clients cannot forge them. Placeholders satisfy NOT NULL columns.
  const { error } = await supabase.from("activity_logs").insert({
    user_id: "00000000-0000-0000-0000-000000000000",
    user_name: "",
    user_role: "",
    action_type: params.action_type,
    description: params.description,
    target_type: params.target_type ?? null,
    target_id: params.target_id ?? null,
    semester_id: params.semester_id ?? null,
    subject_id: params.subject_id ?? null,
  });
  if (error) {
    console.warn("logActivity failed", error);
  }
}

/**
 * Organised storage path for an uploaded material:
 *   <semester>/<subject>/<material_type>/<filename>
 * Keeps the bucket browsable: each semester contains its subjects,
 * each subject contains topic/type folders.
 */
export function buildMaterialStoragePath(p: {
  semesterSlug: string;
  subjectSlug: string;
  materialType: string;
  fileName: string;
}) {
  const safe = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "item";
  return `${safe(p.semesterSlug)}/${safe(p.subjectSlug)}/${safe(p.materialType)}/${Date.now()}-${safe(p.fileName)}`;
}
