/**
 * imageService.ts — Genera una imagen hiperrealista del jugador en turno
 * ejecutando la acción de la afirmación, usando su selfie (y la del {otro})
 * como referencia con Gemini 3 Pro Image Preview (Nano Banana Pro).
 *
 * Diseñado para correr en background al inicio de cada turno y devolver
 * el base64 de la imagen ~20-25s después.
 */
import { GoogleGenAI } from '@google/genai';
import { getScenePromptFor, PlayerIdentity } from './viralAffirmations';
import type { RelationType } from './types';

const GEMINI_MODEL = 'gemini-3-pro-image-preview';

let cachedClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  GEMINI_API_KEY no seteada — image-gen deshabilitada');
    return null;
  }
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

export function isImageGenAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Genera una imagen para el turno actual.
 *
 * @param relationType  pool del que viene la afirmación (para mapear al scenePrompt)
 * @param affirmationTemplate  texto con {yo}/{otro} (NO el texto ya rellenado)
 * @param yo  jugador en turno
 * @param otro  otro jugador (opcional para afirmaciones single-subject)
 * @returns base64 (sin data URL prefix) o null si falla / no hay key / no hay selfies
 */
export async function generateTurnImage(
  relationType: RelationType,
  affirmationTemplate: string,
  yo: { name: string; gender: 'hombre' | 'mujer' | 'otro'; selfieBase64?: string; role?: string },
  otro?: { name: string; gender: 'hombre' | 'mujer' | 'otro'; selfieBase64?: string; role?: string },
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  // Necesitamos al menos la selfie del yo
  if (!yo.selfieBase64) {
    console.log(`🖼️  Sin selfie de ${yo.name} — skip image-gen`);
    return null;
  }

  // Construir el prompt con identity-lock + anti-distortion
  const idA: PlayerIdentity = { name: yo.name, gender: yo.gender, role: yo.role };
  const idB: PlayerIdentity | undefined = otro ? { name: otro.name, gender: otro.gender, role: otro.role } : undefined;

  const prompt = getScenePromptFor(relationType, affirmationTemplate, idA, idB);
  if (!prompt) {
    console.log(`🖼️  No scenePrompt curado para "${affirmationTemplate}" — skip`);
    return null;
  }

  // Construir contents: [prompt, selfie_yo, selfie_otro?]
  const parts: any[] = [{ text: prompt }];
  parts.push({
    inlineData: { mimeType: 'image/jpeg', data: yo.selfieBase64 },
  });
  if (otro?.selfieBase64) {
    parts.push({
      inlineData: { mimeType: 'image/jpeg', data: otro.selfieBase64 },
    });
  }

  try {
    const t0 = Date.now();
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: '1:1' },
      },
    });

    const candidates = (response as any).candidates;
    if (!candidates?.[0]?.content?.parts) {
      console.error('🖼️  Gemini response sin parts');
      return null;
    }
    for (const part of candidates[0].content.parts) {
      if (part.inlineData?.data) {
        const dt = Math.round((Date.now() - t0) / 100) / 10;
        console.log(`🖼️  Imagen generada (${dt}s, ${Math.round(part.inlineData.data.length / 1024)}KB)`);
        return part.inlineData.data;
      }
    }
    console.error('🖼️  Gemini response sin imagen');
    return null;
  } catch (err: any) {
    console.error('🖼️  Error generando imagen:', err.message || err);
    return null;
  }
}
