import { GoogleGenAI, Type } from "@google/genai";
import { Chapter, Ebook } from "../types";

function getAI(customKey?: string) {
  // Use custom key from UI, or environment variable from Vite
  const apiKey = customKey || ((import.meta as any).env.VITE_GEMINI_API_KEY as string) || "";
  
  if (!apiKey) {
    throw new Error("API Key is missing. Please configure it in Settings.");
  }
  
  return new GoogleGenAI({ apiKey });
}

export async function generateOutline(bookTitle: string, chapterCount: number = 5, customKey?: string, lang: 'en' | 'vi' = 'en'): Promise<{ chapters: Chapter[], coverKeyword: string, coverPrompt: string, readme: string }> {
  const ai = getAI(customKey);
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Create a detailed table of contents for an ebook titled "${bookTitle}". 
    The entire output MUST be in ${lang === 'en' ? 'English' : 'Vietnamese'}.
    Return a JSON object with:
    1. 'chapters': an array of exactly ${chapterCount} objects, each with 'title', 'description' (a brief summary), and 'imageKeyword' (a 2-3 word keyword for a stock photo related to this chapter).
    2. 'coverKeyword': a 2-3 word keyword for a professional book cover image.
    3. 'coverPrompt': a detailed, professional AI image generation prompt (in English) for the ebook cover. It should describe the style, mood, and elements.
    4. 'readme': a professional "How to use this ebook" guide (about 200-300 words) explaining how to get the most out of this specific book.`,
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
          coverKeyword: { type: Type.STRING },
          coverPrompt: { type: Type.STRING },
          readme: { type: Type.STRING }
        },
        required: ["chapters", "coverKeyword", "coverPrompt", "readme"]
      },
    },
  });

  const data = JSON.parse(response.text || "{}");
  const chapters = (data.chapters || []).map((item: any, index: number) => ({
    id: `chapter-${index}`,
    ...item,
  }));
  
  return { 
    chapters, 
    coverKeyword: data.coverKeyword || bookTitle, 
    coverPrompt: data.coverPrompt || `A professional book cover for "${bookTitle}"`,
    readme: data.readme || "" 
  };
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
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text || "Failed to generate content.";
}

export async function generateBonusContent(
  bookTitle: string,
  bonusTitle: string,
  customKey?: string,
  lang: 'en' | 'vi' = 'en'
): Promise<string> {
  const ai = getAI(customKey);

  const prompt = `Write a high-quality bonus gift content for an ebook.
  Book Title: ${bookTitle}
  Bonus Gift Title: ${bonusTitle}
  
  The entire output MUST be in ${lang === 'en' ? 'English' : 'Vietnamese'}.
  
  Write in a professional, engaging style. This is a special gift for readers who purchased the ebook.
  Use markdown formatting (headings, lists, bold text). 
  Aim for at least 800-1200 words. Make it valuable, actionable, and well-structured.
  
  IMPORTANT: At 1-2 appropriate places in the text where an illustration would be helpful, insert an illustration prompt in exactly this format: [ILLUSTRATION PROMPT: Detailed description of the image to be generated here].`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text || "Failed to generate bonus content.";
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

export async function generateSalePage(ebook: Ebook, customKey?: string, lang: 'en' | 'vi' = 'en'): Promise<string> {
  const ai = getAI(customKey);
  const prompt = `
    Create a high-converting HTML Sale Page for an ebook titled "${ebook.title}" by "${ebook.author}".
    The ebook has the following chapters: ${ebook.chapters.map(c => c.title).join(', ')}.
    And these bonus gifts: ${ebook.bonusGifts.map(b => b.title).join(', ')}.
    
    The content should be in ${lang === 'vi' ? 'Vietnamese' : 'English'}.
    
    REQUIREMENTS:
    1. Include a "Product Icon" placeholder (125x125px).
    2. Include placeholders for: Hero Image, Problem Image, Solution Image, and Bonus Images.
    3. At the bottom of the page, add a "DESIGN ASSETS & IMAGE PROMPTS" section (styled professionally) that provides specific AI image generation prompts for:
       - Main Product Icon (125x125)
       - Hero Banner (900x400)
       - Illustration for the "Problem" section
       - Illustration for the "Solution" section
    
    TEMPLATE STRUCTURE:
    <!DOCTYPE html>
    <html lang="${lang}">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${ebook.title} - Sale Page</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
      <style>
        :root{ --bg:#020617; --card:#0f172a; --accent:#22c55e; --accent2:#38bdf8; --text:#e2e8f0; --muted:#94a3b8; }
        *{box-sizing:border-box}
        body{ margin:0; font-family:'Inter',sans-serif; background:linear-gradient(180deg,#020617,#0b1220); color:var(--text); }
        .container{ max-width:1000px; margin:auto; padding:20px; }
        .hero{ text-align:center; padding:60px 20px; background:linear-gradient(135deg,#111827,#1e293b); border-radius:16px; box-shadow:0 10px 40px rgba(0,0,0,0.4); }
        h1{ font-size:38px; margin-bottom:10px; color:#fff; }
        h2{ color:var(--accent); margin-bottom:15px; }
        p{ color:var(--muted); line-height:1.6; }
        .btn{ display:inline-block; margin-top:20px; padding:16px 28px; background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#000; font-weight:700; text-decoration:none; border-radius:10px; transition:0.3s; }
        .btn:hover{ transform:translateY(-3px); box-shadow:0 10px 25px rgba(34,197,94,0.3); }
        .card{ background:var(--card); padding:30px; border-radius:16px; margin-top:20px; box-shadow:0 10px 30px rgba(0,0,0,0.4); }
        ul{ padding-left:20px; line-height:1.8; }
        .bonus{ background:rgba(56,189,248,0.08); border-left:4px solid var(--accent2); padding:15px; margin-top:10px; border-radius:10px; }
        .price{ font-size:28px; color:var(--accent); font-weight:bold; }
        img{ max-width:100%; border-radius:12px; margin-top:15px; border: 1px solid #334155; }
        .product-icon{ width:125px; height:125px; border-radius:12px; margin: 20px auto; display:block; background:#1e293b; border:2px dashed #38bdf8; display:flex; align-items:center; justify-content:center; color:#38bdf8; font-size:12px; text-align:center; padding:10px; }
        .footer{ text-align:center; padding:30px; color:var(--muted); }
        .prompt-box{ background:#1e293b; padding:15px; border-radius:8px; font-family:monospace; font-size:12px; color:#38bdf8; margin-top:10px; border: 1px solid #334155; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="hero">
          <div class="product-icon">125x125 Product Icon Placeholder</div>
          <p style="max-width:700px;margin:0 auto 20px auto;font-size:16px;color:#cbd5f5;">[Compelling Hook/Story about the ebook]</p>
          <h1>[Powerful Headline]</h1>
          <p>[Sub-headline]</p>
          <img src="https://via.placeholder.com/900x400?text=HERO+IMAGE+PLACEHOLDER" alt="Hero">
          <a href="#buy" class="btn">Get Instant Access</a>
        </div>
        <div class="card">
          <h2>The Problem</h2>
          <p>[Describe the pain points]</p>
          <img src="https://via.placeholder.com/900x300?text=PROBLEM+ILLUSTRATION+PLACEHOLDER" alt="Problem">
        </div>
        <div class="card">
          <h2>The Solution</h2>
          <p>[How this ebook solves it]</p>
          <img src="https://via.placeholder.com/900x300?text=SOLUTION+ILLUSTRATION+PLACEHOLDER" alt="Solution">
        </div>
        <div class="card">
          <h2>What You'll Learn</h2>
          <ul>[List key benefits]</ul>
        </div>
        <div class="card">
          <h2>Bonuses Included</h2>
          [Generate bonus sections with placeholders for bonus images]
        </div>
        <div class="card" id="buy" style="text-align:center">
          <h2>Get Instant Access Now</h2>
          <p class="price">Today Only: $7</p>
          <a href="#" class="btn">Buy Now</a>
        </div>

        <!-- IMAGE PROMPTS SECTION -->
        <div class="card" style="border: 2px solid #38bdf8;">
          <h2 style="color:#38bdf8">🎨 AI IMAGE GENERATION PROMPTS</h2>
          <p>Use these prompts in Midjourney, DALL-E, or Leonardo.ai to generate your page assets:</p>
          
          <div style="margin-top:20px">
            <strong>1. Product Icon (125x125):</strong>
            <div class="prompt-box">[Generate a specific prompt for a 125x125 app-style icon for this ebook]</div>
          </div>
          
          <div style="margin-top:20px">
            <strong>2. Hero Banner (900x400):</strong>
            <div class="prompt-box">[Generate a specific prompt for a wide cinematic banner for this ebook]</div>
          </div>
          
          <div style="margin-top:20px">
            <strong>3. Problem Illustration:</strong>
            <div class="prompt-box">[Generate a prompt depicting the frustration/problem this book solves]</div>
          </div>
          
          <div style="margin-top:20px">
            <strong>4. Solution Illustration:</strong>
            <div class="prompt-box">[Generate a prompt depicting the success/freedom after using this book]</div>
          </div>
        </div>

      </div>
      <div class="footer">© 2026 ${ebook.title}</div>
    </body>
    </html>

    Return ONLY the full HTML code. No markdown formatting, no explanation.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text || '';
}

export async function generateJvPage(ebook: Ebook, customKey?: string, lang: 'en' | 'vi' = 'en'): Promise<string> {
  const ai = getAI(customKey);
  const prompt = `
    Create a professional HTML JV Page (Joint Venture/Affiliate Page) for an ebook titled "${ebook.title}" by "${ebook.author}".
    This page is strictly for affiliates.
    
    The content should be in ${lang === 'vi' ? 'Vietnamese' : 'English'}.
    
    REQUIREMENTS:
    1. Include a "Product Bundle" image placeholder.
    2. Include an "Earnings Proof" placeholder.
    3. At the bottom, add a "DESIGN ASSETS & IMAGE PROMPTS" section for affiliates or the vendor to use.
    
    TEMPLATE STRUCTURE:
    <!DOCTYPE html>
    <html lang="${lang}">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>JV Page - ${ebook.title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
      <style>
        :root{ --bg:#0b1220; --card:#111827; --accent:#22c55e; --accent2:#38bdf8; --text:#e5e7eb; --muted:#9ca3af; }
        *{box-sizing:border-box}
        body{ margin:0; font-family:'Inter',sans-serif; background:linear-gradient(180deg,#020617,#0b1220); color:var(--text); }
        .container{ max-width:1000px; margin:auto; padding:20px; }
        .card{ background:var(--card); padding:30px; border-radius:16px; margin-top:20px; box-shadow:0 10px 30px rgba(0,0,0,0.4); }
        h1{ font-size:32px; margin-bottom:10px; color:#fff; }
        h2{ font-size:22px; color:var(--accent); margin-bottom:15px; }
        p{ color:var(--muted); line-height:1.6; }
        .hero{ text-align:center; padding:40px 20px; border-radius:16px; background:linear-gradient(135deg,#111827,#1e293b); }
        .btn{ display:inline-block; margin-top:20px; padding:14px 26px; background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#000; font-weight:700; text-decoration:none; border-radius:8px; transition:0.3s; }
        .grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:15px; }
        .highlight{ background:rgba(56,189,248,0.08); border-left:4px solid var(--accent2); padding:15px; border-radius:10px; }
        .email-box{ background:#020617; padding:20px; border-radius:10px; font-family:monospace; white-space:pre-line; color:#cbd5f5; }
        img{ max-width:100%; border-radius:12px; margin-top:15px; border: 1px solid #334155; }
        .prompt-box{ background:#020617; padding:15px; border-radius:8px; font-family:monospace; font-size:12px; color:#38bdf8; margin-top:10px; border: 1px solid #334155; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="hero card">
          <h1>${ebook.title}</h1>
          <p>[Affiliate hook]</p>
          <img src="https://via.placeholder.com/900x400?text=JV+BANNER+PLACEHOLDER" alt="JV Banner">
          <a href="#" class="btn">Get Your Affiliate Link</a>
        </div>
        <div class="card">
          <h2>📌 Offer Details</h2>
          <div class="grid">
            <div class="highlight">Front-End Price: <strong>$7</strong></div>
            <div class="highlight">Commission: <strong>70%</strong></div>
          </div>
        </div>
        <div class="card">
          <h2>💰 Why Promote?</h2>
          <ul>[Reasons]</ul>
        </div>
        <div class="card">
          <h2>🎁 Product Bundle</h2>
          <img src="https://via.placeholder.com/600x400?text=PRODUCT+BUNDLE+MOCKUP" alt="Bundle">
        </div>
        <div class="card">
          <h2>📧 Email Swipe</h2>
          <div class="email-box">[Swipe]</div>
        </div>

        <!-- IMAGE PROMPTS SECTION -->
        <div class="card" style="border: 2px solid #22c55e;">
          <h2 style="color:#22c55e">🎨 JV DESIGN ASSETS PROMPTS</h2>
          <p>Create these assets to make your JV page look professional:</p>
          
          <div style="margin-top:20px">
            <strong>1. JV Hero Banner (900x400):</strong>
            <div class="prompt-box">[Generate a prompt for a high-energy affiliate banner]</div>
          </div>
          
          <div style="margin-top:20px">
            <strong>2. Product Bundle Mockup:</strong>
            <div class="prompt-box">[Generate a prompt for a 3D bundle of a book and several bonus boxes]</div>
          </div>
        </div>

      </div>
      <div class="footer">© 2026 JV Page</div>
    </body>
    </html>

    Return ONLY the full HTML code. No markdown formatting, no explanation.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text || '';
}

export async function generateOtoPage(
  mainBook: Ebook, 
  upsellTitle: string, 
  upsellChapters: Chapter[], 
  customKey?: string, 
  lang: 'en' | 'vi' = 'en'
): Promise<string> {
  const ai = getAI(customKey);
  const prompt = `
    Create a high-converting HTML OTO (One-Time Offer) Upsell Page.
    The user just bought: "${mainBook.title}".
    The upgrade is: "${upsellTitle}".
    The upgrade includes these advanced chapters: ${upsellChapters.map(c => c.title).join(', ')}.
    
    The content should be in ${lang === 'vi' ? 'Vietnamese' : 'English'}.
    
    REQUIREMENTS:
    1. Use a professional, high-energy "Wait! Upgrade Your Results" tone.
    2. Include a 15-minute countdown timer (using the provided script logic).
    3. Highlight the "Advanced System" benefits.
    4. Include a clear "Yes, Upgrade" button and a "No thanks" downsell link.
    5. Use the provided CSS style for a dark, premium look.
    
    TEMPLATE STRUCTURE:
    <!DOCTYPE html>
    <html lang="${lang}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>OTO Upgrade - ${upsellTitle}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
      <style>
        body{font-family:'Inter',sans-serif;margin:0;background:#020617;color:#e2e8f0}
        .container{max-width:900px;margin:auto;padding:20px}
        .card{background:#0f172a;padding:30px;border-radius:16px;margin-top:20px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.4)}
        h1{font-size:34px;color:#fff;margin-bottom:10px}
        h2{color:#22c55e;margin-bottom:10px}
        p{color:#94a3b8}
        .btn{display:inline-block;margin-top:20px;padding:18px 30px;background:linear-gradient(135deg,#22c55e,#4ade80);color:#000;font-weight:800;text-decoration:none;border-radius:10px;font-size:18px}
        .btn:hover{transform:translateY(-2px)}
        .downsell{display:block;margin-top:20px;color:#f87171;text-decoration:none;font-size:14px}
        .highlight{background:rgba(34,197,94,0.1);padding:20px;border-radius:12px;margin-top:20px;text-align:left}
        .badge{display:inline-block;background:#ef4444;color:#fff;padding:6px 12px;border-radius:999px;font-size:12px;margin-bottom:10px}
        .price-box{margin-top:20px;padding:20px;border-radius:12px;background:linear-gradient(135deg,#22c55e,#4ade80);color:#022c22}
        .timer{font-size:26px;font-weight:bold;color:#ef4444;margin-top:10px}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="badge">ONE-TIME OFFER</div>
          <h1>[Wait! Upgrade Your Results Instantly 🚀]</h1>
          <p>[This exclusive upgrade will NOT be shown again]</p>
          <div class="timer" id="timer">15:00</div>
        </div>
        <div class="card">
          <h2>🔥 [Unlock The Advanced System: ${upsellTitle}]</h2>
          <p>[Skip the trial & error and get faster results with this upgrade]</p>
          <div class="highlight">
            [List 5-6 advanced benefits/features of the upsell book]
          </div>
        </div>
        <div class="card">
          <h2>💰 [Special Upgrade Price]</h2>
          <p style="text-decoration:line-through;font-size:24px">$97</p>
          <div class="price-box">
            <div style="font-size:14px">[Today Only]</div>
            <div style="font-size:42px;font-weight:bold">$17</div>
            <div style="font-size:14px">[One-Time Payment]</div>
          </div>
          <p style="color:#f87171;margin-top:10px">[⚠️ This offer expires when you leave this page]</p>
          <a href="#" class="btn">👉 [YES – Upgrade My Order Now]</a>
          <a href="#" class="downsell">[No thanks, I’ll stick with basic version]</a>
        </div>
      </div>
      <script>
        let totalSeconds = 900;
        const timer = document.getElementById('timer');
        setInterval(()=>{
          let m = Math.floor(totalSeconds/60);
          let s = totalSeconds%60;
          timer.innerHTML = String(m).padStart(2,'0')+":"+String(s).padStart(2,'0');
          if(totalSeconds>0) totalSeconds--;
        },1000);
      </script>
    </body>
    </html>
    
    Return ONLY the full HTML code. No markdown formatting, no explanation.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text || '';
}
