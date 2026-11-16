export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  pageCount: number;
  pdfVersion: string;
  fileSizeBytes: number;
}

export interface PdfOutlineItem {
  title: string;
  bold: boolean;
  italic: boolean;
  color: Uint8ClampedArray | number[];
  dest?: string | any[];
  url?: string;
  items: PdfOutlineItem[];
  pageNumber?: number;
}

export interface PdfDocumentInfo {
  id: string;
  filePath: string;
  fileName: string;
  metadata: PdfMetadata;
  outline: PdfOutlineItem[];
  isDirty: boolean;
  lastSavedAt: number;
}
