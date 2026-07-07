import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Admin sign in — StudyHub" }] }),
  component: AuthPage,
});

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.44-1.66 4.22-5.5 4.22-3.31 0-6.01-2.74-6.01-6.12S8.69 6.08 12 6.08c1.88 0 3.14.8 3.86 1.49l2.63-2.53C16.9 3.6 14.65 2.6 12 2.6 6.86 2.6 2.7 6.76 2.7 11.9S6.86 21.2 12 21.2c6.93 0 9.3-4.87 9.3-9.3 0-.62-.07-1.09-.16-1.7H12z"/>
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) routeToRole();
    });
  }, []);

  const routeToRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isSuper = roles?.some((r) => r.role === "super_admin");
    const isAdmin = roles?.some((r) => r.role === "admin");
    if (isSuper) navigate({ to: "/super" });
    else if (isAdmin) navigate({ to: "/admin" });
    else { toast.info("Signed in. An administrator must assign you a role."); navigate({ to: "/" }); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
        });
        if (error) throw error;
        toast.success("Account created. You may need to confirm your email.");
        await routeToRole();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
        await routeToRole();
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex relative bg-hero text-white p-12 flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_40%),radial-gradient(circle_at_80%_60%,white_0,transparent_40%)]" />
        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 backdrop-blur"><GraduationCap className="h-5 w-5" /></div>
            <span className="font-bold">StudyHub</span>
          </Link>
        </div>
        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight">Admin & super-admin sign in</h2>
          <p className="mt-3 text-white/80 max-w-md">Manage semesters, subjects, materials, deadlines and student requests in one place.</p>
        </div>
        <div className="relative text-xs text-white/60">Students don't need an account — go to the <Link to="/" className="underline">home page</Link>.</div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to home</Link></Button>
          <h1 className="text-2xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" ? "Sign in to your admin account." : "Sign up — a super admin will assign your role."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name" className="mb-1.5 block">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={100} />
              </div>
            )}
            <div>
              <Label htmlFor="email" className="mb-1.5 block">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div>
              <Label htmlFor="password" className="mb-1.5 block">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-primary font-medium hover:underline">
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
