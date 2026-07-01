import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Save, User } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/profile")({
  head: () => ({ meta: [{ title: "Your profile — StudyHub" }] }),
  component: () => (
    <AdminShell title="Your profile" description="Your name and photo appear next to every material and deadline you publish.">
      {(ctx) => <ProfileForm userId={ctx.userId} />}
    </AdminShell>
  ),
});

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365 * 5; // 5 years

function initials(name: string | null | undefined, email: string | null | undefined) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function ProfileForm({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name,email,avatar_url,avatar_path")
        .eq("id", userId)
        .maybeSingle();
      if (!error && data) {
        setFullName(data.full_name ?? "");
        setEmail(data.email ?? null);
        setAvatarUrl(data.avatar_url ?? null);
        setAvatarPath(data.avatar_path ?? null);
      }
      setLoading(false);
    })();
  }, [userId]);

  const saveName = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName.trim() || null }).eq("id", userId);
    setSaving(false);
    if (error) { toast.error("Could not save name"); return; }
    toast.success("Profile updated");
  };

  const onPickFile = () => fileRef.current?.click();

  const onFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }

    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]+/g, "");
      const path = `${userId}/avatar-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: signed, error: signErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (signErr || !signed) throw signErr ?? new Error("Sign URL failed");

      // Remove old avatar file (best effort)
      if (avatarPath && avatarPath !== path) {
        await supabase.storage.from("avatars").remove([avatarPath]).catch(() => undefined);
      }

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: signed.signedUrl, avatar_path: path })
        .eq("id", userId);
      if (dbErr) throw dbErr;

      setAvatarUrl(signed.signedUrl);
      setAvatarPath(path);
      toast.success("Profile photo updated");
    } catch (e) {
      console.warn(e);
      toast.error("Could not upload photo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    setUploading(true);
    try {
      if (avatarPath) {
        await supabase.storage.from("avatars").remove([avatarPath]).catch(() => undefined);
      }
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null, avatar_path: null })
        .eq("id", userId);
      if (error) throw error;
      setAvatarUrl(null);
      setAvatarPath(null);
      toast.success("Photo removed");
    } catch {
      toast.error("Could not remove photo");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 grid place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      {/* Photo card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <Avatar className="h-28 w-28 ring-4 ring-primary/10">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt={fullName || "Avatar"} /> : null}
              <AvatarFallback className="text-xl bg-primary/10 text-primary">
                {initials(fullName, email)}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={onPickFile}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-elevated hover:opacity-90 disabled:opacity-60"
              aria-label="Change photo"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-4 font-semibold truncate max-w-full">{fullName || "Unnamed admin"}</div>
          {email && <div className="text-xs text-muted-foreground break-all">{email}</div>}
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="outline" onClick={onPickFile} disabled={uploading}>
              <Camera className="mr-2 h-4 w-4" />Upload
            </Button>
            {avatarUrl && (
              <Button size="sm" variant="ghost" onClick={removeAvatar} disabled={uploading}>
                Remove
              </Button>
            )}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">PNG or JPG, up to 5 MB.</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
      </div>

      {/* Details card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-2 mb-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <User className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-semibold">Personal details</h2>
            <p className="text-xs text-muted-foreground">Shown to students on every upload.</p>
          </div>
        </div>

        <div className="space-y-4 max-w-md">
          <div>
            <Label htmlFor="fullName" className="mb-1.5 block">Display name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Dr. Anika Perera"
              maxLength={80}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Email</Label>
            <Input value={email ?? ""} disabled readOnly />
            <p className="mt-1 text-[11px] text-muted-foreground">Managed by your account, not editable here.</p>
          </div>

          <Button onClick={saveName} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
