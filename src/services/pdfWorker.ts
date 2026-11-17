import * as pdfjsLib from 'pdfjs-dist';
import { PdfMetadata, PdfOutlineItem } from '@/types/pdf';

const PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438';

// Configure the worker URL using Vite's URL import
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export { pdfjsLib };

export interface LoadedPdf {
  pdfDocument: pdfjsLib.PDFDocumentProxy;
  numPages: number;
  metadata: PdfMetadata;
  outline: PdfOutlineItem[];
}

export class PdfService {
  private static createLoadingTask(source: Uint8Array | string, password?: string) {
    return pdfjsLib.getDocument({
      data: typeof source === 'string' ? undefined : source,
      url: typeof source === 'string' ? source : undefined,
      password: password || undefined,
      cMapUrl: `${PDFJS_CDN}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${PDFJS_CDN}/standard_fonts/`,
      wasmUrl: `${PDFJS_CDN}/wasm/`,
      iccUrl: `${PDFJS_CDN}/iccs/`,
    });
  }

  /**
   * Loads only the PDF document proxy (no metadata/outline extraction).
   * Useful for rendering or one-off processing tasks.
   */
  static async loadProxy(
    source: Uint8Array | string,
    password?: string
  ): Promise<pdfjsLib.PDFDocumentProxy> {
    const loadingTask = this.createLoadingTask(source, password);
    return loadingTask.promise;
  }

  /**
   * Loads a PDF from binary data or file path
   */
  static async loadDocument(
    source: Uint8Array | string,
    password?: string
  ): Promise<LoadedPdf> {
    const loadingTask = this.createLoadingTask(source, password);

    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;

    // Extract metadata
    let metadata: PdfMetadata = {
      pageCount: numPages,
      pdfVersion: '1.7',
      fileSizeBytes: typeof source === 'string' ? 0 : source.byteLength,
    };

    try {
      const meta = await pdfDocument.getMetadata();
      const info = (meta?.info as Record<string, any>) || {};
      metadata = {
        ...metadata,
        title: info.Title || undefined,
        author: info.Author || undefined,
        subject: info.Subject || undefined,
        keywords: info.Keywords || undefined,
        creator: info.Creator || undefined,
        producer: info.Producer || undefined,
        creationDate: info.CreationDate || undefined,
        modificationDate: info.ModDate || undefined,
        pdfVersion: info.PDFFormatVersion || '1.7',
      };
    } catch (e) {
      console.warn('Could not read PDF metadata:', e);
    }

    // Extract outline / TOC
    let outline: PdfOutlineItem[] = [];
    try {
      const rawOutline = await pdfDocument.getOutline();
      if (rawOutline) {
        outline = this.formatOutline(rawOutline);
      }
    } catch (e) {
      console.warn('Could not read PDF outline:', e);
    }

    return {
      pdfDocument,
      numPages,
      metadata,
      outline,
    };
  }

  private static formatOutline(items: any[]): PdfOutlineItem[] {
    return items.map((item) => ({
      title: item.title,
      bold: item.bold || false,
      italic: item.italic || false,
      color: item.color || [0, 0, 0],
      dest: item.dest,
      url: item.url,
      items: item.items ? this.formatOutline(item.items) : [],
    }));
  }

  /**
   * Renders a page to an HTML5 canvas with High-DPI support
   */
  static renderPageToCanvas(
    page: pdfjsLib.PDFPageProxy,
    canvas: HTMLCanvasElement,
    scale: number,
    rotation: 0 | 90 | 180 | 270 = 0
  ): pdfjsLib.RenderTask {
    const dpr = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: scale * dpr, rotation });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not get canvas 2d context');

    return page.render({
      canvas,
      canvasContext: ctx,
      viewport,
      intent: 'display',
    });
  }

  /**
   * Renders thumbnail for a specific page with fixed maximum bounds
   */
  static async renderThumbnail(
    page: pdfjsLib.PDFPageProxy,
    maxWidth = 160
  ): Promise<string> {
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const scale = maxWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    await page.render({
      canvas,
      canvasContext: ctx,
      viewport,
      intent: 'display',
    }).promise;

    return canvas.toDataURL('image/jpeg', 0.85);
  }
}

