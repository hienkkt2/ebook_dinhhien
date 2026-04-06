export interface Chapter {
  id: string;
  title: string;
  description: string;
  content?: string;
  imageKeyword?: string;
  isGenerating?: boolean;
}

export interface BonusGift {
  id: string;
  title: string;
  content?: string;
  isGenerating?: boolean;
}

export interface Ebook {
  id: string;
  title: string;
  author: string;
  chapters: Chapter[];
  bonusGifts: BonusGift[];
  readme: string;
  coverImageKeyword?: string;
  updatedAt: number;
}
