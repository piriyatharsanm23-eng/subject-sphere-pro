import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Copy, Download, Loader2, RefreshCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { explainMaterial } from "@/lib/ai-explain.functions";

export type AIProvider = "chatgpt" | "gemini";

export type AIExplainTarget = {
  id: string;
  title: string;
  material_type: string;
};

const providerMeta: Record<AIProvider, { label: string; accent: string }> = {
  chatgpt: { label: "ChatGPT", accent: "text-emerald-400" },
  gemini: { label: "Gemini", accent: "text-sky-400" },
};

/**
 * Minimal Markdown → HTML renderer for the AI explanation.
 * Keeps the bundle tiny and avoids injecting a heavy MD library for one dialog.
 */
function renderMd(md: string): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  // Fenced code blocks first
  const parts: string[] = [];
  const codeRe = /```([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = codeRe.exec(md)) !== null) {
    parts.push(processInline(md.slice(last, m.index)));
    parts.push(
      `<pre class="bg-muted/60 border border-border rounded-lg p-3 my-3 overflow-x-auto text-xs"><code>${esc(m[1].trim())}</code></pre>`,
    );
    last = m.index + m[0].length;
  }
  parts.push(processInline(md.slice(last)));
  return parts.join("");

  function processInline(chunk: string): string {
    const lines = chunk.split("\n");
    let html = "";
    let inList = false;
    for (let raw of lines) {
      const line = raw.trimEnd();
      const bulletMatch = /^\s*[-*]\s+(.*)/.exec(line);
      if (bulletMatch) {
        if (!inList) {
          html += '<ul class="list-disc pl-5 my-2 space-y-1">';
          inList = true;
        }
        html += `<li>${inlineFmt(bulletMatch[1])}</li>`;
        continue;
      }
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      if (!line.trim()) {
        html += "";
        continue;
      }
      if (line.startsWith("### ")) {
        html += `<h4 class="mt-4 mb-2 font-semibold text-primary">${inlineFmt(line.slice(4))}</h4>`;
      } else if (line.startsWith("## ")) {
        html += `<h3 class="mt-5 mb-2 text-lg font-bold">${inlineFmt(line.slice(3))}</h3>`;
      } else if (line.startsWith("# ")) {
        html += `<h2 class="mt-6 mb-3 text-xl font-bold">${inlineFmt(line.slice(2))}</h2>`;
      } else {
        html += `<p class="my-2 leading-relaxed">${inlineFmt(line)}</p>`;
      }
    }
    if (inList) html += "</ul>";
    return html;
  }

  function inlineFmt(s: string): string {
    let out = esc(s);
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/`([^`]+)`/g, '<code class="rounded bg-muted/70 px-1 py-0.5 text-[0.85em]">$1</code>');
    return out;
  }
}

export function AIExplainDialog({
  open,
  onClose,
  target,
  initialProvider,
}: {
  open: boolean;
  onClose: () => void;
  target: AIExplainTarget | null;
  initialProvider: AIProvider;
}) {
  const [provider, setProvider] = useState<AIProvider>(initialProvider);
  const [result, setResult] = useState<{
    explanation: string;
    subject: string | null;
    subject_code: string | null;
    semester: string | null;
    provider: AIProvider;
    material: { title: string; material_type: string; file_name: string | null };
  } | null>(null);

  const explainFn = useServerFn(explainMaterial);
  const mut = useMutation({
    mutationFn: (p: AIProvider) =>
      explainFn({ data: { materialId: target!.id, provider: p } }),
    onSuccess: (data) => setResult(data as never),
    onError: (err: Error) => toast.error(err.message ?? "Something went wrong"),
  });

  // Auto-fire when opened with a fresh target
  const targetId = target?.id ?? "";
  useMemo(() => {
    if (open && targetId && !mut.isPending && !result) {
      mut.mutate(provider);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetId]);

  function switchProvider(next: AIProvider) {
    setProvider(next);
    setResult(null);
    mut.mutate(next);
  }

  function regenerate() {
    setResult(null);
    mut.mutate(provider);
  }

  function copyText() {
    if (!result?.explanation) return;
    navigator.clipboard.writeText(result.explanation);
    toast.success("Explanation copied");
  }

  function downloadTxt() {
    if (!result) return;
    const blob = new Blob([result.explanation], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.material.title.replace(/[^\w\-]+/g, "_")}-ai-explanation.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setResult(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-3xl w-[calc(100vw-1.5rem)] p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-4 sm:px-5 py-3 border-b border-border">
          <DialogTitle className="text-base flex items-center gap-2 pr-8">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">AI Study Explanation</span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 sm:px-5 py-3 border-b border-border bg-muted/20 space-y-2">
          {target && (
            <div className="text-sm">
              <div className="font-semibold truncate">{target.title}</div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {result?.subject && (
                  <span>
                    <span className="font-semibold">Subject:</span> {result.subject_code ? `${result.subject_code} · ` : ""}{result.subject}
                  </span>
                )}
                {result?.semester && (
                  <span>
                    <span className="font-semibold">Semester:</span> {result.semester}
                  </span>
                )}
                <span>
                  <span className="font-semibold">Type:</span> {target.material_type}
                </span>
                <span className={providerMeta[provider].accent}>
                  <span className="font-semibold">Provider:</span> {providerMeta[provider].label}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4">
          {mut.isPending && (
            <div className="min-h-[40vh] grid place-items-center text-center">
              <div>
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <p className="mt-3 font-semibold">
                  AI is reading your PDF and preparing explanation…
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  This may take up to a minute for large PDFs.
                </p>
              </div>
            </div>
          )}
          {!mut.isPending && mut.isError && (
            <div className="min-h-[40vh] grid place-items-center text-center">
              <div className="max-w-md">
                <Bot className="mx-auto h-8 w-8 text-destructive" />
                <p className="mt-3 font-semibold">Something went wrong</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {(mut.error as Error)?.message ?? "Please try again."}
                </p>
                <Button className="mt-4" onClick={regenerate}>
                  <RefreshCcw className="mr-2 h-4 w-4" /> Try again
                </Button>
              </div>
            </div>
          )}
          {!mut.isPending && result && (
            <article
              className="prose prose-invert max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: renderMd(result.explanation) }}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3 border-t border-border">
          <div className="flex gap-2 mr-auto">
            <Button
              size="sm"
              variant={provider === "chatgpt" ? "default" : "outline"}
              onClick={() => provider !== "chatgpt" && switchProvider("chatgpt")}
              disabled={mut.isPending}
            >
              <Bot className="mr-2 h-4 w-4" /> ChatGPT
            </Button>
            <Button
              size="sm"
              variant={provider === "gemini" ? "default" : "outline"}
              onClick={() => provider !== "gemini" && switchProvider("gemini")}
              disabled={mut.isPending}
            >
              <Sparkles className="mr-2 h-4 w-4" /> Gemini
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={regenerate} disabled={mut.isPending || !result}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Regenerate
          </Button>
          <Button size="sm" variant="outline" onClick={copyText} disabled={!result}>
            <Copy className="mr-2 h-4 w-4" /> Copy
          </Button>
          <Button size="sm" onClick={downloadTxt} disabled={!result}>
            <Download className="mr-2 h-4 w-4" /> Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="mr-2 h-4 w-4" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
