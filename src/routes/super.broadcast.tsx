import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Mail, Megaphone, Send } from "lucide-react";
import { SuperShell } from "@/components/SuperShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { sendBroadcast } from "@/lib/broadcast.functions";

export const Route = createFileRoute("/super/broadcast")({
  head: () => ({
    meta: [
      { title: "Broadcast to contributors | StudyHub" },
      { name: "description", content: "Send an announcement to StudyHub contributors by app notification and email." },
      { property: "og:title", content: "Broadcast to contributors | StudyHub" },
      { property: "og:description", content: "Send an announcement to StudyHub contributors by app notification and email." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BroadcastPage,
});

const PRESET =
  "Please upload your latest lecture notes, past papers and tutorials for your subjects. Log in to StudyHub and add them under your semester so students get them on time.";

function BroadcastPage() {
  const send = useServerFn(sendBroadcast);
  const [title, setTitle] = useState("Please upload your notes");
  const [message, setMessage] = useState(PRESET);
  const [link, setLink] = useState("/admin");
  const [audience, setAudience] = useState<"contributors" | "admins" | "everyone">("contributors");
  const [busy, setBusy] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await send({ data: { title, message, link, audience } });
      setEmails(res.emails);
      toast.success(`Sent to ${res.recipients} people (app + device notifications)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the message");
    } finally {
      setBusy(false);
    }
  };

  const mailto = () =>
    `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent(title)}&body=${encodeURIComponent(message)}`;

  return (
    <SuperShell
      title="Broadcast message"
      description="Remind contributors to upload their notes — delivered as an app + device notification, with an email option."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4" /> Compose
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bc-aud">Send to</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as typeof audience)}>
                <SelectTrigger id="bc-aud"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contributors">Contributors (admins + uploaders)</SelectItem>
                  <SelectItem value="admins">Semester admins only</SelectItem>
                  <SelectItem value="everyone">Everyone with an account</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bc-title">Title</Label>
              <Input id="bc-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bc-msg">Message</Label>
              <Textarea id="bc-msg" rows={6} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bc-link">Open link (optional)</Label>
              <Input id="bc-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/admin" />
            </div>
            <Button onClick={submit} disabled={busy || title.trim().length < 3 || message.trim().length < 3}>
              <Send className="h-4 w-4" /> {busy ? "Sending…" : "Send notification"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" /> Email the same message
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {emails.length === 0 ? (
              <p>Send the notification first — the recipients' email addresses appear here so you can email them too.</p>
            ) : (
              <>
                <p>{emails.length} email address{emails.length === 1 ? "" : "es"} ready.</p>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/40 p-2 text-xs break-all">
                  {emails.join(", ")}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <a href={mailto()}><Mail className="h-4 w-4" /> Open email app</a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(emails.join(", "));
                      toast.success("Email addresses copied");
                    }}
                  >
                    <Copy className="h-4 w-4" /> Copy addresses
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperShell>
  );
}
