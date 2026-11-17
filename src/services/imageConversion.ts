import { PdfService } from '@/services/pdfWorker';

const POINTS_PER_INCH = 72;
const DEFAULT_IMAGE_DPI = 96;
/** A4 long edge in PDF points; larger images are scaled down to this. */
const DEFAULT_MAX_PAGE_EDGE = 842;
const MM_TO_POINTS = 72 / 25.4;

const FIXED_PAGE_SIZES: Record<Exclude<ImagesToPdfPageSize, 'original'>, { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
  legal: { width: 612, height: 1008 },
};

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
};

export interface ImageFileInput {
  name: string;
  bytes: Uint8Array;
}

export interface ImagesToPdfOptions {
  /** Resolution used to translate image pixels into PDF points. */
  dpi?: number;
  /** Largest allowed page edge, in PDF points. */
  maxPageEdge?: number;
  /** Fixed output page size, or the image's natural size. */
  pageSize?: ImagesToPdfPageSize;
  /** Page orientation for fixed page sizes. */
  orientation?: ImagesToPdfOrientation;
  /** How the image is placed on a fixed-size page. */
  fit?: ImageFitMode;
  /** Margin around the image, in millimetres. */
  marginMm?: number;
}

export type ImagesToPdfPageSize = 'original' | 'a4' | 'letter' | 'legal';
export type ImagesToPdfOrientation = 'auto' | 'portrait' | 'landscape';
export type ImageFitMode = 'fit' | 'stretch';

export interface ImagesToPdfResult {
  bytes: Uint8Array;
  pageCount: number;
  /** Images that could not be decoded, by original file name. */
  skipped: string[];
  /** Editable placements for images kept as overlay objects in SPADE. */
  images: EditablePdfImagePlacement[];
}

export interface EditablePdfImagePlacement {
  name: string;
  pageIndex: number;
  dataUrl: string;
  rect: { x: number; y: number; width: number; height: number };
}

export type ImageExportFormat = 'png' | 'jpeg';

export interface PdfImageExportOptions {
  /** 1-based page numbers (in final document order). */
  pages: readonly number[];
  format: ImageExportFormat;
  dpi: number;
  onProgress?: (completed: number, total: number) => void;
}

export interface ExportedPageImage {
  pageNumber: number;
  bytes: Uint8Array;
  format: ImageExportFormat;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function isPng(bytes: Uint8Array): boolean {
  return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

function isJpeg(bytes: Uint8Array): boolean {
  return startsWith(bytes, [0xff, 0xd8, 0xff]);
}

function extensionOf(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not decode image'));
    image.src = src;
  });
}

