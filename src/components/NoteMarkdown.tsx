import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { createHeadingIdFactory, nodeText } from "@/lib/notes";

/**
 * Documentation-style renderer for study note markdown.
 * Headings get stable ids so the "On this page" list can scroll to them.
 */
export function NoteMarkdown({ content }: { content: string }) {
  // A fresh id factory per render keeps ids identical to extractToc().
  const components = useMemo(() => {
    const nextId = createHeadingIdFactory();
    return {
      h1: (p: any) => <h1 className="mt-2 mb-4 text-3xl font-bold tracking-tight" {...p} />,
      h2: ({ children, ...rest }: any) => (
        <h2
          id={nextId(nodeText(children))}
          className="scroll-mt-24 mt-10 mb-3 border-b border-border/60 pb-2 text-2xl font-bold tracking-tight"
          {...rest}
        >
          {children}
        </h2>
      ),
      h3: ({ children, ...rest }: any) => (
        <h3 id={nextId(nodeText(children))} className="scroll-mt-24 mt-8 mb-2 text-xl font-semibold" {...rest}>
          {children}
        </h3>
      ),
      h4: (p: any) => <h4 className="mt-6 mb-2 text-base font-semibold text-primary" {...p} />,
      p: (p: any) => <p className="my-4 leading-8 text-[0.975rem]" {...p} />,
      ul: (p: any) => <ul className="my-4 list-disc space-y-2 pl-6 leading-8" {...p} />,
      ol: (p: any) => <ol className="my-4 list-decimal space-y-2 pl-6 leading-8" {...p} />,
      li: (p: any) => <li className="pl-1" {...p} />,
      a: (p: any) => <a className="text-primary underline underline-offset-4 hover:opacity-80" {...p} />,
      strong: (p: any) => <strong className="font-semibold text-foreground" {...p} />,
      img: (p: any) => (
        <img loading="lazy" decoding="async" className="my-5 rounded-xl border border-border" {...p} />
      ),
      code: ({ className, children, ...rest }: any) =>
        /language-/.test(className ?? "") ? (
          <code className={className} {...rest}>{children}</code>
        ) : (
          <code className="rounded bg-muted px-1.5 py-0.5 text-[0.85em]" {...rest}>{children}</code>
        ),
      pre: (p: any) => (
        <pre className="my-5 overflow-x-auto rounded-xl border border-border bg-muted/60 p-4 text-sm" {...p} />
      ),
      blockquote: (p: any) => (
        <blockquote
          className="my-5 rounded-r-lg border-l-4 border-primary/60 bg-primary/5 px-4 py-3 text-muted-foreground"
          {...p}
        />
      ),
      table: (p: any) => (
        <div className="my-5 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm" {...p} />
        </div>
      ),
      th: (p: any) => <th className="border-b border-border bg-muted/50 px-3 py-2 text-left font-semibold" {...p} />,
      td: (p: any) => <td className="border-b border-border/60 px-3 py-2 align-top" {...p} />,
      hr: () => <hr className="my-8 border-border" />,
    };
  }, [content]);

  return (
    <div className="note-content max-w-none overflow-x-hidden">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
        {content || "_This note is empty._"}
      </ReactMarkdown>
    </div>
  );
}
