import { Errors } from '@/lib/api/errors';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';

const SYSTEM_INSTRUCTION = `You are a senior genealogy researcher for the 'Toldot' system. You specialize in Rabbinical lineages and Jewish history. Your responses must be in Hebrew, accurate, and based on reliable historical sources. Always use the search tool to verify facts about specific individuals.`;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export async function generateGroundedHebrewBio(userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Errors.internal('GEMINI_API_KEY is not configured');
  }

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      tools: [
        {
          google_search: {},
        },
      ],
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
      },
    }),
  });

  if (!response.ok) {
    throw Errors.internal(`Gemini request failed (${response.status})`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!text) {
    throw Errors.internal('Gemini returned an empty response');
  }

  return text;
}
