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
  Key
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import { Chapter, Ebook } from './types';
import { generateOutline, generateChapterContent, translateText } from './lib/gemini';
import { translations, Language } from './lib/translations';

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [titleInput, setTitleInput] = useState('');
  const [chapterCount, setChapterCount] = useState(5);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [ebook, setEbook] = useState<Ebook | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [isGeneratingChapter, setIsGeneratingChapter] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const t = translations[lang];

  // Load API key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    setShowSettings(false);
  };

  const handleGenerateOutline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleInput.trim()) return;

    setIsGeneratingOutline(true);
    try {
      const { chapters, coverKeyword } = await generateOutline(titleInput, chapterCount, apiKey, lang);
      setEbook({
        title: titleInput,
        author: t.authorName,
        chapters,
        coverImageKeyword: coverKeyword
      });
    } catch (error) {
      console.error('Error generating outline:', error);
      alert('Error generating outline. Please check your API Key.');
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleGenerateChapter = async (chapterId: string) => {
    if (!ebook || isTranslating) return;
    
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
    } catch (error) {
      console.error('Error generating chapter:', error);
      setEbook(prev => {
        if (!prev) return null;
        const newChapters = [...prev.chapters];
        newChapters[chapterIndex] = { ...newChapters[chapterIndex], isGenerating: false };
        return { ...prev, chapters: newChapters };
      });
      alert('Error generating chapter content.');
    } finally {
      setIsGeneratingChapter(false);
    }
  };

  const selectedChapter = ebook?.chapters.find(c => c.id === selectedChapterId);

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

      setEbook({
        ...ebook,
        title: translatedTitle,
        chapters: translatedChapters
      });
      
      setTitleInput(translatedTitle);
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
      ebook.chapters.forEach(c => {
        content += `## ${c.title}\n\n${c.content || `*${t.chapterNotGenerated}*`}\n\n---\n\n`;
      });
      downloadBlob(content, 'text/markdown', `${ebook.title.replace(/\s+/g, '_')}.md`);
    } else if (format === 'txt') {
      let content = `${ebook.title.toUpperCase()}\n${t.authorLabel}: ${ebook.author}\n\n`;
      ebook.chapters.forEach(c => {
        content += `${c.title.toUpperCase()}\n\n${c.content || t.chapterNotGenerated}\n\n${'='.repeat(20)}\n\n`;
      });
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
        // For PDF, we'll keep the prompts as text but maybe stylize them slightly
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
              title="API Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            {ebook && (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setEbook(null)}
                  className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                >
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
          {!ebook ? (
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
                  <button 
                    type="submit"
                    disabled={isGeneratingOutline || !titleInput.trim()}
                    className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg"
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
                </div>
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
                        onClick={() => chapter.content ? setSelectedChapterId(chapter.id) : handleGenerateChapter(chapter.id)}
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
    </div>
  );
}
