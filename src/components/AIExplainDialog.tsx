import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
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

function MdView({ children }: { children: string }) {
  return (
    <div className="ai-md text-sm leading-relaxed space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: (p) => <h2 className="mt-6 mb-3 text-xl font-bold" {...p} />,
          h2: (p) => <h3 className="mt-5 mb-2 text-lg font-bold" {...p} />,
          h3: (p) => <h4 className="mt-4 mb-2 font-semibold text-primary" {...p} />,
          h4: (p) => <h5 className="mt-3 mb-1 font-semibold" {...p} />,
          p: (p) => <p className="my-2 leading-relaxed" {...p} />,
          ul: (p) => <ul className="list-disc pl-5 my-2 space-y-1" {...p} />,
          ol: (p) => <ol className="list-decimal pl-5 my-2 space-y-1" {...p} />,
          li: (p) => <li className="pl-1" {...p} />,
          strong: (p) => <strong className="font-semibold text-foreground" {...p} />,
          em: (p) => <em className="italic" {...p} />,
          code: ({ className, children, ...rest }) => {
            const isBlock = /language-/.test(className ?? "");
            if (isBlock) {
              return (
                <code className={className} {...rest}>
                  {children}
                </code>
              );
            }
            return (
              <code
                className="rounded bg-muted/70 px-1 py-0.5 text-[0.85em]"
                {...rest}
              >
                {children}
              </code>
            );
          },
          pre: (p) => (
            <pre
              className="bg-muted/60 border border-border rounded-lg p-3 my-3 overflow-x-auto text-xs"
              {...p}
            />
          ),
          blockquote: (p) => (
            <blockquote
              className="border-l-2 border-primary/60 pl-3 my-3 text-muted-foreground italic"
              {...p}
            />
          ),
          table: (p) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full text-xs border border-border rounded" {...p} />
            </div>
          ),
          th: (p) => (
            <th className="border border-border bg-muted/40 px-2 py-1 text-left" {...p} />
          ),
          td: (p) => <td className="border border-border px-2 py-1 align-top" {...p} />,
          hr: () => <hr className="my-4 border-border" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
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
  useEffect(() => {
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
