import { toast } from "sonner";

export type AIProvider = "chatgpt" | "gemini";

const PROVIDER_URL: Record<AIProvider, string> = {
  chatgpt: "https://chat.openai.com/",
  gemini: "https://gemini.google.com/app",
};

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
}) {
  const { materialTitle, materialType, subject, semester, fileName } = input;
  return `I am a university student. Teach me the attached PDF/lecture slide completely and clearly.

Material details:
- Title: ${materialTitle}
- Subject: ${subject ?? "Unknown"}
- Semester: ${semester ?? "Unknown"}
- Material type: ${materialType}
- File name: ${fileName ?? "material.pdf"}

Please explain the whole PDF without missing important content, in simple student-friendly English.

Follow this structure:
1. Short overview of the PDF.
2. Every major heading/topic in order.
3. For each topic, clear theory.
4. All formulas with the meaning of each symbol (use LaTeX).
5. How to substitute values for any calculations.
6. Small easy examples for difficult concepts.
7. Diagrams, graphs, tables and flowcharts if present.
8. Important definitions.
9. Exam-important points.
10. Common viva questions with speaking-style answers.
11. Possible short-answer questions.
12. Possible long-answer questions.
13. A final quick revision summary.

Teach me like I am preparing for a quiz or exam. Do not skip small points.`;
}

/**
 * Copies a ready-to-use study prompt to the clipboard and opens the chosen
 * AI provider (ChatGPT or Gemini) in a new browser tab.
 * Uses the user's own account on ChatGPT / Gemini — does NOT consume any
 * Lovable AI credits.
 */
export async function openExternalAIExplain(
  provider: AIProvider,
  material: {
    title: string;
    material_type: string;
    subject?: string | null;
    semester?: string | null;
    file_name?: string | null;
  },
) {
  const prompt = buildPrompt({
    materialTitle: material.title,
    materialType: material.material_type,
    subject: material.subject,
    semester: material.semester,
    fileName: material.file_name,
  });

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(prompt);
    }
  } catch {
    // clipboard may be blocked — fall through and still open the tab
  }

  if (typeof window !== "undefined") {
    window.open(PROVIDER_URL[provider], "_blank", "noopener,noreferrer");
  }

  toast.success(`Prompt copied — paste it in ${PROVIDER_LABEL[provider]}`, {
    description: `After pasting, attach the downloaded PDF (${material.file_name ?? "your file"}) and press send.`,
  });
}
