export interface RawParagraph {
  text: string;
  paragraphIndex: number;
  startIndex: number;
  endIndex: number;
}

export interface RawSentence {
  text: string;
  paragraphIndex: number;
  startIndex: number;
  endIndex: number;
}

export interface OptimizedSegment {
  text: string;
  paragraphIndex: number;
  sourceStart: number;
  sourceEnd: number;
  characterCount: number;
}
