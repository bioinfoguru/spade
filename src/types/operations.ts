import { Rect, Point } from './geometry';
import { PageRef } from './pdf';

export type AnnotationType = 'highlight' | 'underline' | 'strikeout' | 'ink' | 'square' | 'circle' | 'line' | 'note';

export interface BaseAnnotationData {
  id: string;
  pageIndex: number;
  type: AnnotationType;
  rect: Rect; // In PDF User Space Points
  color: string;
  opacity: number;
  author?: string;
  contents?: string;
  createdAt: number;
}

export interface HighlightAnnotationData extends BaseAnnotationData {
  type: 'highlight' | 'underline' | 'strikeout';
  quadPoints?: number[];
}

export interface InkAnnotationData extends BaseAnnotationData {
  type: 'ink';
  paths: Point[][];
  strokeWidth: number;
}

export interface ShapeAnnotationData extends BaseAnnotationData {
  type: 'square' | 'circle' | 'line';
  fillColor?: string;
  strokeWidth: number;
  startPoint?: Point;
  endPoint?: Point;
}

export interface NoteAnnotationData extends BaseAnnotationData {
  type: 'note';
  icon: string;
}

export type AnnotationData = 
  | HighlightAnnotationData 
  | InkAnnotationData 
  | ShapeAnnotationData 
  | NoteAnnotationData;

export interface InsertedTextObject {
  id: string;
  pageIndex: number;
  rect: Rect; // In PDF User Space Points
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  isBold: boolean;
  isItalic: boolean;
  alignment: 'left' | 'center' | 'right';
  opacity: number;
}

export interface InsertedImageObject {
  id: string;
  pageIndex: number;
  rect: Rect; // In PDF User Space Points
  imageDataUrl: string;
  rotation: number;
  opacity: number;
}

export interface RedactionMark {
  id: string;
  pageIndex: number;
  rect: Rect; // In PDF User Space Points
  overlayText?: string;
  fillColor: string;
}

/** Geometry updates used when dragging an existing annotation. */
export interface AnnotationTransform {
  rect?: Rect;
  paths?: Point[][];
  contents?: string;
}

/* Discriminated Document Operations */
export type DocumentOperation =
  | {
      id: string;
      type: "add_annotation";
      documentId: string;
      documentRevision: number;
      payload: { annotation: AnnotationData };
      inversePayload: { annotationId: string; pageIndex: number };
      timestamp: number;
    }
  | {
      id: string;
      type: "delete_annotation";
      documentId: string;
      documentRevision: number;
      payload: { annotationId: string; pageIndex: number };
      inversePayload: { annotation: AnnotationData };
      timestamp: number;
    }
  | {
      id: string;
      type: "transform_annotation";
      documentId: string;
      documentRevision: number;
      payload: { annotationId: string; pageIndex: number; updates: AnnotationTransform };
      inversePayload: { annotationId: string; pageIndex: number; updates: AnnotationTransform };
      timestamp: number;
    }
  | {
      id: string;
      type: "insert_text_box";
      documentId: string;
      documentRevision: number;
      payload: { textObject: InsertedTextObject };
      inversePayload: { textObjectId: string; pageIndex: number };
      timestamp: number;
    }
  | {
      id: string;
      type: "transform_text_box";
      documentId: string;
      documentRevision: number;
      payload: { textObjectId: string; pageIndex: number; updates: Partial<InsertedTextObject> };
      inversePayload: { textObjectId: string; pageIndex: number; updates: Partial<InsertedTextObject> };
      timestamp: number;
    }
  | {
      id: string;
      type: "delete_text_box";
      documentId: string;
      documentRevision: number;
      payload: { textObjectId: string; pageIndex: number };
      inversePayload: { textObject: InsertedTextObject };
      timestamp: number;
    }
  | {
      id: string;
      type: "insert_image";
      documentId: string;
      documentRevision: number;
      payload: { imageObject: InsertedImageObject };
      inversePayload: { imageObjectId: string; pageIndex: number };
      timestamp: number;
    }
  | {
      id: string;
      type: "delete_image";
      documentId: string;
      documentRevision: number;
      payload: { imageObjectId: string; pageIndex: number };
      inversePayload: { imageObject: InsertedImageObject };
      timestamp: number;
    }
  | {
      id: string;
      type: "transform_image";
      documentId: string;
      documentRevision: number;
      payload: { imageObjectId: string; pageIndex: number; updates: { rect: Rect } };
      inversePayload: { imageObjectId: string; pageIndex: number; updates: { rect: Rect } };
      timestamp: number;
    }
  | {
      id: string;
      type: "reorder_pages";
      documentId: string;
      documentRevision: number;
      payload: { fromIndex: number; toIndex: number };
      inversePayload: { fromIndex: number; toIndex: number };
      timestamp: number;
    }
  | {
      id: string;
      type: "duplicate_page";
      documentId: string;
      documentRevision: number;
      payload: { page: PageRef; insertIndex: number; rotation: number; crop?: Rect | null };
      inversePayload: { pageId: string };
      timestamp: number;
    }
  | {
      id: string;
      type: "rotate_page";
      documentId: string;
      documentRevision: number;
      payload: { pageId: string; angleDegrees: 90 | -90 | 180 };
      inversePayload: { pageId: string; angleDegrees: 90 | -90 | 180 };
      timestamp: number;
    }
  | {
      id: string;
      type: "delete_page";
      documentId: string;
      documentRevision: number;
      payload: { pageId: string };
      inversePayload: { page: PageRef; index: number };
      timestamp: number;
    }
  | {
      id: string;
      type: "crop_page";
      documentId: string;
      documentRevision: number;
      payload: { pageId: string; crop: Rect | null };
      inversePayload: { pageId: string; crop: Rect | null };
      timestamp: number;
    }
  | {
      id: string;
      type: "update_form_value";
      documentId: string;
      documentRevision: number;
      payload: { fieldName: string; value: string | boolean | string[] };
      inversePayload: { fieldName: string; value: string | boolean | string[] };
      timestamp: number;
    }
  | {
      id: string;
      type: "mark_redaction";
      documentId: string;
      documentRevision: number;
      payload: { mark: RedactionMark };
      inversePayload: { markId: string; pageIndex: number };
      timestamp: number;
    };

