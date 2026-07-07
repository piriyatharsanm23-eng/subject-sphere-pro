import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const PROMPT_TEMPLATE = `I am a university student. Teach me this PDF/lecture slide completely and clearly.

Material details:
Title: {{material_title}}
Subject: {{subject_name}}
Semester: {{semester_name}}
Material type: {{material_type}}
File name: {{file_name}}

Please explain the whole PDF without missing important content.

I need the explanation in simple student-friendly English.

Follow this structure:

1. First give a short overview of what this PDF is about.
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

Do not skip small points.
If any page is unclear, mention which page or section is unclear.
Teach me like I am preparing for a quiz or exam.

FORMATTING RULES (very important — the UI renders Markdown + KaTeX):
- Use ## for major headings, ### for subheadings, **bold** for key terms, - for bullets.
- ALL mathematical formulas, equations, symbols, subscripts, superscripts, Greek letters,
  vectors, matrices and units MUST be written in LaTeX math, NEVER as plain text.
- Inline math: wrap with single dollar signs, e.g. $I_a = V_{an}/Z_a$, $\\alpha$, $\\angle{-120^\\circ}$.
- Display math (equations on their own line): wrap with double dollar signs, e.g.
  $$I_{neutral} = I_a + I_b + I_c = 0 \\quad \\text{(if balanced)}$$
- Never use \`\`\`code fences\`\`\` for formulas — always use $...$ or $$...$$.
- Use \\text{...} for words inside math, \\angle for angles, ^\\circ for degrees,
  \\frac{a}{b} for fractions, \\sqrt{x}, \\sum, \\int, \\vec{v}, \\hat{x}, \\overline{X}.`;

