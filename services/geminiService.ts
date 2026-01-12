
import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceName, Segment, Speaker } from "../types.ts";

// Simple session usage tracking
let sessionCharactersGenerated = 0;

export const getSessionUsage = () => sessionCharactersGenerated;

/**
 * Handles API errors and converts them into user-friendly messages.
 */
const handleApiError = (error: any): Error => {
  console.error("Gemini API Error:", error);
  const message = error?.message || "";
  
  if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED")) {
    return new Error(
      "Quota Exceeded: You've reached your Gemini API limit. Please check your billing at ai.google.dev/gemini-api/docs/billing or wait a minute before trying again."
    );
  }
  if (message.includes("401") || message.includes("API_KEY_INVALID")) {
    return new Error("Invalid API Key: Please update your Gemini API key in Settings.");
  }
  return new Error(message || "An unexpected error occurred during audio generation.");
};

/**
 * Retries a function with exponential backoff for transient errors (like 429).
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let delay = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED");
      if (isRateLimit && i < maxRetries - 1) {
        console.warn(`Rate limited. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue;
      }
      throw handleApiError(error);
    }
  }
  throw new Error("Maximum retries exceeded.");
}

export const generateVoicePreview = async (voiceName: VoiceName, label: string, apiKey: string): Promise<string> => {
  if (!apiKey) throw new Error("Gemini API Key is missing. Please set it in Settings.");
  
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });
    const text = `আসসালামু আলাইকুম, আমি ${label}। আমি আপনার গল্পের অংশ হতে পারি।`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned from Gemini.");
    return base64Audio;
  });
};

export const generateMultiSpeakerSpeech = async (
  segments: Segment[], 
  speakers: Speaker[],
  apiKey: string
): Promise<string> => {
  if (!apiKey) throw new Error("Gemini API Key is missing. Please set it in Settings.");

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });
    
    const totalChars = segments.reduce((acc, s) => acc + s.text.length, 0);
    const usedSpeakerIds = Array.from(new Set(segments.map(s => s.speakerId)));
    const usedSpeakers = speakers.filter(s => usedSpeakerIds.includes(s.id));

    if (usedSpeakers.length > 2) throw new Error("Maximum 2 characters allowed per audio generation.");
    if (usedSpeakers.length === 0) throw new Error("No dialogue found.");

    const prompt = segments.map(seg => {
      const speaker = speakers.find(s => s.id === seg.speakerId);
      return `${speaker?.name || 'Speaker'}: ${seg.text}`;
    }).join('\n');

    let response;
    if (usedSpeakers.length === 2) {
      const speakerVoiceConfigs = usedSpeakers.map(s => ({
        speaker: s.name,
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: s.voice }
        }
      }));

      response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: speakerVoiceConfigs
            },
          },
        },
      });
    } else {
      const singleSpeaker = usedSpeakers[0];
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: singleSpeaker.voice },
            },
          },
        },
      });
    }

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned from Gemini.");
    
    // Only increment tracking on success
    sessionCharactersGenerated += totalChars;
    return base64Audio;
  });
};
