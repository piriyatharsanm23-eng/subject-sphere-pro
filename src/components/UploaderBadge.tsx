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
 * Falls back to a neutral "Staff" label if the uploader profile isn't available.
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

  return (
    <span className={cn("inline-flex items-center gap-1.5 min-w-0", className)}>
      <Avatar className={cn(dims, "ring-1 ring-border")}>
        {avatar ? <AvatarImage src={avatar} alt={name} /> : null}
        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <span className={cn(text, "text-muted-foreground truncate")}>{name}</span>
    </span>
  );
}
