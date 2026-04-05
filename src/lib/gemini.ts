import { GoogleGenAI, Type } from "@google/genai";
import { Chapter } from "../types";

function getAI(customKey?: string) {
  // Use custom key from UI, or environment variable from Vite
  const apiKey = customKey || (import.meta.env.VITE_GEMINI_API_KEY as string) || "";
  return new GoogleGenAI({ apiKey });
}

export async function generateOutline(bookTitle: string, chapterCount: number = 5, customKey?: string, lang: 'en' | 'vi' = 'en'): Promise<{ chapters: Chapter[], coverKeyword: string }> {
  const ai = getAI(customKey);
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Create a detailed table of contents for an ebook titled "${bookTitle}". 
    The entire output MUST be in ${lang === 'en' ? 'English' : 'Vietnamese'}.
    Return a JSON object with:
    1. 'chapters': an array of exactly ${chapterCount} objects, each with 'title', 'description' (a brief summary), and 'imageKeyword' (a 2-3 word keyword for a stock photo related to this chapter).
    2. 'coverKeyword': a 2-3 word keyword for a professional book cover image.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          chapters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                imageKeyword: { type: Type.STRING },
              },
              required: ["title", "description", "imageKeyword"],
            },
          },
          coverKeyword: { type: Type.STRING }
        },
        required: ["chapters", "coverKeyword"]
      },
    },
  });

  const data = JSON.parse(response.text || "{}");
  const chapters = (data.chapters || []).map((item: any, index: number) => ({
    id: `chapter-${index}`,
    ...item,
  }));
  
  return { chapters, coverKeyword: data.coverKeyword || bookTitle };
}

export async function generateChapterContent(
  bookTitle: string,
  chapterTitle: string,
  chapterDescription: string,
  previousChapters: { title: string; content?: string }[],
  customKey?: string,
  lang: 'en' | 'vi' = 'en'
): Promise<string> {
  const ai = getAI(customKey);
  const context = previousChapters
    .filter((c) => c.content)
    .map((c) => `Chapter: ${c.title}\nSummary: ${c.content?.substring(0, 200)}...`)
    .join("\n\n");

  const prompt = `Write the full content for a chapter in an ebook.
  Book Title: ${bookTitle}
  Chapter Title: ${chapterTitle}
  Chapter Description: ${chapterDescription}
  
  The entire output MUST be in ${lang === 'en' ? 'English' : 'Vietnamese'}.
  
  Context from previous chapters:
  ${context}
  
  Write in a professional, engaging style like a high-quality non-fiction book. 
  Use markdown formatting (headings, lists, bold text). 
  DO NOT include the chapter title in the output.
  Aim for at least 1000-1500 words. Make it detailed, informative, and well-structured.
  
  IMPORTANT: At 2-3 appropriate places in the text where an illustration would be helpful, insert an illustration prompt in exactly this format: [ILLUSTRATION PROMPT: Detailed description of the image to be generated here]. 
  Example: [ILLUSTRATION PROMPT: A realistic digital painting of a futuristic city with solar panels on every roof and flying electric vehicles].`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
  });

  return response.text || "Failed to generate content.";
}

export async function translateText(
  text: string,
  targetLang: 'en' | 'vi',
  customKey?: string
): Promise<string> {
  const ai = getAI(customKey);
  const target = targetLang === 'en' ? 'English' : 'Vietnamese';
  
  const prompt = `Translate the following text into ${target}. 
  Maintain the original Markdown formatting, tone, and technical terms where appropriate.
  If the text contains [ILLUSTRATION PROMPT: ...], translate the description inside the brackets as well.
  
  Text to translate:
  ${text}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text || text;
}
