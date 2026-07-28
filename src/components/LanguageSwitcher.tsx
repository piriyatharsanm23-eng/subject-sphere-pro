import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { LANG_LABELS, useT, type Lang } from "@/lib/i18n";
import { Check } from "lucide-react";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang, t } = useT();
  const langs: Lang[] = ["en", "ta", "si"];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("common.language")} className={className}>
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>{t("common.language")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {langs.map((l) => (
          <DropdownMenuItem key={l} onClick={() => setLang(l)} className="cursor-pointer">
            <Check className={`h-4 w-4 mr-2 ${lang === l ? "opacity-100" : "opacity-0"}`} />
            {LANG_LABELS[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
