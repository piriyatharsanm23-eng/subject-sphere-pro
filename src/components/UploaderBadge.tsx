import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type UploaderInfo = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

function initials(name: string | null | undefined) {
  const src = (name || "?").trim();
  const parts = src.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/**
 * Small chip showing the person who uploaded a material or created a deadline.
 * Links to the contributor's public profile page when an id is known.
 */
export function UploaderBadge({
  uploader,
  className,
  size = "sm",
}: {
  uploader?: UploaderInfo | null;
  className?: string;
  size?: "xs" | "sm";
}) {
  const name = uploader?.full_name?.trim() || "Staff";
  const avatar = uploader?.avatar_url ?? null;
  const dims = size === "xs" ? "h-5 w-5" : "h-6 w-6";
  const text = size === "xs" ? "text-[10px]" : "text-[11px]";

  const content = (
    <span className={cn("inline-flex items-center gap-1.5 min-w-0", className)}>
      <Avatar className={cn(dims, "ring-1 ring-border")}>
        {avatar ? <AvatarImage src={avatar} alt={name} /> : null}
        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <span className={cn(text, "text-muted-foreground truncate hover:text-primary transition-colors")}>{name}</span>
    </span>
  );

  if (uploader?.id) {
    return (
      <Link to="/contributors/$id" params={{ id: uploader.id }} className="min-w-0">
        {content}
      </Link>
    );
  }
  return content;
}
