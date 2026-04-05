export interface Chapter {
  id: string;
  title: string;
  description: string;
  content?: string;
  imageKeyword?: string;
  isGenerating?: boolean;
}

export interface Ebook {
  title: string;
  author: string;
  chapters: Chapter[];
  coverImageKeyword?: string;
}
