import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type AIProvider = "chatgpt" | "gemini";

const PROVIDER_LABEL: Record<AIProvider, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
};

/** ChatGPT supports ?q= to prefill and auto-send the first message.
 *  Gemini's public web UI does NOT support any URL prefill, so we just
 *  open a new chat and rely on the clipboard for the prompt.            */
function providerUrl(provider: AIProvider, prompt: string): string {
  if (provider === "chatgpt") {
    return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
  }
  return "https://gemini.google.com/app";
}

function buildPrompt(input: {
  materialTitle: string;
  materialType: string;
  subject?: string | null;
  semester?: string | null;
  fileName?: string | null;
}) {
  const { materialTitle, materialType, subject, semester, fileName } = input;
  return `I am a university student. I have attached the PDF "${fileName ?? "material.pdf"}". Please teach me it completely and clearly.

Material details:
- Title: ${materialTitle}
- Subject: ${subject ?? "Unknown"}
- Semester: ${semester ?? "Unknown"}
- Material type: ${materialType}

Explain the whole PDF without missing important content, in simple student-friendly English. Follow this structure:
1. Short overview of the PDF.
2. Every major heading/topic in order.
3. Clear theory for each topic.
4. All formulas with the meaning of each symbol (use LaTeX).
5. How to substitute values for any calculations.
6. Small easy examples for difficult concepts.
7. Diagrams, graphs, tables and flowcharts if present.
8. Important definitions.
9. Exam-important points.
10. Common viva questions with speaking-style answers.
11. Possible short-answer questions.
12. Possible long-answer questions.
13. Final quick revision summary.

Do not skip small points. Teach me like I am preparing for a quiz or exam.`;
}

/**
 * Opens ChatGPT (with the prompt pre-filled) or Gemini (empty chat, prompt on
 * clipboard) in a new browser tab, and starts a PDF download of the material
 * so the student can drag it straight into the attach box.
 *
 * ⚠ Neither ChatGPT nor Gemini allow attaching a file via URL parameters, so
 * the PDF must be attached manually by the student in the opened tab.
 * This uses the student's own AI account — it consumes ZERO Lovable credits.
 */
export async function openExternalAIExplain(
  provider: AIProvider,
  material: {
    id?: string;
    title: string;
    material_type: string;
    subject?: string | null;
    semester?: string | null;
    file_name?: string | null;
    file_url?: string | null;
  },
) {
  const prompt = buildPrompt({
    materialTitle: material.title,
    materialType: material.material_type,
    subject: material.subject,
    semester: material.semester,
    fileName: material.file_name,
  });

  // Copy the prompt so Gemini users can paste; ChatGPT prefills via ?q= but
  // we still copy as a backup.
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(prompt);
    }
  } catch {
    // ignore — clipboard blocked
  }

  // Open the AI provider in a new tab
  if (typeof window !== "undefined") {
    window.open(providerUrl(provider, prompt), "_blank", "noopener,noreferrer");
  }

  // Trigger a download of the PDF so the student has the exact file ready to
  // attach in the AI tab. Done best-effort — never block or fail loudly.
  if (material.file_url) {
    try {
      const { data } = await supabase.storage
        .from("learning-materials")
        .createSignedUrl(material.file_url, 60 * 5);
      if (data?.signedUrl) {
        const a = document.createElement("a");
        a.href = data.signedUrl;
        a.download = material.file_name ?? "material.pdf";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      console.error("PDF download for AI attach failed", e);
    }
  }

  toast.success(`${PROVIDER_LABEL[provider]} opened in a new tab`, {
    description:
      provider === "chatgpt"
        ? `Prompt is prefilled. Attach the downloaded "${material.file_name ?? "PDF"}" and press send.`
        : `Prompt was copied. Paste it, attach the downloaded "${material.file_name ?? "PDF"}", and press send.`,
  });
}
