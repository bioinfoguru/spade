import type { Rect } from '@/types/geometry';
import type {
  AnnotationData,
  HighlightAnnotationData,
  InkAnnotationData,
  InsertedImageObject,
  InsertedTextObject,
  NoteAnnotationData,
  ShapeAnnotationData,
} from '@/types/operations';
import type {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  RGB,
} from 'pdf-lib';

export interface PdfPageExportState {
  sourceIndex: number;
  /** Additional clockwise rotation applied by the user, in degrees. */
  rotation: number;
  /** Crop rectangle in PDF user-space points, or null for the full page. */
  crop: Rect | null;
}

export interface PdfAnnotationExportData {
  annotations: readonly AnnotationData[];
  textObjects: readonly InsertedTextObject[];
  imageObjects: readonly InsertedImageObject[];
}

interface ExportContext {
  pdfDoc: PDFDocument;
  fonts: Map<string, PDFFont>;
  images: Map<string, PDFImage>;
}

/** Color helpers */
function hexToRgb(value: string | undefined): RGB {
  const fallback = rgb(0, 0, 0);
  if (!value) return fallback;

  const named: Record<string, RGB> = {
    black: rgb(0, 0, 0),
    white: rgb(1, 1, 1),
    red: rgb(1, 0, 0),
    blue: rgb(0, 0, 1),
    yellow: rgb(1, 1, 0),
    amber: rgb(0.96, 0.62, 0.04),
  };
  if (named[value.toLowerCase()]) return named[value.toLowerCase()];

  let hex = value.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  if (hex.length !== 6) return fallback;
  const n = parseInt(hex, 16);
  if (Number.isNaN(n)) return fallback;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// Imported lazily so the rest of this module stays tree-shakeable.
let pdfLib: typeof import('pdf-lib') | null = null;

function rgb(r: number, g: number, b: number): RGB {
  if (!pdfLib) throw new Error('pdf-lib is not loaded');
  return pdfLib.rgb(r, g, b);
}

function degrees(value: number) {
  if (!pdfLib) throw new Error('pdf-lib is not loaded');
  return pdfLib.degrees(value);
}

function StandardFonts() {
  if (!pdfLib) throw new Error('pdf-lib is not loaded');
  return pdfLib.StandardFonts;
}

/** Decode a base64 image data URL into bytes pdf-lib can embed. */
function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; kind: 'png' | 'jpg' } | null {
  const match = /^data:image\/(png|jpeg|jpg);base64,(.*)$/i.exec(dataUrl);
  if (!match) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { bytes, kind: match[1].toLowerCase() === 'png' ? 'png' : 'jpg' };
}

async function getFont(
  ctx: ExportContext,
  family: string,
  isBold: boolean,
  isItalic: boolean
): Promise<PDFFont> {
  const fonts = StandardFonts();
  let standard = fonts.Helvetica;
  const normalized = family.toLowerCase();

  if (normalized.includes('times')) {
    standard = isBold
      ? isItalic ? fonts.TimesRomanBoldItalic : fonts.TimesRomanBold
      : isItacticSafe(isItalic, fonts.TimesRomanItalic, fonts.TimesRoman);
  } else if (normalized.includes('courier')) {
    standard = isBold
      ? isItalic ? fonts.CourierBoldOblique : fonts.CourierBold
      : isItacticSafe(isItalic, fonts.CourierOblique, fonts.Courier);
  } else if (normalized.includes('georgia') || normalized.includes('serif')) {
    standard = isBold ? fonts.TimesRomanBold : fonts.TimesRoman;
  } else {
    standard = isBold
      ? isItalic ? fonts.HelveticaBoldOblique : fonts.HelveticaBold
      : isItacticSafe(isItalic, fonts.HelveticaOblique, fonts.Helvetica);
  }

  const key = standard;
  let font = ctx.fonts.get(key);
  if (!font) {
    font = await ctx.pdfDoc.embedFont(standard);
    ctx.fonts.set(key, font);
  }
  return font;
}

function isItacticSafe<T>(italic: boolean, italicValue: T, normalValue: T): T {
  return italic ? italicValue : normalValue;
}

async function getImage(ctx: ExportContext, dataUrl: string): Promise<PDFImage | null> {
  const cached = ctx.images.get(dataUrl);
  if (cached) return cached;

  const decoded = dataUrlToBytes(dataUrl);
  if (!decoded) return null;

  const image = decoded.kind === 'png'
    ? await ctx.pdfDoc.embedPng(decoded.bytes)
    : await ctx.pdfDoc.embedJpg(decoded.bytes);
  ctx.images.set(dataUrl, image);
  return image;
}