async function canvasToBytes(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Could not encode image'))),
      mimeType,
      quality
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

async function bytesToDataUrl(bytes: Uint8Array, mimeType: string): Promise<string> {
  const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read image data'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Converts formats pdf-lib cannot embed directly (webp, gif, bmp, svg, avif)
 * into PNG by drawing them onto a canvas.
 */
async function rasterizeToPng(
  bytes: Uint8Array,
  mimeType: string
): Promise<{ pngBytes: Uint8Array; width: number; height: number }> {
  const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);

  try {
    const image = await loadImageElement(url);
    let width = image.naturalWidth || 1024;
    let height = image.naturalHeight || 1024;

    // Guard against pathologically large bitmaps exhausting canvas memory.
    const maxEdge = 8192;
    const longest = Math.max(width, height);
    if (longest > maxEdge) {
      const ratio = maxEdge / longest;
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create a canvas context');

    // Transparent images become white rather than black in the PDF.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    return {
      pngBytes: await canvasToBytes(canvas, 'image/png'),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function fixedPageSizeForImage(
  imageWidth: number,
  imageHeight: number,
  options: ImagesToPdfOptions
): { width: number; height: number } | null {
  const pageSize = options.pageSize || 'original';
  if (pageSize === 'original') return null;

  const base = FIXED_PAGE_SIZES[pageSize];
  const orientation = options.orientation || 'auto';
  const landscape =
    orientation === 'landscape' ||
    (orientation === 'auto' && imageWidth > imageHeight);

  return landscape
    ? { width: base.height, height: base.width }
    : { width: base.width, height: base.height };
}

/**
 * Builds a PDF with one blank page per image. The images are returned as
 * editable placements so SPADE can keep them selectable; saving/exporting
 * draws them onto the pages.
 */
export async function createPdfFromImages(
  images: readonly ImageFileInput[],
  options: ImagesToPdfOptions = {}
): Promise<ImagesToPdfResult> {
  if (images.length === 0) {
    throw new Error('No images were selected');
  }

  const lib = await import('pdf-lib');
  const doc = await lib.PDFDocument.create();
  const dpi = Math.max(1, options.dpi ?? DEFAULT_IMAGE_DPI);
  const maxPageEdge = Math.max(1, options.maxPageEdge ?? DEFAULT_MAX_PAGE_EDGE);
  const skipped: string[] = [];
  const editableImages: EditablePdfImagePlacement[] = [];

  for (const file of images) {
    try {
      let widthPx = 0;
      let heightPx = 0;
      let sourceBytes = file.bytes;
      let sourceMime = MIME_BY_EXTENSION[extensionOf(file.name)] || 'application/octet-stream';

      if (isPng(file.bytes)) sourceMime = 'image/png';
      else if (isJpeg(file.bytes)) sourceMime = 'image/jpeg';

      let dataUrl = await bytesToDataUrl(sourceBytes, sourceMime);
      try {
        const image = await loadImageElement(dataUrl);
        widthPx = image.naturalWidth;
        heightPx = image.naturalHeight;
        if (!widthPx || !heightPx) throw new Error('Image has no dimensions');
      } catch {
        // Formats the browser cannot display directly are rasterized to PNG.
        const raster = await rasterizeToPng(file.bytes, sourceMime);
        sourceBytes = raster.pngBytes;
        sourceMime = 'image/png';
        widthPx = raster.width;
        heightPx = raster.height;
        dataUrl = await bytesToDataUrl(sourceBytes, sourceMime);
      }

      if (!widthPx || !heightPx) {
        skipped.push(file.name);
        continue;
      }

      const pageIndex = doc.getPageCount();
      const fixedPage = fixedPageSizeForImage(widthPx, heightPx, options);

      if (!fixedPage) {
        // Original mode: the page matches the image, scaled from pixels to
        // points, and very large pages are capped at the A4 long edge.
        let width = (widthPx * POINTS_PER_INCH) / dpi;
        let height = (heightPx * POINTS_PER_INCH) / dpi;

        const longest = Math.max(width, height);
        if (longest > maxPageEdge) {
          const ratio = maxPageEdge / longest;
          width *= ratio;
          height *= ratio;
        }

        doc.addPage([width, height]);
        editableImages.push({
          name: file.name,
          pageIndex,
          dataUrl,
          rect: { x: 0, y: 0, width, height },
        });
        continue;
      }

      const margin = Math.max(0, options.marginMm ?? 0) * MM_TO_POINTS;
      const availableWidth = Math.max(1, fixedPage.width - margin * 2);
      const availableHeight = Math.max(1, fixedPage.height - margin * 2);

      let drawWidth: number;
      let drawHeight: number;
      if (options.fit === 'stretch') {
        drawWidth = availableWidth;
        drawHeight = availableHeight;
      } else {
        const scale = Math.min(availableWidth / widthPx, availableHeight / heightPx);
        drawWidth = widthPx * scale;
        drawHeight = heightPx * scale;
      }

      const x = margin + (availableWidth - drawWidth) / 2;
      const y = margin + (availableHeight - drawHeight) / 2;

      doc.addPage([fixedPage.width, fixedPage.height]);
      editableImages.push({
        name: file.name,
        pageIndex,
        dataUrl,
        rect: { x, y, width: drawWidth, height: drawHeight },
      });
    } catch (err) {
      console.warn(`Could not add image "${file.name}" to the PDF:`, err);
      skipped.push(file.name);
    }
  }

  if (doc.getPageCount() === 0) {
    throw new Error('None of the selected images could be converted');
  }

  doc.setProducer('SPADE');
  doc.setCreator('SPADE');

  return {
    bytes: await doc.save(),
    pageCount: doc.getPageCount(),
    skipped,
    images: editableImages,
  };
}

/**
 * Renders selected pages of a PDF to PNG or JPEG images at the requested DPI.
 */
export async function renderPdfPagesToImages(
  pdfBytes: Uint8Array,
  options: PdfImageExportOptions
): Promise<ExportedPageImage[]> {
  const pages = Array.from(new Set(options.pages)).sort((a, b) => a - b);
  if (pages.length === 0) {
    throw new Error('No pages were selected');
  }

  const pdf = await PdfService.loadProxy(pdfBytes);
  const scale = Math.max(0.1, options.dpi / POINTS_PER_INCH);
  const results: ExportedPageImage[] = [];
  const total = pages.length;

  try {
    for (let index = 0; index < pages.length; index++) {
      const pageNumber = pages[index];
      if (pageNumber < 1 || pageNumber > pdf.numPages) {
        throw new Error(`Page ${pageNumber} is outside the document`);
      }

      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Could not create a canvas context');

      // PDF pages have no background colour of their own.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvas,
        canvasContext: ctx,
        viewport,
        intent: 'display',
      }).promise;

      const mimeType = options.format === 'png' ? 'image/png' : 'image/jpeg';
      const bytes = await canvasToBytes(
        canvas,
        mimeType,
        options.format === 'jpeg' ? 0.92 : undefined
      );

      results.push({ pageNumber, bytes, format: options.format });
      page.cleanup();

      options.onProgress?.(index + 1, total);
    }
  } finally {
    await pdf.cleanup();
  }

  return results;
}
