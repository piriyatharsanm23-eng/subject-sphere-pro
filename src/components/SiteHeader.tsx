import { Link } from "@tanstack/react-router";
import { GraduationCap, Settings, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary-gradient shadow-glow">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight group-hover:text-primary transition-colors">StudyHub</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
            <Link to="/dashboard">Dashboard</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
            <Link to="/select">
              <Settings className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Preferences</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="px-2 sm:px-3">
            <Link to="/auth">
              <LogIn className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
