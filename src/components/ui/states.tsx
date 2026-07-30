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