export const explainMaterial = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        materialId: z.string().uuid(),
        provider: z.enum(["chatgpt", "gemini"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "AI provider is not configured. Please connect OpenAI or Gemini in settings.",
      );
    }

    const { supabaseAdmin: admin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Fire settings + material + cached explanation in parallel
    const [
      { data: settings },
      { data: material, error: matErr },
      { data: cached },
    ] = await Promise.all([
      admin
        .from("ai_settings")
        .select("enabled,chatgpt_enabled,gemini_enabled")
        .eq("id", true)
        .maybeSingle(),
      admin
        .from("materials")
        .select(
          "id,title,material_type,file_url,file_name,file_type,subject_id,semester_id",
        )
        .eq("id", data.materialId)
        .maybeSingle(),
      (admin as any)
        .from("ai_explanations")
        .select("explanation")
        .eq("material_id", data.materialId)
        .eq("provider", data.provider)
        .maybeSingle(),
    ]);

    if (!settings?.enabled) throw new Error("AI Study Helper is turned off.");
    if (data.provider === "chatgpt" && !settings.chatgpt_enabled)
      throw new Error("ChatGPT provider is disabled.");
    if (data.provider === "gemini" && !settings.gemini_enabled)
      throw new Error("Gemini provider is disabled.");
    if (matErr || !material) throw new Error("Material not found.");

    const [{ data: subject }, { data: semester }] = await Promise.all([
      admin.from("subjects").select("name,code").eq("id", material.subject_id).maybeSingle(),
      admin.from("semesters").select("name").eq("id", material.semester_id).maybeSingle(),
    ]);

    // Serve cached explanation immediately (huge speedup on repeat clicks)
    if (cached?.explanation) {
      return {
        explanation: cached.explanation as string,
        material: {
          id: material.id,
          title: material.title,
          material_type: material.material_type,
          file_name: material.file_name,
        },
        subject: subject?.name ?? null,
        subject_code: subject?.code ?? null,
        semester: semester?.name ?? null,
        provider: data.provider,
        cached: true,
      };
    }


    // Get signed URL for the file
    const { data: signed, error: signErr } = await admin.storage
      .from("learning-materials")
      .createSignedUrl(material.file_url, 60 * 10);
    if (signErr || !signed?.signedUrl) {
      throw new Error(
        "AI could not access this PDF. Please make the file public or use a signed file URL.",
      );
    }

    // Download file
    const fileRes = await fetch(signed.signedUrl);
    if (!fileRes.ok) {
      throw new Error(
        "AI could not access this PDF. Please make the file public or use a signed file URL.",
      );
    }
    const contentLength = Number(fileRes.headers.get("content-length") ?? 0);
    if (contentLength && contentLength > MAX_PDF_BYTES) {
      throw new Error(
        "This PDF is too large for one request. Please split it or generate explanation section by section.",
      );
    }
    const buf = await fileRes.arrayBuffer();
    if (buf.byteLength > MAX_PDF_BYTES) {
      throw new Error(
        "This PDF is too large for one request. Please split it or generate explanation section by section.",
      );
    }

    // Extract PDF text (works in serverless — no native deps)
    const isPdf =
      (material.file_type ?? "").includes("pdf") ||
      (material.file_name ?? "").toLowerCase().endsWith(".pdf");
    let extractedText = "";
    if (isPdf) {
      try {
        const { extractText, getDocumentProxy } = await import("unpdf");
        const pdf = await getDocumentProxy(new Uint8Array(buf));
        const { text } = await extractText(pdf, { mergePages: true });
        extractedText = Array.isArray(text) ? text.join("\n\n") : text;
      } catch (e: any) {
        console.error("PDF extract failed", e);
        throw new Error(
          "AI could not read this PDF. It may be a scanned image — please provide a text-based PDF.",
        );
      }
    } else {
      // For non-PDFs, try to decode as text (works for txt, md)
      try {
        extractedText = new TextDecoder().decode(buf).slice(0, 200_000);
      } catch {
        throw new Error("This file type is not supported for AI explanation yet.");
      }
    }

    const trimmed = extractedText.trim();
    if (!trimmed) {
      throw new Error(
        "No readable text was found in this file. It may be a scanned image.",
      );
    }

    const prompt = PROMPT_TEMPLATE.replaceAll(
      "{{material_title}}",
      material.title,
    )
      .replaceAll("{{subject_name}}", subject?.name ?? "Unknown")
      .replaceAll("{{semester_name}}", semester?.name ?? "Unknown")
      .replaceAll("{{material_type}}", material.material_type)
      .replaceAll("{{file_name}}", material.file_name ?? "material");

    const model =
      data.provider === "gemini"
        ? "google/gemini-2.5-flash-lite"
        : "openai/gpt-5-nano";

    const aiRes = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are an expert university tutor. Produce thorough, exam-focused explanations in clean Markdown. Be concise where possible.",
          },
          {
            role: "user",
            content: `${prompt}\n\n---\nPDF CONTENT BELOW\n---\n\n${trimmed.slice(0, 80_000)}`,
          },
        ],
      }),
    });

    if (aiRes.status === 429)
      throw new Error("AI is busy right now. Please try again in a moment.");
    if (aiRes.status === 402)
      throw new Error(
        "AI credits are exhausted. Please add credits in Lovable settings.",
      );
    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      console.error("AI gateway error", aiRes.status, errText);
      throw new Error("AI provider request failed. Please try again.");
    }

    const json = (await aiRes.json()) as any;
    const explanation: string =
      json?.choices?.[0]?.message?.content?.toString() ?? "";
    if (!explanation.trim()) throw new Error("AI returned an empty response.");

    // Cache for future clicks (don't block the response)
    (admin as any)
      .from("ai_explanations")
      .upsert({
        material_id: material.id,
        provider: data.provider,
        explanation,
      })
      .then(() => {})
      .catch((e: any) => console.error("cache save failed", e));

    return {
      explanation,
      material: {
        id: material.id,
        title: material.title,
        material_type: material.material_type,
        file_name: material.file_name,
      },
      subject: subject?.name ?? null,
      subject_code: subject?.code ?? null,
      semester: semester?.name ?? null,
      provider: data.provider,
      cached: false,
    };
  });
