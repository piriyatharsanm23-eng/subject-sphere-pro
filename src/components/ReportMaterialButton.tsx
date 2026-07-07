import { useState } from "react";
import { AlertTriangle, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const MATERIAL_ISSUE_TYPES = [
  { value: "wrong_subject", label: "Wrong subject" },
  { value: "wrong_semester", label: "Wrong semester" },
  { value: "wrong_file", label: "Wrong file" },
  { value: "blurry_scan", label: "Blurry scan" },
  { value: "duplicate", label: "Duplicate upload" },
  { value: "not_opening", label: "File not opening" },
  { value: "missing_pages", label: "Missing pages" },
] as const;

export function materialIssueLabel(v: string | null | undefined) {
  return MATERIAL_ISSUE_TYPES.find((t) => t.value === v)?.label ?? v ?? null;
}

export function ReportMaterialButton({
  materialId,
  materialTitle,
  semesterId,
  subjectId,
}: {
  materialId: string;
  materialTitle: string;
  semesterId: string;
  subjectId: string;
}) {
  const [open, setOpen] = useState(false);
  const [issue, setIssue] = useState<string>("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!issue) return toast.error("Pick an issue type");
    setSaving(true);
    try {
      const label = materialIssueLabel(issue) ?? issue;
      const text =
        `[Material correction] ${label}\n` +
        `Material: ${materialTitle}` +
        (note.trim() ? `\n\n${note.trim()}` : "");
      const { error } = await supabase.from("student_requests").insert({
        semester_id: semesterId,
        subject_id: subjectId,
        material_id: materialId,
        issue_type: issue,
        request_text: text,
        status: "pending",
      } as never);
      if (error) throw error;
      toast.success("Report sent — admins will review it.");
      setOpen(false);
      setIssue("");
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send report");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <AlertTriangle className="mr-2 h-4 w-4" />Report issue
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report a problem with this material</DialogTitle>
          <DialogDescription>
            Let admins know what's wrong. Your report is anonymous.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block">Issue type</Label>
            <Select value={issue} onValueChange={setIssue}>
              <SelectTrigger><SelectValue placeholder="Choose an issue" /></SelectTrigger>
              <SelectContent>
                {MATERIAL_ISSUE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">Extra details (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="e.g. pages 5-8 are missing, or shows the wrong subject."
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
