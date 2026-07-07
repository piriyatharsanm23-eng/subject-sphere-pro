import { Link } from "@tanstack/react-router";
import { GraduationCap, Settings, LogIn, Users, Menu, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useState } from "react";
import { GlobalSearch, SearchTrigger, useGlobalSearch } from "@/components/GlobalSearch";

const NAV = [
  { to: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { to: "/contributors" as const, label: "Contributors", icon: Users },
  { to: "/select" as const, label: "Preferences", icon: Settings },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const search = useGlobalSearch();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 min-w-0 group">
          <div className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl bg-primary-gradient shadow-glow">
            <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight truncate group-hover:text-primary transition-colors">
            StudyHub
          </span>
        </Link>

        <div className="hidden md:flex flex-1 justify-center max-w-md">
          <SearchTrigger onClick={() => search.setOpen(true)} className="w-full" />
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((n) => (
            <Button key={n.to} asChild variant="ghost" size="sm">
              <Link to={n.to}>
                <n.icon className="h-4 w-4 mr-1.5" />
                {n.label}
              </Link>
            </Button>
          ))}
          <Button asChild variant="outline" size="sm">
            <Link to="/auth">
              <LogIn className="h-4 w-4 mr-1.5" /> Admin
            </Link>
          </Button>
        </nav>

        {/* Mobile actions */}
        <div className="md:hidden flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Search" className="h-9 w-9" onClick={() => search.setOpen(true)}>
            <Menu className="hidden" />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Open menu" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0 bg-background/95 backdrop-blur-xl border-border/60">
              <SheetHeader className="px-5 pt-5">
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <nav className="mt-4 flex flex-col px-3 pb-6">
                {NAV.map((n) => (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-accent/20"
                  >
                    <n.icon className="h-5 w-5 text-primary" />
                    {n.label}
                  </Link>
                ))}
                <Link
                  to="/auth"
                  onClick={() => setOpen(false)}
                  className="mt-2 flex items-center gap-3 rounded-xl border border-border px-3 py-3 text-sm font-medium hover:bg-accent/20"
                >
                  <LogIn className="h-5 w-5 text-primary" />
                  Admin sign in
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <GlobalSearch open={search.open} onOpenChange={search.setOpen} />
    </header>
  );
}
