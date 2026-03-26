import OpenAI from 'openai';
import { z } from 'zod';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ReviewSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  critiques: z.array(z.string()),
  repairInstructions: z.string().optional(),
});

export type UIReviewResult = z.infer<typeof ReviewSchema>;

const REVIEWER_SYSTEM_PROMPT = `You are a strict, senior UI Frontend Architect analyzing generated React code.

Your job is to run a second-pass review and ensure the code meets our mandatory quality rules.

MANDATORY CHECKS:
1. Is the layout logical and the visual hierarchy strong?
2. Is the spacing balanced (e.g., proper use of gaps, margins, paddings without looking cluttered)?
3. Are components consistent and modular?
4. Are there visually broken concepts (like random empty boxes, meaningless card spam, broken responsive design)?
5. Is the UI too plain, or is the 3D/animation excessive and unusable?
6. Does the code compile and look like production-worthy Tailwind?

OUTPUT FORMAT:
Return ONLY valid JSON matching this schema:
{
  "passed": boolean, // true if the UI is production-ready, false if it needs repair
  "score": number, // 0-100 rating
  "critiques": string[], // Specific issues found (e.g., "The hero section lacks spacing", "Too many generic boxes")
  "repairInstructions": string // If passed=false, provide exact instructions for the repair agent to fix it
}

If the score is below 75, passed must be false.
Be highly critical. We want premium, expert-level interfaces, not basic templates.`;

export async function reviewGeneratedCode(code: string, intentContext: string): Promise<UIReviewResult> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Use the strongest model for critique
      messages: [
        { role: 'system', content: REVIEWER_SYSTEM_PROMPT },
        { role: 'user', content: `Original Intent Context:\n${intentContext}\n\nGenerated Code to Review:\n\`\`\`tsx\n${code}\n\`\`\`` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 500,
    });

    const raw = response.choices[0]?.message?.content || '';
    if (!raw) return { passed: true, score: 80, critiques: ['Reviewer returned empty'] };

    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return { passed: true, score: 80, critiques: ['Parse failed'] }; }

    const result = ReviewSchema.safeParse(parsed);
    if (!result.success) {
      return { passed: true, score: 80, critiques: ['Schema validation failed'] };
    }

    return result.data;
  } catch (error) {
    console.error('Critique Engine Error:', error);
    // On failure, default to pass to avoid breaking the pipeline entirely
    return { passed: true, score: 80, critiques: ['Critique engine threw an exception'] };
  }
}

const REPAIR_SYSTEM_PROMPT = `You are an expert React/TypeScript repair agent.
You are given a broken or low-quality React component, along with specific critiques from a Senior UI Architect.

Your job is to FIX the component entirely.
Apply the requested structural, visual, or logical patches.
Ensure the layout is robust, the aesthetics are premium, and Tailwind classes are used correctly.

OUTPUT FORMAT: Return ONLY the raw TSX code for the fixed component. No markdown fences. No explanations.`;

export async function repairGeneratedCode(brokenCode: string, repairInstructions: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: REPAIR_SYSTEM_PROMPT },
        { role: 'user', content: `REPAIR INSTRUCTIONS:\n${repairInstructions}\n\nBROKEN / SUBPAR CODE:\n\`\`\`tsx\n${brokenCode}\n\`\`\`` },
      ],
      temperature: 0.2, // Low temp for reliable fixing
      max_tokens: 5000,
    });

    const rawContent = response.choices[0]?.message?.content || '';
    
    // Clean code
    const match = rawContent.match(/```(?:tsx?|jsx?|typescript|javascript)?\\s*([\\s\\S]*?)(?:```|$)/i);
    const cleaned = match && match[1] ? match[1].trim() : rawContent.replace(/^```(?:tsx?|jsx?|typescript|javascript)?\\n?/gim, '').replace(/```\\s*$/gim, '').trim();

    return cleaned || brokenCode; // fallback to original if completely empty
  } catch (error) {
    console.error('Repair Engine Error:', error);
    return brokenCode;
  }
}
