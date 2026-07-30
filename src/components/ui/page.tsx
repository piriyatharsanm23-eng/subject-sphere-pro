import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared page primitives so every route uses the same container width,
 * vertical rhythm and header hierarchy.
 */

const WIDTHS = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
  full: "max-w-none",
} as const;

export function PageContainer({
  children,
  size = "default",
  className,
}: {
  children: ReactNode;
  size?: keyof typeof WIDTHS;
  className?: string;
}) {
  return (
    <main className={cn("container mx-auto w-full flex-1 px-4 sm:px-6 py-6 sm:py-8", WIDTHS[size], className)}>
      {children}
    </main>
  );
}

export type Crumb = { label: string; to?: string; params?: Record<string, string> };

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {c.to && !last ? (
                <Link
                  to={c.to}
                  params={c.params as never}
                  className="truncate rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {c.label}
                </Link>
              ) : (
                <span className="truncate text-foreground/80" aria-current={last ? "page" : undefined}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  breadcrumbs,
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  breadcrumbs?: Crumb[];
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Primary page action(s), right-aligned on desktop. */
  actions?: ReactNode;
  /** Search / filter controls rendered under the title block. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 sm:mb-8", className)}>
      {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} className="mb-2" /> : null}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{eyebrow}</div>
          ) : null}
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight break-words sm:text-3xl">{title}</h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div>
        ) : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </header>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  className,
  as: As = "h2",
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className={cn("mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3", className)}>
      <div className="min-w-0">
        <As className="text-base font-semibold tracking-tight sm:text-lg">{title}</As>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Standard toolbar for search + filter controls; wraps cleanly on mobile. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>{children}</div>
  );
}
