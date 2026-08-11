import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string }>;

/** Consistent empty state: 32–40px icon, title, actionable description, optional action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: IconType;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? <Icon className="mx-auto h-9 w-9 text-muted-foreground" aria-hidden="true" /> : null}
      <p className="mt-3 font-semibold">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Specific, actionable error state — never "Something went wrong". */
export function ErrorState({
  title = "We couldn't load this content",
  error,
  onRetry,
  className,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "The server did not return a response. Check your connection and try again.";
  return (
    <div
      role="alert"
      className={cn("rounded-2xl border border-destructive/30 bg-destructive/5 p-5 sm:p-6", className)}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 break-words text-sm text-muted-foreground">{message}</p>
          {onRetry ? (
            <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function OfflineState({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm",
        className,
      )}
    >
      <WifiOff className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span>You're offline. Saved pages still work — new materials will load once you reconnect.</span>
    </div>
  );
}

/** Grid of card skeletons matching the standard card radius/height. */
export function CardGridSkeleton({
  count = 6,
  height = "h-40",
  className = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
}: {
  count?: number;
  height?: string;
  className?: string;
}) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn("rounded-2xl", height)} />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}

/** Accessible inline loading indicator with an aria-live announcement. */
export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground", className)}
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

/** Skeleton that mirrors a material card: meta row, title, description and the
 *  fixed-width Preview/Download button pair, so nothing shifts once data lands. */
export function MaterialCardSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:w-[15.5rem] sm:shrink-0">
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for subject cards — same height/rhythm as the real card. */
export function SubjectCardSkeleton({
  count = 3,
  className = "grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex h-full flex-col rounded-2xl border border-border bg-card-soft p-5 shadow-soft">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-4 rounded" />
          </div>
          <div className="mt-auto flex items-center gap-4 pt-6">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
