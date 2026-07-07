import { toast } from "sonner";

export type AIProvider = "chatgpt" | "gemini";

const PROVIDER_LABEL: Record<AIProvider, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
};

function buildPrompt(input: {
  materialTitle: string;
  materialType: string;
  subject?: string | null;
  semester?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
}) {
  const { materialTitle, materialType, subject, semester, fileName, fileUrl } = input;
  const link = fileUrl && fileUrl.length > 0 ? fileUrl : "PDF/file link not available";
  return `I am a university student. I want you to teach me this PDF/lecture material completely and clearly.

Material details:
Title: ${materialTitle}
Subject: ${subject ?? "Unknown"}
Semester: ${semester ?? "Unknown"}
Material type: ${materialType}
File name: ${fileName ?? "Unknown"}
PDF/file link: ${link}

Please explain the whole material without missing important content.
I need the explanation in simple student-friendly English.

Follow this structure:
1. First give a short overview of what this material is about.
2. Then explain every major heading/topic in order.
3. For each topic, explain the theory clearly.
4. Explain all formulas with the meaning of each symbol.
5. Show how to substitute values if there are calculations.
6. Give small easy examples for difficult concepts.
7. Explain diagrams, graphs, tables, and flowcharts if they are in the PDF.
8. Mention important definitions.
9. Mention exam-important points.
10. Give common viva questions and simple speaking-style answers.
11. Give possible short-answer questions.
12. Give possible long-answer questions.
13. At the end, give a final quick revision summary.
14. Do not skip small points.
15. If you cannot access the PDF/file link, ask me to upload the PDF manually.

Teach me like I am preparing for a quiz or exam.`;
}

function providerUrl(provider: AIProvider, encoded: string): string {
  if (provider === "chatgpt") return `https://chatgpt.com/?q=${encoded}`;
  return `https://gemini.google.com/app?prompt=${encoded}`;
}

/**
 * Opens ChatGPT or Gemini in a new tab with the study prompt prefilled via URL.
 * Also copies the prompt to clipboard in the background as a fallback.
 * Uses the student's own AI account — consumes ZERO Lovable credits.
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
    fileUrl: material.file_url,
  });

  const encoded = encodeURIComponent(prompt);

  // Background clipboard copy as fallback (especially for Gemini).
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(prompt);
    }
  } catch {
    // ignore — clipboard blocked
  }

  if (typeof window !== "undefined") {
    window.open(providerUrl(provider, encoded), "_blank", "noopener,noreferrer");
  }

  if (provider === "gemini") {
    toast.success("Study prompt prepared", {
      description:
        "If Gemini does not show it automatically, paste it manually.",
    });
  } else {
    toast.success(`${PROVIDER_LABEL[provider]} opened in a new tab`);
  }
}
