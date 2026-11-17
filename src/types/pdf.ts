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
  /** Writable location on disk. Null until the document has been saved (or was opened from disk). */
  savePath?: string | null;
  fileName: string;
  metadata: PdfMetadata;
  outline: PdfOutlineItem[];
  isDirty: boolean;
  lastSavedAt: number;
}

/**
 * A page instance in the working document.
 *
 * `id` stays stable for the lifetime of the page (including reorder/duplicate),
 * while `sourceIndex` points at the original PDF page used for rendering.
 */
export interface PageRef {
  id: string;
  sourceIndex: number;
}