function drawHighlight(annot: HighlightAnnotationData, page: PDFPage) {
  page.drawRectangle({
    x: annot.rect.x,
    y: annot.rect.y,
    width: annot.rect.width,
    height: annot.rect.height,
    color: hexToRgb(annot.color),
    opacity: annot.opacity ?? 0.5,
  });
}

function drawTextMark(annot: HighlightAnnotationData, page: PDFPage, kind: 'underline' | 'strikeout') {
  const y = kind === 'underline' ? annot.rect.y : annot.rect.y + annot.rect.height / 2;
  page.drawLine({
    start: { x: annot.rect.x, y },
    end: { x: annot.rect.x + annot.rect.width, y },
    color: hexToRgb(annot.color),
    thickness: 1.5,
    opacity: annot.opacity ?? 1,
  });
}

function drawInk(annot: InkAnnotationData, page: PDFPage) {
  for (const path of annot.paths) {
    for (let i = 1; i < path.length; i++) {
      page.drawLine({
        start: { x: path[i - 1].x, y: path[i - 1].y },
        end: { x: path[i].x, y: path[i].y },
        color: hexToRgb(annot.color),
        thickness: annot.strokeWidth,
        opacity: annot.opacity,
      });
    }
  }
}

function drawShape(annot: ShapeAnnotationData, page: PDFPage) {
  const color = hexToRgb(annot.color);
  const fill = annot.fillColor && annot.fillColor !== 'none'
    ? hexToRgb(annot.fillColor)
    : undefined;
  const opacity = annot.opacity;

  if (annot.type === 'square') {
    page.drawRectangle({
      x: annot.rect.x,
      y: annot.rect.y,
      width: annot.rect.width,
      height: annot.rect.height,
      color: fill,
      borderColor: color,
      borderWidth: annot.strokeWidth,
      opacity,
    });
  } else if (annot.type === 'circle') {
    page.drawEllipse({
      x: annot.rect.x + annot.rect.width / 2,
      y: annot.rect.y + annot.rect.height / 2,
      xScale: Math.max(0.5, annot.rect.width / 2),
      yScale: Math.max(0.5, annot.rect.height / 2),
      color: fill,
      borderColor: color,
      borderWidth: annot.strokeWidth,
      opacity,
    });
  } else {
    const start = annot.startPoint || { x: annot.rect.x, y: annot.rect.y };
    const end = annot.endPoint || {
      x: annot.rect.x + annot.rect.width,
      y: annot.rect.y + annot.rect.height,
    };
    page.drawLine({
      start,
      end,
      color,
      thickness: annot.strokeWidth,
      opacity,
    });
  }
}

function drawNote(annot: NoteAnnotationData, page: PDFPage, font: PDFFont) {
  page.drawRectangle({
    x: annot.rect.x,
    y: annot.rect.y,
    width: Math.max(annot.rect.width, 18),
    height: Math.max(annot.rect.height, 18),
    color: rgb(1, 0.84, 0.36),
    borderColor: rgb(0.7, 0.45, 0.05),
    borderWidth: 1,
    opacity: annot.opacity,
  });
  const text = annot.contents || 'Note';
  page.drawText(text.slice(0, 120), {
    x: annot.rect.x + 3,
    y: annot.rect.y + Math.max(annot.rect.height, 18) - 12,
    size: 8,
    font,
    color: rgb(0.2, 0.15, 0.05),
  });
}

async function drawTextObject(
  ctx: ExportContext,
  textObj: InsertedTextObject,
  page: PDFPage
) {
  const font = await getFont(ctx, textObj.fontFamily, textObj.isBold, textObj.isItalic);
  const lines = String(textObj.text || '').split('\n');
  const lineHeight = textObj.fontSize * 1.2;
  let y = textObj.rect.y + textObj.rect.height - textObj.fontSize;

  for (const line of lines) {
    const width = font.widthOfTextAtSize(line, textObj.fontSize);
    let x = textObj.rect.x;
    if (textObj.alignment === 'center') {
      x = textObj.rect.x + Math.max(0, (textObj.rect.width - width) / 2);
    } else if (textObj.alignment === 'right') {
      x = textObj.rect.x + Math.max(0, textObj.rect.width - width);
    }

    page.drawText(line, {
      x,
      y,
      size: textObj.fontSize,
      font,
      color: hexToRgb(textObj.color),
      opacity: textObj.opacity,
    });
    y -= lineHeight;
  }
}

