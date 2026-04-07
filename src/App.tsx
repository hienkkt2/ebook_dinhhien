import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Book, 
  Plus, 
  Loader2, 
  ChevronRight, 
  BookOpen, 
  Download, 
  Edit3, 
  CheckCircle2,
  Sparkles,
  HelpCircle,
  FileText,
  ChevronDown,
  X,
  FileCode,
  File,
  Settings,
  Key,
  History,
  Trash2,
  Clock,
  ArrowLeft,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import { Chapter, Ebook, BonusGift } from './types';
import { 
  generateOutline, 
  generateChapterContent, 
  generateBonusContent, 
  translateText,
  generateSalePage,
  generateJvPage,
  generateOtoPage
} from './lib/gemini';
import { translations, Language } from './lib/translations';

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [titleInput, setTitleInput] = useState('');
  const [upsellTitleInput, setUpsellTitleInput] = useState('');
  const [chapterCount, setChapterCount] = useState(5);
  const [upsellChapterCount, setUpsellChapterCount] = useState(7);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [ebook, setEbook] = useState<Ebook | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedUpsellChapterId, setSelectedUpsellChapterId] = useState<string | null>(null);
  const [isGeneratingChapter, setIsGeneratingChapter] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [bonusTitles, setBonusTitles] = useState(['', '', '']);
  const [readmeInput, setReadmeInput] = useState('');
  const [selectedBonusId, setSelectedBonusId] = useState<string | null>(null);
  const [isGeneratingBonus, setIsGeneratingBonus] = useState(false);
  const [showReadme, setShowReadme] = useState(false);
  const [showSalePage, setShowSalePage] = useState(false);
  const [showJvPage, setShowJvPage] = useState(false);
  const [showDesignAssets, setShowDesignAssets] = useState(false);
  const [showOtoPage, setShowOtoPage] = useState(false);
  const [showUpsellBook, setShowUpsellBook] = useState(false);
  const [isGeneratingSalePage, setIsGeneratingSalePage] = useState(false);
  const [isGeneratingJvPage, setIsGeneratingJvPage] = useState(false);
  const [isGeneratingOtoPage, setIsGeneratingOtoPage] = useState(false);
  const [isGeneratingUpsell, setIsGeneratingUpsell] = useState(false);
  const [savedBooks, setSavedBooks] = useState<Ebook[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [quotaError, setQuotaError] = useState(false);

  const t = translations[lang];

  // Load API key and saved books from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);

    const books = localStorage.getItem('saved_ebooks');
    if (books) {
      try {
        setSavedBooks(JSON.parse(books));
      } catch (e) {
        console.error('Failed to parse saved books', e);
      }
    }
  }, []);

  // Auto-save current ebook to history
  useEffect(() => {
    if (ebook) {
      const updatedBooks = [...savedBooks];
      const index = updatedBooks.findIndex(b => b.id === ebook.id);
      
      const ebookWithTimestamp = { ...ebook, updatedAt: Date.now() };
      
      if (index >= 0) {
        updatedBooks[index] = ebookWithTimestamp;
      } else {
        updatedBooks.unshift(ebookWithTimestamp);
      }
      
      setSavedBooks(updatedBooks);
      localStorage.setItem('saved_ebooks', JSON.stringify(updatedBooks));
    }
  }, [ebook]);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    setShowSettings(false);
  };

  const resetViews = () => {
    setSelectedChapterId(null);
    setSelectedUpsellChapterId(null);
    setSelectedBonusId(null);
    setShowReadme(false);
    setShowSalePage(false);
    setShowJvPage(false);
    setShowOtoPage(false);
    setShowUpsellBook(false);
    setShowDesignAssets(false);
  };

  const handleGenerateOutline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleInput.trim()) return;

    setIsGeneratingOutline(true);
    try {
      const { chapters, coverKeyword, coverPrompt, readme } = await generateOutline(titleInput, chapterCount, apiKey, lang);
      
      const bonusGifts: BonusGift[] = bonusTitles
        .filter(title => title.trim() !== '')
        .map((title, index) => ({
          id: `bonus-${index}`,
          title: title.trim(),
        }));

      const newEbook: Ebook = {
        id: Date.now().toString(),
        title: titleInput,
        author: t.authorName,
        chapters,
        bonusGifts,
        readme,
        coverImageKeyword: coverKeyword,
        coverImagePrompt: coverPrompt,
        updatedAt: Date.now()
      };

      setEbook(newEbook);
      setReadmeInput(readme);
    } catch (error: any) {
      console.error('Error generating outline:', error);
      if (error?.message?.includes('429') || error?.message?.toLowerCase().includes('quota')) {
        setQuotaError(true);
      } else {
        const errorMessage = error?.message || 'Error generating outline. Please check your API Key.';
        alert(errorMessage);
      }
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleGenerateChapter = async (chapterId: string) => {
    if (!ebook || isTranslating) return;
    setShowReadme(false);
    setShowSalePage(false);
    setShowJvPage(false);
    setShowDesignAssets(false);
    setSelectedBonusId(null);
    
    const chapterIndex = ebook.chapters.findIndex(c => c.id === chapterId);
    const chapter = ebook.chapters[chapterIndex];
    
    if (!chapter || chapter.content || chapter.isGenerating) return;

    setIsGeneratingChapter(true);
    setEbook(prev => {
      if (!prev) return null;
      const newChapters = [...prev.chapters];
      newChapters[chapterIndex] = { ...newChapters[chapterIndex], isGenerating: true };
      return { ...prev, chapters: newChapters };
    });

    try {
      const previousChapters = ebook.chapters.slice(0, chapterIndex);
      const content = await generateChapterContent(
        ebook.title,
        chapter.title,
        chapter.description,
        previousChapters,
        apiKey,
        lang
      );

      setEbook(prev => {
        if (!prev) return null;
        const newChapters = [...prev.chapters];
        newChapters[chapterIndex] = { 
          ...newChapters[chapterIndex], 
          content, 
          isGenerating: false 
        };
        return { ...prev, chapters: newChapters };
      });
      setSelectedChapterId(chapterId);
    } catch (error: any) {
      console.error('Error generating chapter:', error);
      setEbook(prev => {
        if (!prev) return null;
        const newChapters = [...prev.chapters];
        newChapters[chapterIndex] = { ...newChapters[chapterIndex], isGenerating: false };
        return { ...prev, chapters: newChapters };
      });
      
      if (error?.message?.includes('429') || error?.message?.toLowerCase().includes('quota')) {
        setQuotaError(true);
      } else {
        const errorMessage = error?.message || 'Error generating chapter content.';
        alert(errorMessage);
      }
    } finally {
      setIsGeneratingChapter(false);
    }
  };

  const downloadReadme = () => {
    if (!ebook || !ebook.readme) return;
    downloadBlob(ebook.readme, 'text/plain', 'README.txt');
  };

  const handleGenerateSalePage = async () => {
    if (!ebook || isGeneratingSalePage) return;
    setIsGeneratingSalePage(true);
    try {
      const html = await generateSalePage(ebook, apiKey, lang);
      setEbook({ ...ebook, salePageHtml: html });
      resetViews();
      setShowSalePage(true);
    } catch (error: any) {
      console.error('Error generating sale page:', error);
      if (error?.message?.includes('429') || error?.message?.toLowerCase().includes('quota')) {
        setQuotaError(true);
      } else {
        alert(error?.message || 'Failed to generate sale page');
      }
    } finally {
      setIsGeneratingSalePage(false);
    }
  };

  const handleGenerateJvPage = async () => {
    if (!ebook || isGeneratingJvPage) return;
    setIsGeneratingJvPage(true);
    try {
      const html = await generateJvPage(ebook, apiKey, lang);
      setEbook({ ...ebook, jvPageHtml: html });
      resetViews();
      setShowJvPage(true);
    } catch (error: any) {
      console.error('Error generating JV page:', error);
      if (error?.message?.includes('429') || error?.message?.toLowerCase().includes('quota')) {
        setQuotaError(true);
      } else {
        alert(error?.message || 'Failed to generate JV page');
      }
    } finally {
      setIsGeneratingJvPage(false);
    }
  };

  const downloadHtml = (content: string, filename: string) => {
    downloadBlob(content, 'text/html', filename);
  };

  const handleGenerateUpsell = async () => {
    if (!ebook || !upsellTitleInput.trim() || isGeneratingUpsell) return;
    setIsGeneratingUpsell(true);
    try {
      const { chapters, coverPrompt } = await generateOutline(upsellTitleInput, upsellChapterCount, apiKey, lang);
      setEbook({
        ...ebook,
        upsellBook: {
          title: upsellTitleInput,
          chapters,
          coverImagePrompt: coverPrompt
        }
      });
      resetViews();
      setShowUpsellBook(true);
    } catch (error: any) {
      console.error('Error generating upsell:', error);
      if (error?.message?.includes('429') || error?.message?.toLowerCase().includes('quota')) {
        setQuotaError(true);
      } else {
        alert(error?.message || 'Failed to generate upsell book');
      }
    } finally {
      setIsGeneratingUpsell(false);
    }
  };

  const handleGenerateOtoPage = async () => {
    if (!ebook || !ebook.upsellBook || isGeneratingOtoPage) return;
    setIsGeneratingOtoPage(true);
    try {
      const html = await generateOtoPage(
        ebook, 
        ebook.upsellBook.title, 
        ebook.upsellBook.chapters, 
        apiKey, 
        lang
      );
      setEbook({ ...ebook, otoPageHtml: html });
      resetViews();
      setShowOtoPage(true);
    } catch (error: any) {
      console.error('Error generating OTO page:', error);
      if (error?.message?.includes('429') || error?.message?.toLowerCase().includes('quota')) {
        setQuotaError(true);
      } else {
        alert(error?.message || 'Failed to generate OTO page');
      }
    } finally {
      setIsGeneratingOtoPage(false);
    }
  };

  const handleGenerateUpsellChapter = async (chapterId: string) => {
    if (!ebook || !ebook.upsellBook || isTranslating) return;
    
    const chapterIndex = ebook.upsellBook.chapters.findIndex(c => c.id === chapterId);
    const chapter = ebook.upsellBook.chapters[chapterIndex];
    
    if (!chapter || chapter.content || chapter.isGenerating) return;

    setEbook(prev => {
      if (!prev || !prev.upsellBook) return prev;
      const newChapters = [...prev.upsellBook.chapters];
      newChapters[chapterIndex] = { ...newChapters[chapterIndex], isGenerating: true };
      return { 
        ...prev, 
        upsellBook: { ...prev.upsellBook, chapters: newChapters } 
      };
    });

    try {
      const previousChapters = ebook.upsellBook.chapters.slice(0, chapterIndex);
      const content = await generateChapterContent(
        ebook.upsellBook.title,
        chapter.title,
        chapter.description,
        previousChapters,
        apiKey,
        lang
      );

      setEbook(prev => {
        if (!prev || !prev.upsellBook) return prev;
        const newChapters = [...prev.upsellBook.chapters];
        newChapters[chapterIndex] = { 
          ...newChapters[chapterIndex], 
          content, 
          isGenerating: false 
        };
        return { 
          ...prev, 
          upsellBook: { ...prev.upsellBook, chapters: newChapters } 
        };
      });
      resetViews();
      setSelectedUpsellChapterId(chapterId);
    } catch (error: any) {
      console.error('Error generating upsell chapter:', error);
      setEbook(prev => {
        if (!prev || !prev.upsellBook) return prev;
        const newChapters = [...prev.upsellBook.chapters];
        newChapters[chapterIndex] = { ...newChapters[chapterIndex], isGenerating: false };
        return { 
          ...prev, 
          upsellBook: { ...prev.upsellBook, chapters: newChapters } 
        };
      });
      
      if (error?.message?.includes('429') || error?.message?.toLowerCase().includes('quota')) {
        setQuotaError(true);
      } else {
        alert(error?.message || 'Error generating chapter content.');
      }
    }
  };

  const loadBook = (book: Ebook) => {
    setEbook(book);
    setTitleInput(book.title);
    setUpsellTitleInput(book.upsellBook?.title || '');
    setUpsellChapterCount(book.upsellBook?.chapters.length || 7);
    setReadmeInput(book.readme);
    setShowHistory(false);
    setSelectedChapterId(null);
    setSelectedUpsellChapterId(null);
    setSelectedBonusId(null);
    setShowReadme(false);
    setShowSalePage(false);
    setShowJvPage(false);
    setShowOtoPage(false);
    setShowUpsellBook(false);
    setShowDesignAssets(false);
  };

  const deleteBook = (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    const updatedBooks = savedBooks.filter(b => b.id !== bookId);
    setSavedBooks(updatedBooks);
    localStorage.setItem('saved_ebooks', JSON.stringify(updatedBooks));
    if (ebook?.id === bookId) {
      setEbook(null);
    }
  };

  const startNewBook = () => {
    setEbook(null);
    setTitleInput('');
    setUpsellTitleInput('');
    setUpsellChapterCount(7);
    setBonusTitles(['', '', '']);
    setReadmeInput('');
    setSelectedChapterId(null);
    setSelectedUpsellChapterId(null);
    setSelectedBonusId(null);
    setShowReadme(false);
    setShowSalePage(false);
    setShowJvPage(false);
    setShowOtoPage(false);
    setShowUpsellBook(false);
    setShowDesignAssets(false);
  };

  const selectedChapter = ebook?.chapters.find(c => c.id === selectedChapterId);
  const selectedUpsellChapter = ebook?.upsellBook?.chapters.find(c => c.id === selectedUpsellChapterId);
  const selectedBonus = ebook?.bonusGifts.find(b => b.id === selectedBonusId);

  const cleanMarkdown = (text: string) => {
    return text
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/\*\*/g, '')     // Remove bold
      .replace(/\*/g, '')      // Remove italic
      .replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Remove links
  };

  const formatContentWithImages = (text: string, isHtml: boolean = false) => {
    if (isHtml) {
      return text.replace(/\[ILLUSTRATION PROMPT:\s*(.*?)\]/g, (match, prompt) => {
        return `<div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
          <p style="color: #4f46e5; font-weight: bold; margin-bottom: 8px; font-size: 11pt;">[ ILLUSTRATION PROMPT ]</p>
          <p style="font-style: italic; color: #475569; font-size: 10pt;">${prompt}</p>
        </div>`;
      });
    }
    return text;
  };

  const handleGenerateBonus = async (bonusId: string) => {
    if (!ebook || isTranslating) return;
    setShowReadme(false);
    setShowSalePage(false);
    setShowJvPage(false);
    setShowDesignAssets(false);
    setSelectedChapterId(null);

    const bonusIndex = ebook.bonusGifts.findIndex(b => b.id === bonusId);
    const bonus = ebook.bonusGifts[bonusIndex];

    if (!bonus || bonus.content || bonus.isGenerating) return;

    setIsGeneratingBonus(true);
    setEbook(prev => {
      if (!prev) return null;
      const newBonus = [...prev.bonusGifts];
      newBonus[bonusIndex] = { ...newBonus[bonusIndex], isGenerating: true };
      return { ...prev, bonusGifts: newBonus };
    });

    try {
      const content = await generateBonusContent(
        ebook.title,
        bonus.title,
        apiKey,
        lang
      );

      setEbook(prev => {
        if (!prev) return null;
        const newBonus = [...prev.bonusGifts];
        newBonus[bonusIndex] = { 
          ...newBonus[bonusIndex], 
          content, 
          isGenerating: false 
        };
        return { ...prev, bonusGifts: newBonus };
      });
      resetViews();
      setSelectedBonusId(bonusId);
    } catch (error: any) {
      console.error('Error generating bonus:', error);
      setEbook(prev => {
        if (!prev) return null;
        const newBonus = [...prev.bonusGifts];
        newBonus[bonusIndex] = { ...newBonus[bonusIndex], isGenerating: false };
        return { ...prev, bonusGifts: newBonus };
      });
      
      if (error?.message?.includes('429') || error?.message?.toLowerCase().includes('quota')) {
        setQuotaError(true);
      } else {
        alert(error?.message || 'Error generating bonus content.');
      }
    } finally {
      setIsGeneratingBonus(false);
    }
  };

  const handleLanguageChange = async (newLang: Language) => {
    if (newLang === lang || isTranslating) return;
    
    setLang(newLang);
    
    if (!ebook) return;

    setIsTranslating(true);
    try {
      // 1. Translate metadata
      const translatedTitle = await translateText(ebook.title, newLang, apiKey);
      
      // 2. Translate chapters
      const translatedChapters = await Promise.all(ebook.chapters.map(async (chapter) => {
        const title = await translateText(chapter.title, newLang, apiKey);
        const description = await translateText(chapter.description, newLang, apiKey);
        let content = chapter.content;
        
        if (content) {
          content = await translateText(content, newLang, apiKey);
        }
        
        return { ...chapter, title, description, content };
      }));

      // 3. Translate bonus gifts
      const translatedBonus = await Promise.all(ebook.bonusGifts.map(async (bonus) => {
        const title = await translateText(bonus.title, newLang, apiKey);
        let content = bonus.content;
        if (content) {
          content = await translateText(content, newLang, apiKey);
        }
        return { ...bonus, title, content };
      }));

      // 4. Translate readme
      const translatedReadme = await translateText(ebook.readme, newLang, apiKey);

      // 5. Translate marketing pages
      let translatedSale = ebook.salePageHtml;
      if (translatedSale) {
        translatedSale = await translateText(translatedSale, newLang, apiKey);
      }

      let translatedJv = ebook.jvPageHtml;
      if (translatedJv) {
        translatedJv = await translateText(translatedJv, newLang, apiKey);
      }

      // 6. Translate cover prompt
      let translatedCoverPrompt = ebook.coverImagePrompt;
      if (translatedCoverPrompt) {
        translatedCoverPrompt = await translateText(translatedCoverPrompt, newLang, apiKey);
      }

      setEbook({
        ...ebook,
        title: translatedTitle,
        chapters: translatedChapters,
        bonusGifts: translatedBonus,
        readme: translatedReadme,
        salePageHtml: translatedSale,
        jvPageHtml: translatedJv,
        coverImagePrompt: translatedCoverPrompt
      });
      
      setTitleInput(translatedTitle);
      setReadmeInput(translatedReadme);
    } catch (error) {
      console.error('Error translating ebook:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const exportFile = async (format: 'md' | 'txt' | 'doc' | 'pdf') => {
    if (!ebook) return;
    
    if (format === 'md') {
      let content = `# ${ebook.title}\n\n${t.authorLabel}: ${ebook.author}\n\n---\n\n`;
      
      content += `## ${t.toc}\n\n`;
      ebook.chapters.forEach((c, i) => {
        content += `${i + 1}. ${c.title}\n`;
      });
      if (ebook.bonusGifts.length > 0) {
        content += `\n### ${t.bonusGifts}\n\n`;
        ebook.bonusGifts.forEach((b, i) => {
          content += `${i + 1}. ${b.title}\n`;
        });
      }
      content += `\n---\n\n`;

      ebook.chapters.forEach(c => {
        content += `## ${c.title}\n\n${c.content || `*${t.chapterNotGenerated}*`}\n\n---\n\n`;
      });

      if (ebook.bonusGifts.length > 0) {
        content += `# ${t.bonusGifts}\n\n`;
        ebook.bonusGifts.forEach(b => {
          content += `## ${b.title}\n\n${b.content || `*${t.chapterNotGenerated}*`}\n\n---\n\n`;
        });
      }

      if (ebook.readme) {
        content += `# ${t.readme}\n\n${ebook.readme}\n`;
      }

      downloadBlob(content, 'text/markdown', `${ebook.title.replace(/\s+/g, '_')}.md`);
    } else if (format === 'txt') {
      let content = `${ebook.title.toUpperCase()}\n${t.authorLabel}: ${ebook.author}\n\n`;
      
      content += `${t.toc.toUpperCase()}\n\n`;
      ebook.chapters.forEach((c, i) => {
        content += `${i + 1}. ${c.title}\n`;
      });
      if (ebook.bonusGifts.length > 0) {
        content += `\n${t.bonusGifts.toUpperCase()}\n\n`;
        ebook.bonusGifts.forEach((b, i) => {
          content += `${i + 1}. ${b.title}\n`;
        });
      }
      content += `\n${'='.repeat(20)}\n\n`;

      ebook.chapters.forEach(c => {
        content += `${c.title.toUpperCase()}\n\n${c.content || t.chapterNotGenerated}\n\n${'='.repeat(20)}\n\n`;
      });

      if (ebook.bonusGifts.length > 0) {
        content += `${t.bonusGifts.toUpperCase()}\n\n`;
        ebook.bonusGifts.forEach(b => {
          content += `${b.title.toUpperCase()}\n\n${b.content || t.chapterNotGenerated}\n\n${'='.repeat(20)}\n\n`;
        });
      }

      if (ebook.readme) {
        content += `${t.readme.toUpperCase()}\n\n${ebook.readme}\n`;
      }

      downloadBlob(content, 'text/plain', `${ebook.title.replace(/\s+/g, '_')}.txt`);
    } else if (format === 'doc') {
      let html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>${ebook.title}</title>
        <style>
          body { font-family: 'Times New Roman', serif; line-height: 1.6; padding: 50px; }
          h1 { text-align: center; color: #1a202c; font-size: 32pt; margin-bottom: 20pt; }
          h2 { color: #2d3748; font-size: 24pt; margin-top: 40pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 10pt; }
          p { margin-bottom: 12pt; text-align: justify; }
          .chapter { page-break-before: always; }
          .toc { margin-bottom: 50px; page-break-after: always; }
          .toc h2 { text-align: center; border: none; font-size: 28pt; }
          .toc-item { margin-bottom: 12px; font-size: 14pt; border-bottom: 1px dotted #ccc; padding-bottom: 4px; }
          .toc-item span { float: right; }
          .cover { text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
          .prompt-box { background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center; }
        </style>
        </head>
        <body>
          <div class='cover'>
            <h1 style='font-size: 48pt; margin-top: 100pt;'>${ebook.title}</h1>
            <p style='text-align: center; font-size: 22pt; margin-top: 40pt;'>${t.authorLabel}: ${ebook.author}</p>
          </div>
          
          <div class='toc'>
            <h2>${t.toc}</h2>
            <div style='margin-top: 30pt;'>
              ${ebook.chapters.map((c, i) => `
                <div class='toc-item'>
                  ${t.chapter} ${i+1}: ${c.title}
                </div>
              `).join('')}
              ${ebook.bonusGifts.length > 0 ? `
                <h3 style='margin-top: 20pt;'>${t.bonusGifts}</h3>
                ${ebook.bonusGifts.map((b, i) => `
                  <div class='toc-item'>
                    ${b.title}
                  </div>
                `).join('')}
              ` : ''}
            </div>
          </div>
          
          ${ebook.chapters.map((c, i) => `
            <div class='chapter'>
              <p style='color: #4f46e5; font-weight: bold; font-size: 14pt;'>${t.chapter.toUpperCase()} ${i+1}</p>
              <h2 style='margin-top: 0;'>${c.title}</h2>
              <p style='font-style: italic; color: #4a5568; margin-bottom: 30pt;'>${c.description}</p>
              <div>${formatContentWithImages(c.content || t.chapterNotGenerated, true).replace(/\n/g, '<br>')}</div>
            </div>
          `).join('')}

          ${ebook.bonusGifts.length > 0 ? `
            <div class='chapter'>
              <h1 style='text-align: center; margin-top: 50pt;'>${t.bonusGifts}</h1>
            </div>
            ${ebook.bonusGifts.map((b) => `
              <div class='chapter'>
                <h2>${b.title}</h2>
                <div>${formatContentWithImages(b.content || t.chapterNotGenerated, true).replace(/\n/g, '<br>')}</div>
              </div>
            `).join('')}
          ` : ''}

          ${ebook.readme ? `
            <div class='chapter'>
              <h2>${t.readme}</h2>
              <div style='white-space: pre-wrap;'>${ebook.readme}</div>
            </div>
          ` : ''}
        </body>
        </html>
      `;
      downloadBlob(html, 'application/msword', `${ebook.title.replace(/\s+/g, '_')}.doc`);
    } else if (format === 'pdf') {
      const doc = new jsPDF();
      const margin = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      const addPageNumber = () => {
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(10);
          doc.setTextColor(150);
          doc.text(`${t.page} ${i} / ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }
      };

      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(32);
      const titleLines = doc.splitTextToSize(ebook.title.toUpperCase(), pageWidth - 40);
      doc.text(titleLines, pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });
      doc.setFontSize(18);
      doc.text(`${t.authorLabel}: ${ebook.author}`, pageWidth / 2, pageHeight / 2 + 40, { align: 'center' });
      
      doc.addPage();
      const tocPageNumber = doc.getNumberOfPages();
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(24);
      doc.text(t.toc.toUpperCase(), pageWidth / 2, 30, { align: 'center' });
      doc.setFontSize(14);
      
      const chapterPages: number[] = [];

      for (let i = 0; i < ebook.chapters.length; i++) {
        const c = ebook.chapters[i];
        doc.addPage();
        chapterPages.push(doc.getNumberOfPages());
        
        doc.setFillColor(79, 70, 229);
        doc.rect(0, 0, pageWidth, 60, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.text(`${t.chapter.toUpperCase()} ${i + 1}`, margin, 30);
        doc.setFontSize(24);
        doc.text(c.title.toUpperCase(), margin, 45);
        
        doc.setTextColor(0, 0, 0);
        let y = 80;
        doc.setFontSize(12);
        doc.setFont("times", "italic");
        const descLines = doc.splitTextToSize(c.description, pageWidth - 40);
        doc.text(descLines, margin, y);
        y += (descLines.length * 7) + 10;
        
        doc.setFont("times", "normal");
        const contentWithPrompts = (c.content || t.chapterNotGenerated)
          .replace(/\[ILLUSTRATION PROMPT:\s*(.*?)\]/g, (match, p) => `\n\n[ ${t.illustrationPrompt.toUpperCase()}: ${p} ]\n\n`);
          
        const contentLines = doc.splitTextToSize(cleanMarkdown(contentWithPrompts), pageWidth - 40);
        contentLines.forEach((line: string) => {
          if (y > pageHeight - 25) {
            doc.addPage();
            y = 25;
          }
          if (line.includes(`[ ${t.illustrationPrompt.toUpperCase()}:`)) {
            doc.setFont("times", "bolditalic");
            doc.setTextColor(79, 70, 229);
          } else {
            doc.setFont("times", "normal");
            doc.setTextColor(0, 0, 0);
          }
          doc.text(line, margin, y);
          y += 7;
        });
      }

      const bonusPages: number[] = [];
      if (ebook.bonusGifts.length > 0) {
        doc.addPage();
        doc.setFillColor(79, 70, 229);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(40);
        doc.text(t.bonusGifts.toUpperCase(), pageWidth / 2, pageHeight / 2, { align: 'center' });

        for (let i = 0; i < ebook.bonusGifts.length; i++) {
          const b = ebook.bonusGifts[i];
          doc.addPage();
          bonusPages.push(doc.getNumberOfPages());
          
          doc.setFillColor(79, 70, 229);
          doc.rect(0, 0, pageWidth, 60, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(20);
          doc.text(t.bonusGifts.toUpperCase(), margin, 30);
          doc.setFontSize(24);
          doc.text(b.title.toUpperCase(), margin, 45);
          
          doc.setTextColor(0, 0, 0);
          let y = 80;
          doc.setFont("times", "normal");
          const contentWithPrompts = (b.content || t.chapterNotGenerated)
            .replace(/\[ILLUSTRATION PROMPT:\s*(.*?)\]/g, (match, p) => `\n\n[ ${t.illustrationPrompt.toUpperCase()}: ${p} ]\n\n`);
            
          const contentLines = doc.splitTextToSize(cleanMarkdown(contentWithPrompts), pageWidth - 40);
          contentLines.forEach((line: string) => {
            if (y > pageHeight - 25) {
              doc.addPage();
              y = 25;
            }
            if (line.includes(`[ ${t.illustrationPrompt.toUpperCase()}:`)) {
              doc.setFont("times", "bolditalic");
              doc.setTextColor(79, 70, 229);
            } else {
              doc.setFont("times", "normal");
              doc.setTextColor(0, 0, 0);
            }
            doc.text(line, margin, y);
            y += 7;
          });
        }
      }

      let readmePage: number | null = null;
      if (ebook.readme) {
        doc.addPage();
        readmePage = doc.getNumberOfPages();
        doc.setFillColor(79, 70, 229);
        doc.rect(0, 0, pageWidth, 60, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.text(t.readme.toUpperCase(), margin, 35);
        
        doc.setTextColor(0, 0, 0);
        doc.setFont("courier", "normal");
        doc.setFontSize(10);
        const readmeLines = doc.splitTextToSize(ebook.readme, pageWidth - 40);
        let y = 80;
        readmeLines.forEach((line: string) => {
          if (y > pageHeight - 25) {
            doc.addPage();
            y = 25;
          }
          doc.text(line, margin, y);
          y += 5;
        });
      }

      // Go back to TOC page to add items with page numbers
      doc.setPage(tocPageNumber);
      let tocY = 50;
      ebook.chapters.forEach((c, i) => {
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`${t.chapter} ${i + 1}: ${c.title}`, margin, tocY);
        doc.text(`${chapterPages[i]}`, pageWidth - margin, tocY, { align: 'right' });
        doc.setDrawColor(200);
        doc.line(margin + doc.getTextWidth(`${t.chapter} ${i + 1}: ${c.title}`) + 2, tocY, pageWidth - margin - 10, tocY);
        tocY += 12;
      });

      if (ebook.bonusGifts.length > 0) {
        tocY += 5;
        doc.setFontSize(14);
        doc.setFont("times", "bold");
        doc.text(t.bonusGifts, margin, tocY);
        tocY += 10;
        doc.setFont("times", "normal");
        ebook.bonusGifts.forEach((b, i) => {
          doc.setFontSize(12);
          doc.text(b.title, margin, tocY);
          doc.text(`${bonusPages[i]}`, pageWidth - margin, tocY, { align: 'right' });
          doc.line(margin + doc.getTextWidth(b.title) + 2, tocY, pageWidth - margin - 10, tocY);
          tocY += 10;
        });
      }

      if (readmePage) {
        tocY += 5;
        doc.setFontSize(12);
        doc.text(t.readme, margin, tocY);
        doc.text(`${readmePage}`, pageWidth - margin, tocY, { align: 'right' });
        doc.line(margin + doc.getTextWidth(t.readme) + 2, tocY, pageWidth - margin - 10, tocY);
      }

      addPageNumber();
      doc.save(`${ebook.title.replace(/\s+/g, '_')}.pdf`);
    }
    
    setShowExportMenu(false);
  };

  const downloadBlob = (content: string, type: string, filename: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const MarkdownRenderer = ({ content }: { content: string }) => {
    const parts = content.split(/(\[ILLUSTRATION PROMPT:.*?\])/g);
    
    return (
      <div className="markdown-content font-serif text-lg leading-relaxed">
        {parts.map((part, index) => {
          const promptMatch = part.match(/\[ILLUSTRATION PROMPT:\s*(.*?)\]/);
          if (promptMatch) {
            const prompt = promptMatch[1];
            return (
              <div key={index} className="my-10 p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-center">
                <div className="inline-flex items-center gap-2 text-indigo-600 font-bold text-sm mb-3 uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  {t.illustrationPrompt}
                </div>
                <p className="text-slate-600 italic leading-relaxed">"{prompt}"</p>
                <div className="mt-4 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                  {t.illustrationNote}
                </div>
              </div>
            );
          }
          return <ReactMarkdown key={index}>{part}</ReactMarkdown>;
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Book className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">{t.authorName} <span className="text-slate-400 font-normal mx-1">|</span> {t.title}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-xl transition-all ${showHistory ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-500'}`}
              title={t.history}
            >
              <History className="w-5 h-5" />
            </button>
            <div className="flex items-center bg-slate-100 rounded-lg p-1 relative">
              {isTranslating && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t.translating}
                </div>
              )}
              <button 
                onClick={() => handleLanguageChange('en')}
                disabled={isTranslating}
                className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${lang === 'en' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${isTranslating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                EN
              </button>
              <button 
                onClick={() => handleLanguageChange('vi')}
                disabled={isTranslating}
                className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${lang === 'vi' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${isTranslating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                VI
              </button>
            </div>
            <button 
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              {t.guide}
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
              title={t.settings}
            >
              <Settings className="w-5 h-5" />
            </button>
            {ebook && (
              <div className="flex items-center gap-3 border-l border-slate-100 pl-4">
                <button 
                  onClick={startNewBook}
                  className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {t.newBook}
                </button>
                <div className="relative">
                  <button 
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-indigo-700 transition-all shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    {t.publish}
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  
                  <AnimatePresence>
                    {showExportMenu && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-20"
                      >
                        <button 
                          onClick={() => exportFile('md')}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 transition-colors"
                        >
                          <FileCode className="w-4 h-4 text-indigo-600" />
                          {t.exportMd}
                        </button>
                        <button 
                          onClick={() => exportFile('doc')}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 transition-colors"
                        >
                          <FileText className="w-4 h-4 text-blue-600" />
                          {t.exportDoc}
                        </button>
                        <button 
                          onClick={() => exportFile('pdf')}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 transition-colors"
                        >
                          <File className="w-4 h-4 text-red-600" />
                          {t.exportPdf}
                        </button>
                        <button 
                          onClick={() => exportFile('txt')}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 transition-colors"
                        >
                          <FileText className="w-4 h-4 text-slate-400" />
                          {t.exportTxt}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {showHistory ? (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <button 
                  onClick={() => setShowHistory(false)}
                  className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-medium transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  {t.close}
                </button>
                <h2 className="text-2xl font-bold text-slate-900">{t.history}</h2>
                <div className="w-20"></div>
              </div>

              {savedBooks.length === 0 ? (
                <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-20 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <History className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-medium">{t.noHistory}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedBooks.map((book) => (
                    <div 
                      key={book.id}
                      onClick={() => loadBook(book)}
                      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group relative"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="bg-indigo-50 p-3 rounded-xl">
                          <Book className="w-6 h-6 text-indigo-600" />
                        </div>
                        <button 
                          onClick={(e) => deleteBook(e, book.id)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <h3 className="font-bold text-slate-900 text-lg mb-1 line-clamp-1">{book.title}</h3>
                      <p className="text-sm text-slate-500 mb-4">{book.chapters.length} {t.chaptersLabel}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />
                        {t.lastUpdated}: {new Date(book.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : !ebook ? (
            <motion.div 
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto text-center py-20"
            >
              <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                Powered by Gemini 3.1
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 leading-tight">
                {t.heroTitle.split('complete ebook').map((part, i) => i === 0 ? <React.Fragment key={i}>{part}<span className="text-indigo-600">{lang === 'en' ? 'complete ebook' : 'ebook hoàn chỉnh'}</span></React.Fragment> : part)}
              </h2>
              <p className="text-lg text-slate-600 mb-10">
                {t.heroSubtitle}
              </p>
              
              <form onSubmit={handleGenerateOutline} className="space-y-4">
                <div className="relative group">
                  <input 
                    type="text" 
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    placeholder={t.placeholder}
                    className="w-full pl-6 pr-12 py-5 bg-white border-2 border-slate-200 rounded-2xl text-lg focus:outline-none focus:border-indigo-500 transition-all shadow-sm group-hover:shadow-md"
                    disabled={isGeneratingOutline}
                  />
                </div>

                <div className="relative group">
                  <input 
                    type="text" 
                    value={upsellTitleInput}
                    onChange={(e) => setUpsellTitleInput(e.target.value)}
                    placeholder={t.upsellPlaceholder}
                    className="w-full pl-6 pr-12 py-5 bg-white border-2 border-slate-200 rounded-2xl text-lg focus:outline-none focus:border-indigo-500 transition-all shadow-sm group-hover:shadow-md"
                    disabled={isGeneratingOutline}
                  />
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex-1 flex items-center gap-3 bg-white border-2 border-slate-200 rounded-2xl px-6 py-4">
                    <span className="text-slate-500 font-medium whitespace-nowrap">{t.chaptersLabel}:</span>
                    <input 
                      type="number" 
                      min="1" 
                      max="20"
                      value={chapterCount}
                      onChange={(e) => setChapterCount(parseInt(e.target.value) || 1)}
                      className="w-full bg-transparent focus:outline-none font-bold text-indigo-600"
                      disabled={isGeneratingOutline}
                    />
                  </div>
                  <div className="flex-1 flex items-center gap-3 bg-white border-2 border-slate-200 rounded-2xl px-6 py-4">
                    <span className="text-slate-500 font-medium whitespace-nowrap">{t.upsellChaptersLabel}:</span>
                    <input 
                      type="number" 
                      min="1" 
                      max="20"
                      value={upsellChapterCount}
                      onChange={(e) => setUpsellChapterCount(parseInt(e.target.value) || 1)}
                      className="w-full bg-transparent focus:outline-none font-bold text-indigo-600"
                      disabled={isGeneratingOutline}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-left text-sm font-bold text-slate-700 ml-1">{t.bonusGiftsLabel}</p>
                  <div className="grid grid-cols-1 gap-3">
                    {bonusTitles.map((title, i) => (
                      <input
                        key={i}
                        type="text"
                        value={title}
                        onChange={(e) => {
                          const newTitles = [...bonusTitles];
                          newTitles[i] = e.target.value;
                          setBonusTitles(newTitles);
                        }}
                        placeholder={`${t.bonusGiftPlaceholder} ${i + 1}`}
                        className="w-full px-5 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
                        disabled={isGeneratingOutline}
                      />
                    ))}
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isGeneratingOutline || !titleInput.trim()}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  {isGeneratingOutline ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      {t.startWriting}
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
              
              {!apiKey && (
                <p className="mt-6 text-sm text-amber-600 flex items-center justify-center gap-2">
                  <Key className="w-4 h-4" />
                  {t.apiKeyWarning}
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="editor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Sidebar - Chapter List */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-slate-900">{t.toc}</h3>
                    <p className="text-xs text-slate-500 mt-1">{ebook.title}</p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {ebook.chapters.map((chapter, idx) => (
                      <button
                        key={chapter.id}
                        onClick={() => {
                          if (chapter.content) {
                            resetViews();
                            setSelectedChapterId(chapter.id);
                          } else {
                            handleGenerateChapter(chapter.id);
                          }
                        }}
                        className={`w-full text-left p-4 flex items-start gap-3 transition-all hover:bg-slate-50 group ${selectedChapterId === chapter.id ? 'bg-indigo-50/50' : ''}`}
                      >
                        <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${chapter.content ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {chapter.content ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-sm font-semibold truncate ${selectedChapterId === chapter.id ? 'text-indigo-700' : 'text-slate-800'}`}>
                            {chapter.title}
                          </h4>
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                            {chapter.description}
                          </p>
                        </div>
                        {chapter.isGenerating ? (
                          <Loader2 className="w-4 h-4 text-indigo-600 animate-spin flex-shrink-0" />
                        ) : !chapter.content && (
                          <Plus className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {ebook.bonusGifts.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        {t.bonusGifts}
                      </h3>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {ebook.bonusGifts.map((bonus, idx) => (
                        <button
                          key={bonus.id}
                          onClick={() => {
                            if (bonus.content) {
                              resetViews();
                              setSelectedBonusId(bonus.id);
                            } else {
                              handleGenerateBonus(bonus.id);
                            }
                          }}
                          className={`w-full text-left p-4 flex items-start gap-3 transition-all hover:bg-slate-50 group ${selectedBonusId === bonus.id ? 'bg-indigo-50/50' : ''}`}
                        >
                          <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${bonus.content ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                            {bonus.content ? <CheckCircle2 className="w-4 h-4" /> : `B${idx + 1}`}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-semibold truncate ${selectedBonusId === bonus.id ? 'text-indigo-700' : 'text-slate-800'}`}>
                              {bonus.title}
                            </h4>
                          </div>
                          {bonus.isGenerating ? (
                            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin flex-shrink-0" />
                          ) : !bonus.content && (
                            <Plus className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {ebook.readme && (
                  <button 
                    onClick={() => {
                      resetViews();
                      setShowReadme(true);
                    }}
                    className={`w-full flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md ${showReadme ? 'border-indigo-600 ring-1 ring-indigo-600' : ''}`}
                  >
                    <div className="bg-slate-100 p-2 rounded-lg">
                      <FileText className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-sm font-bold text-slate-900">{t.readme}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{t.downloadReadme}</p>
                    </div>
                  </button>
                )}

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      Marketing
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-50">
                    <button
                      onClick={() => {
                        if (ebook.salePageHtml) {
                          resetViews();
                          setShowSalePage(true);
                        } else {
                          handleGenerateSalePage();
                        }
                      }}
                      className={`w-full text-left p-4 flex items-start gap-3 transition-all hover:bg-slate-50 group ${showSalePage ? 'bg-indigo-50/50' : ''}`}
                    >
                      <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${ebook.salePageHtml ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                        {ebook.salePageHtml ? <CheckCircle2 className="w-4 h-4" /> : <FileText className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-semibold truncate ${showSalePage ? 'text-indigo-700' : 'text-slate-800'}`}>
                          {t.salePage}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{t.salePageDesc}</p>
                      </div>
                      {isGeneratingSalePage ? (
                        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin flex-shrink-0" />
                      ) : !ebook.salePageHtml && (
                        <Plus className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                      )}
                    </button>

                    <button
                      onClick={() => {
                        if (ebook.jvPageHtml) {
                          resetViews();
                          setShowJvPage(true);
                        } else {
                          handleGenerateJvPage();
                        }
                      }}
                      className={`w-full text-left p-4 flex items-start gap-3 transition-all hover:bg-slate-50 group ${showJvPage ? 'bg-indigo-50/50' : ''}`}
                    >
                      <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${ebook.jvPageHtml ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                        {ebook.jvPageHtml ? <CheckCircle2 className="w-4 h-4" /> : <FileCode className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-semibold truncate ${showJvPage ? 'text-indigo-700' : 'text-slate-800'}`}>
                          {t.jvPage}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{t.jvPageDesc}</p>
                      </div>
                      {isGeneratingJvPage ? (
                        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin flex-shrink-0" />
                      ) : !ebook.jvPageHtml && (
                        <Plus className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                      )}
                    </button>

                    <button
                      onClick={() => {
                        if (ebook.upsellBook) {
                          resetViews();
                          setShowUpsellBook(true);
                        } else {
                          handleGenerateUpsell();
                        }
                      }}
                      className={`w-full text-left p-4 flex items-start gap-3 transition-all hover:bg-slate-50 group ${showUpsellBook ? 'bg-indigo-50/50' : ''}`}
                    >
                      <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${ebook.upsellBook ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                        {ebook.upsellBook ? <CheckCircle2 className="w-4 h-4" /> : <Book className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-semibold truncate ${showUpsellBook ? 'text-indigo-700' : 'text-slate-800'}`}>
                          {t.upsellBook}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{t.generateUpsell}</p>
                      </div>
                      {isGeneratingUpsell ? (
                        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin flex-shrink-0" />
                      ) : !ebook.upsellBook && (
                        <Plus className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                      )}
                    </button>

                    <button
                      onClick={() => {
                        if (ebook.otoPageHtml) {
                          resetViews();
                          setShowOtoPage(true);
                        } else {
                          handleGenerateOtoPage();
                        }
                      }}
                      className={`w-full text-left p-4 flex items-start gap-3 transition-all hover:bg-slate-50 group ${showOtoPage ? 'bg-indigo-50/50' : ''}`}
                    >
                      <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${ebook.otoPageHtml ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                        {ebook.otoPageHtml ? <CheckCircle2 className="w-4 h-4" /> : <FileCode className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-semibold truncate ${showOtoPage ? 'text-indigo-700' : 'text-slate-800'}`}>
                          {t.otoPage}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{t.otoPageDesc}</p>
                      </div>
                      {isGeneratingOtoPage ? (
                        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin flex-shrink-0" />
                      ) : !ebook.otoPageHtml && (
                        <Plus className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                      )}
                    </button>

                    <button
                      onClick={() => {
                        resetViews();
                        setShowDesignAssets(true);
                      }}
                      className={`w-full text-left p-4 flex items-start gap-3 transition-all hover:bg-slate-50 group ${showDesignAssets ? 'bg-indigo-50/50' : ''}`}
                    >
                      <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-indigo-100 text-indigo-700`}>
                        <Sparkles className="w-3 h-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-semibold truncate ${showDesignAssets ? 'text-indigo-700' : 'text-slate-800'}`}>
                          {t.designAssets}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{t.designAssetsDesc}</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="lg:col-span-8">
                <div className="bg-white rounded-2xl border border-slate-200 min-h-[600px] shadow-sm overflow-hidden flex flex-col">
                  {selectedChapter ? (
                    <>
                      <div className="relative h-48 overflow-hidden">
                        <img 
                          src={`https://loremflickr.com/1200/400/${selectedChapter.imageKeyword}`} 
                          alt={selectedChapter.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-8">
                          <div>
                            <h2 className="text-3xl font-bold text-white">{selectedChapter.title}</h2>
                            <p className="text-indigo-200 text-sm mt-1">{selectedChapter.description}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-10 max-w-none overflow-y-auto flex-1">
                        <MarkdownRenderer content={selectedChapter.content || ''} />
                      </div>
                    </>
                  ) : selectedBonus ? (
                    <>
                      <div className="p-10 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1 block">{t.bonusGifts}</span>
                          <h2 className="text-3xl font-bold text-slate-900">{selectedBonus.title}</h2>
                        </div>
                        <Sparkles className="w-10 h-10 text-indigo-100" />
                      </div>
                      <div className="p-10 max-w-none overflow-y-auto flex-1">
                        <MarkdownRenderer content={selectedBonus.content || ''} />
                      </div>
                    </>
                  ) : showReadme ? (
                    <>
                      <div className="p-10 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1 block">{t.readme}</span>
                          <h2 className="text-3xl font-bold text-slate-900">{t.readme}</h2>
                        </div>
                        <button 
                          onClick={downloadReadme}
                          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm"
                        >
                          <Download className="w-4 h-4" />
                          {t.downloadReadme}
                        </button>
                      </div>
                      <div className="p-10 max-w-none overflow-y-auto flex-1">
                        <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 font-mono text-sm whitespace-pre-wrap leading-relaxed text-slate-700">
                          {ebook.readme}
                        </div>
                      </div>
                    </>
                  ) : showSalePage && ebook.salePageHtml ? (
                    <>
                      <div className="p-10 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1 block">{t.salePage}</span>
                          <h2 className="text-3xl font-bold text-slate-900">{t.salePage}</h2>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(ebook.salePageHtml || '');
                              alert(t.copyCode);
                            }}
                            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all shadow-sm"
                          >
                            <FileCode className="w-4 h-4" />
                            {t.copyCode}
                          </button>
                          <button 
                            onClick={() => downloadHtml(ebook.salePageHtml || '', 'salepage.html')}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm"
                          >
                            <Download className="w-4 h-4" />
                            {t.downloadHtml}
                          </button>
                        </div>
                      </div>
                      <div className="p-10 max-w-none overflow-y-auto flex-1">
                        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 font-mono text-sm whitespace-pre-wrap leading-relaxed text-indigo-300 overflow-x-auto">
                          {ebook.salePageHtml}
                        </div>
                      </div>
                    </>
                  ) : showJvPage && ebook.jvPageHtml ? (
                    <>
                      <div className="p-10 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1 block">{t.jvPage}</span>
                          <h2 className="text-3xl font-bold text-slate-900">{t.jvPage}</h2>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(ebook.jvPageHtml || '');
                              alert(t.copyCode);
                            }}
                            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all shadow-sm"
                          >
                            <FileCode className="w-4 h-4" />
                            {t.copyCode}
                          </button>
                          <button 
                            onClick={() => downloadHtml(ebook.jvPageHtml || '', 'jvpage.html')}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm"
                          >
                            <Download className="w-4 h-4" />
                            {t.downloadHtml}
                          </button>
                        </div>
                      </div>
                      <div className="p-10 max-w-none overflow-y-auto flex-1">
                        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 font-mono text-sm whitespace-pre-wrap leading-relaxed text-indigo-300 overflow-x-auto">
                          {ebook.jvPageHtml}
                        </div>
                      </div>
                    </>
                  ) : showOtoPage && ebook.otoPageHtml ? (
                    <>
                      <div className="p-10 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1 block">{t.otoPage}</span>
                          <h2 className="text-3xl font-bold text-slate-900">{t.otoPage}</h2>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(ebook.otoPageHtml || '');
                              alert(t.copyCode);
                            }}
                            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all shadow-sm"
                          >
                            <FileCode className="w-4 h-4" />
                            {t.copyCode}
                          </button>
                          <button 
                            onClick={() => downloadHtml(ebook.otoPageHtml || '', 'otopage.html')}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm"
                          >
                            <Download className="w-4 h-4" />
                            {t.downloadHtml}
                          </button>
                        </div>
                      </div>
                      <div className="p-10 max-w-none overflow-y-auto flex-1">
                        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 font-mono text-sm whitespace-pre-wrap leading-relaxed text-indigo-300 overflow-x-auto">
                          {ebook.otoPageHtml}
                        </div>
                      </div>
                    </>
                  ) : showUpsellBook && ebook.upsellBook ? (
                    <>
                      {selectedUpsellChapter ? (
                        <>
                          <div className="p-10 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={() => setSelectedUpsellChapterId(null)}
                                className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-indigo-600 border border-transparent hover:border-slate-100"
                              >
                                <ArrowLeft className="w-5 h-5" />
                              </button>
                              <div>
                                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1 block">{t.upsellBook}</span>
                                <h2 className="text-3xl font-bold text-slate-900">{selectedUpsellChapter.title}</h2>
                              </div>
                            </div>
                            <Sparkles className="w-10 h-10 text-indigo-100" />
                          </div>
                          <div className="p-10 max-w-none overflow-y-auto flex-1">
                            <MarkdownRenderer content={selectedUpsellChapter.content || ''} />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="p-10 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1 block">{t.upsellBook}</span>
                              <h2 className="text-3xl font-bold text-slate-900">{ebook.upsellBook.title}</h2>
                            </div>
                            <Sparkles className="w-10 h-10 text-indigo-100" />
                          </div>
                          <div className="p-10 max-w-none overflow-y-auto flex-1">
                            <div className="space-y-6">
                              <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                                <h3 className="font-bold text-indigo-900 mb-4">{t.toc}</h3>
                                <div className="space-y-3">
                                  {ebook.upsellBook.chapters.map((chapter, idx) => (
                                    <button 
                                      key={chapter.id}
                                      onClick={() => chapter.content ? setSelectedUpsellChapterId(chapter.id) : handleGenerateUpsellChapter(chapter.id)}
                                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all group ${chapter.content ? 'bg-white border-indigo-100 hover:border-indigo-300 hover:shadow-sm' : 'bg-white/50 border-slate-100 hover:bg-white'}`}
                                      disabled={chapter.isGenerating}
                                    >
                                      <div className="flex items-center gap-3 text-sm text-indigo-700">
                                        <span className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center font-bold text-xs">{idx + 1}</span>
                                        <span className="font-semibold">{chapter.title}</span>
                                      </div>
                                      {chapter.isGenerating ? (
                                        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                                      ) : chapter.content ? (
                                        <ChevronRight className="w-4 h-4 text-indigo-300 group-hover:text-indigo-500 transition-colors" />
                                      ) : (
                                        <Plus className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                <h3 className="font-bold text-slate-900 mb-2">{t.coverPrompt}</h3>
                                <p className="text-sm text-slate-600 italic leading-relaxed">{ebook.upsellBook.coverImagePrompt}</p>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  ) : showDesignAssets ? (
                    <>
                      <div className="p-10 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1 block">{t.designAssets}</span>
                          <h2 className="text-3xl font-bold text-slate-900">{t.designAssets}</h2>
                        </div>
                        <Sparkles className="w-10 h-10 text-indigo-100" />
                      </div>
                      <div className="p-10 max-w-none overflow-y-auto flex-1 space-y-8">
                        {/* Cover Prompt */}
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                              <BookOpen className="w-5 h-5 text-indigo-600" />
                              {t.coverPrompt}
                            </h3>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(ebook.coverImagePrompt || '');
                                alert(t.copyPrompt);
                              }}
                              className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-bold text-slate-600 hover:bg-slate-50 transition-all"
                            >
                              {t.copyPrompt}
                            </button>
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-slate-100 text-sm italic text-slate-600 leading-relaxed">
                            {ebook.coverImagePrompt || `A professional book cover for "${ebook.title}"`}
                          </div>
                        </div>

                        {/* Upsell Cover Prompt */}
                        {ebook.upsellBook && (
                          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-indigo-600" />
                                {t.upsellBook} - {t.coverPrompt}
                              </h3>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(ebook.upsellBook?.coverImagePrompt || '');
                                  alert(t.copyPrompt);
                                }}
                                className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-bold text-slate-600 hover:bg-slate-50 transition-all"
                              >
                                {t.copyPrompt}
                              </button>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-100 text-sm italic text-slate-600 leading-relaxed">
                              {ebook.upsellBook.coverImagePrompt || `A professional book cover for "${ebook.upsellBook.title}"`}
                            </div>
                          </div>
                        )}

                        {/* Chapter Prompts */}
                        <div className="space-y-4">
                          <h3 className="font-bold text-slate-900 flex items-center gap-2 px-2">
                            <FileText className="w-5 h-5 text-indigo-600" />
                            {t.chapterPrompts}
                          </h3>
                          <div className="grid grid-cols-1 gap-4">
                            {ebook.chapters.map((chapter, idx) => {
                              const prompts = Array.from(chapter.content?.matchAll(/\[ILLUSTRATION PROMPT:\s*(.*?)\]/g) || []).map(m => m[1]);
                              
                              if (prompts.length === 0) return null;

                              return (
                                <div key={chapter.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                  <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.chapter} {idx + 1}: {chapter.title}</span>
                                  </div>
                                  <div className="space-y-4">
                                    {prompts.map((prompt, pIdx) => (
                                      <div key={pIdx} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Prompt {pIdx + 1}</span>
                                          <button 
                                            onClick={() => {
                                              navigator.clipboard.writeText(prompt);
                                              alert(t.copyPrompt);
                                            }}
                                            className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-md font-bold text-slate-500 hover:bg-slate-100 transition-all"
                                          >
                                            {t.copyPrompt}
                                          </button>
                                        </div>
                                        <p className="text-sm text-slate-600 italic leading-relaxed">{prompt}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Upsell Chapter Prompts */}
                        {ebook.upsellBook && ebook.upsellBook.chapters.some(c => c.content?.includes('[ILLUSTRATION PROMPT:')) && (
                          <div className="space-y-4">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2 px-2">
                              <Book className="w-5 h-5 text-indigo-600" />
                              {t.upsellBook} - {t.chapterPrompts}
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                              {ebook.upsellBook.chapters.map((chapter, idx) => {
                                const prompts = Array.from(chapter.content?.matchAll(/\[ILLUSTRATION PROMPT:\s*(.*?)\]/g) || []).map(m => m[1]);
                                
                                if (prompts.length === 0) return null;

                                return (
                                  <div key={chapter.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.chapter} {idx + 1}: {chapter.title}</span>
                                    </div>
                                    <div className="space-y-4">
                                      {prompts.map((prompt, pIdx) => (
                                        <div key={pIdx} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                          <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Prompt {pIdx + 1}</span>
                                            <button 
                                              onClick={() => {
                                                navigator.clipboard.writeText(prompt);
                                                alert(t.copyPrompt);
                                              }}
                                              className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-md font-bold text-slate-500 hover:bg-slate-100 transition-all"
                                            >
                                              {t.copyPrompt}
                                            </button>
                                          </div>
                                          <p className="text-sm text-slate-600 italic leading-relaxed">{prompt}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Bonus Prompts */}
                        {ebook.bonusGifts.some(b => b.content?.includes('[ILLUSTRATION PROMPT:')) && (
                          <div className="space-y-4">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2 px-2">
                              <Sparkles className="w-5 h-5 text-indigo-600" />
                              {t.bonusGifts}
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                              {ebook.bonusGifts.map((bonus, idx) => {
                                const prompts = Array.from(bonus.content?.matchAll(/\[ILLUSTRATION PROMPT:\s*(.*?)\]/g) || []).map(m => m[1]);
                                
                                if (prompts.length === 0) return null;

                                return (
                                  <div key={bonus.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{bonus.title}</span>
                                    </div>
                                    <div className="space-y-4">
                                      {prompts.map((prompt, pIdx) => (
                                        <div key={pIdx} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                          <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Prompt {pIdx + 1}</span>
                                            <button 
                                              onClick={() => {
                                                navigator.clipboard.writeText(prompt);
                                                alert(t.copyPrompt);
                                              }}
                                              className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-md font-bold text-slate-500 hover:bg-slate-100 transition-all"
                                            >
                                              {t.copyPrompt}
                                            </button>
                                          </div>
                                          <p className="text-sm text-slate-600 italic leading-relaxed">{prompt}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                          <BookOpen className="w-10 h-10 text-indigo-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">{t.selectChapter}</h3>
                        <p className="text-slate-500 max-w-md">
                          {t.selectChapterDesc}
                        </p>
                      </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-slate-200 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <Book className="w-4 h-4" />
            <span className="text-sm font-medium">{t.authorName} - {t.title} &copy; 2026</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-indigo-600 transition-colors">{t.privacy}</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">{t.terms}</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">{t.support}</a>
          </div>
        </div>
      </footer>

      {/* Guide Modal */}
      <AnimatePresence>
        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGuide(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <HelpCircle className="w-6 h-6 text-indigo-600" />
                  {t.guideTitle}
                </h3>
                <button 
                  onClick={() => setShowGuide(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <div className="p-8 overflow-y-auto space-y-8">
                <section>
                  <h4 className="font-bold text-indigo-600 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs">1</span>
                    {t.guideStep1}
                  </h4>
                </section>
                <section>
                  <h4 className="font-bold text-indigo-600 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs">2</span>
                    {t.guideStep2}
                  </h4>
                </section>
                <section>
                  <h4 className="font-bold text-indigo-600 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs">3</span>
                    {t.guideStep3}
                  </h4>
                </section>
                <section>
                  <h4 className="font-bold text-indigo-600 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs">4</span>
                    {t.guideStep4}
                  </h4>
                </section>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                <button 
                  onClick={() => setShowGuide(false)}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md"
                >
                  {t.gotIt}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-600" />
                  {t.settingsTitle}
                </h3>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t.apiKeyLabel}</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input 
                      type="password" 
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={t.apiKeyPlaceholder}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <button 
                  onClick={() => saveApiKey(apiKey)}
                  className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md"
                >
                  {t.save}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Quota Error Modal */}
      <AnimatePresence>
        {quotaError && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQuotaError(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden border border-red-100"
            >
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="w-10 h-10 text-red-500" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">{t.quotaExceededTitle}</h3>
                <p className="text-slate-600 leading-relaxed mb-8">
                  {t.quotaExceededMsg}
                </p>
                <button 
                  onClick={() => setQuotaError(false)}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-[0.98]"
                >
                  {t.gotIt}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