async function drawImageObject(
  ctx: ExportContext,
  imageObj: InsertedImageObject,
  page: PDFPage
) {
  const image = await getImage(ctx, imageObj.imageDataUrl);
  if (!image) return;

  page.drawImage(image, {
    x: imageObj.rect.x,
    y: imageObj.rect.y,
    width: imageObj.rect.width,
    height: imageObj.rect.height,
    rotate: degrees(imageObj.rotation || 0),
    opacity: imageObj.opacity,
  });
}

async function flattenPage(
  ctx: ExportContext,
  page: PDFPage,
  sourceIndex: number,
  data: PdfAnnotationExportData
) {
  const pageNotes = data.annotations.filter(
    (a) => a.pageIndex === sourceIndex && a.type === 'note'
  );
  const noteFont = pageNotes.length
    ? await getFont(ctx, 'Helvetica, sans-serif', false, false)
    : null;

  for (const annot of data.annotations) {
    if (annot.pageIndex !== sourceIndex) continue;
    if (annot.type === 'highlight') drawHighlight(annot, page);
    else if (annot.type === 'underline' || annot.type === 'strikeout') drawTextMark(annot, page, annot.type);
    else if (annot.type === 'ink') drawInk(annot, page);
    else if (annot.type === 'square' || annot.type === 'circle' || annot.type === 'line') drawShape(annot, page);
    else if (annot.type === 'note' && noteFont) drawNote(annot, page, noteFont);
  }

  for (const textObj of data.textObjects) {
    if (textObj.pageIndex === sourceIndex) {
      await drawTextObject(ctx, textObj, page);
    }
  }

  for (const imageObj of data.imageObjects) {
    if (imageObj.pageIndex === sourceIndex) {
      await drawImageObject(ctx, imageObj, page);
    }
  }
}

/**
 * Builds a PDF with the current page order, duplicates, deletions, crops,
 * rotations, and all on-page markup applied. The original document is modified
 * in place so document-level structures are preserved.
 */
export async function buildEditedPdfBytes(
  originalBytes: Uint8Array,
  pageStates: readonly PdfPageExportState[],
  data: PdfAnnotationExportData
): Promise<Uint8Array> {
  const lib = await import('pdf-lib');
  pdfLib = lib;
  const { PDFDocument } = lib;

  if (pageStates.length === 0) {
    throw new Error('Cannot save a PDF with no pages');
  }

  const doc = await PDFDocument.load(originalBytes);
  const originalPages = doc.getPages().slice();
  const originalPageCount = originalPages.length;

  const finalPages: PDFPage[] = [];
  const finalStates: PdfPageExportState[] = [];
  const occurrenceBySource = new Map<number, number>();

  for (const state of pageStates) {
    const sourceIndex = state.sourceIndex;
    if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= originalPageCount) {
      continue;
    }

    const occurrence = occurrenceBySource.get(sourceIndex) ?? 0;
    if (occurrence === 0) {
      finalPages.push(originalPages[sourceIndex]);
    } else {
      const [copy] = await doc.copyPages(doc, [sourceIndex]);
      finalPages.push(copy);
    }

    occurrenceBySource.set(sourceIndex, occurrence + 1);
    finalStates.push(state);
  }

  if (finalPages.length === 0) {
    throw new Error('No valid pages available to save');
  }

  for (let i = doc.getPageCount() - 1; i >= 0; i--) {
    doc.removePage(i);
  }
  finalPages.forEach((page, index) => {
    doc.insertPage(index, page);
  });

  const ctx: ExportContext = {
    pdfDoc: doc,
    fonts: new Map(),
    images: new Map(),
  };

  finalStates.forEach((state, index) => {
    const page = finalPages[index];
    if (!page) return;

    if (state.rotation) {
      const nativeRotation = page.getRotation().angle || 0;
      page.setRotation(degrees(((nativeRotation + state.rotation) % 360 + 360) % 360));
    }

    if (state.crop) {
      const existingBox = page.getCropBox();
      page.setCropBox(
        existingBox.x + state.crop.x,
        existingBox.y + state.crop.y,
        state.crop.width,
        state.crop.height
      );
    }
  });

  for (let i = 0; i < finalStates.length; i++) {
    const state = finalStates[i];
    const page = finalPages[i];
    if (!state || !page) continue;
    await flattenPage(ctx, page, state.sourceIndex, data);
  }

  return await doc.save();
}
