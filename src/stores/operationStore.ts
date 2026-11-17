import { defineStore } from 'pinia';
import { ref } from 'vue';
import { 
  AnnotationData, 
  InsertedTextObject, 
  InsertedImageObject, 
  RedactionMark, 
  DocumentOperation 
} from '@/types/operations';
import { PageRef } from '@/types/pdf';
import { Rect } from '@/types/geometry';

export const useOperationStore = defineStore('operations', () => {
  const currentRevision = ref(0);
  const annotations = ref<AnnotationData[]>([]);
  const textObjects = ref<InsertedTextObject[]>([]);
  const imageObjects = ref<InsertedImageObject[]>([]);
  const redactionMarks = ref<RedactionMark[]>([]);
  const pages = ref<PageRef[]>([]);
  const pageRotations = ref<Record<string, number>>({});
  const pageCrops = ref<Record<string, Rect>>({});
  const pageSizes = ref<Record<number, { width: number; height: number }>>({});
  const pageNativeRotations = ref<Record<number, number>>({});
  const formValues = ref<Record<string, any>>({});

  // Chronological operation log
  const operationLog = ref<DocumentOperation[]>([]);

  let pageIdCounter = 0;

  function createPageRef(sourceIndex: number): PageRef {
    pageIdCounter += 1;
    return { id: `page-${pageIdCounter}`, sourceIndex };
  }

  function setPageSize(sourceIndex: number, width: number, height: number) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    const current = pageSizes.value[sourceIndex];
    if (current && Math.abs(current.width - width) < 0.01 && Math.abs(current.height - height) < 0.01) {
      return;
    }
    pageSizes.value[sourceIndex] = { width, height };
  }

  function setPageNativeRotation(sourceIndex: number, rotation: number) {
    const normalized = (((rotation % 360) + 360) % 360) as 0 | 90 | 180 | 270;
    if (![0, 90, 180, 270].includes(normalized)) return;
    pageNativeRotations.value[sourceIndex] = normalized;
  }

  function initDocument(pageCount: number) {
    currentRevision.value = 0;
    annotations.value = [];
    textObjects.value = [];
    imageObjects.value = [];
    redactionMarks.value = [];
    pageIdCounter = 0;
    pages.value = Array.from({ length: pageCount }, (_, i) => createPageRef(i));
    pageRotations.value = {};
    pageCrops.value = {};
    pageSizes.value = {};
    pageNativeRotations.value = {};
    formValues.value = {};
    operationLog.value = [];
  }

  function applyOperation(op: DocumentOperation) {
    operationLog.value.push(op);
    currentRevision.value = op.documentRevision;

    switch (op.type) {
      case 'add_annotation':
        annotations.value.push(op.payload.annotation);
        break;
      case 'delete_annotation':
        annotations.value = annotations.value.filter(
          (a) => a.id !== op.payload.annotationId
        );
        break;
      case 'transform_annotation': {
        const item = annotations.value.find((a) => a.id === op.payload.annotationId);
        if (item) {
          if (op.payload.updates.rect) {
            item.rect = op.payload.updates.rect;
          }
          if (item.type === 'ink' && op.payload.updates.paths) {
            item.paths = op.payload.updates.paths;
          }
          if (op.payload.updates.contents !== undefined) {
            item.contents = op.payload.updates.contents;
          }
        }
        break;
      }
      case 'insert_text_box':
        textObjects.value.push(op.payload.textObject);
        break;
      case 'transform_text_box': {
        const item = textObjects.value.find((t) => t.id === op.payload.textObjectId);
        if (item) {
          Object.assign(item, op.payload.updates);
        }
        break;
      }
      case 'delete_text_box':
        textObjects.value = textObjects.value.filter(
          (t) => t.id !== op.payload.textObjectId
        );
        break;
      case 'insert_image':
        imageObjects.value.push(op.payload.imageObject);
        break;
      case 'delete_image':
        imageObjects.value = imageObjects.value.filter(
          (img) => img.id !== op.payload.imageObjectId
        );
        break;
      case 'transform_image': {
        const item = imageObjects.value.find((img) => img.id === op.payload.imageObjectId);
        if (item) {
          Object.assign(item, op.payload.updates);
        }
        break;
      }
      case 'reorder_pages': {
        const [moved] = pages.value.splice(op.payload.fromIndex, 1);
        if (moved) {
          pages.value.splice(op.payload.toIndex, 0, moved);
        }
        break;
      }
      case 'duplicate_page': {
        pages.value.splice(op.payload.insertIndex, 0, op.payload.page);
        pageRotations.value[op.payload.page.id] = op.payload.rotation;
        if (op.payload.crop) {
          pageCrops.value[op.payload.page.id] = op.payload.crop;
        }
        break;
      }
      case 'rotate_page': {
        const current = pageRotations.value[op.payload.pageId] || 0;
        pageRotations.value[op.payload.pageId] = (current + op.payload.angleDegrees + 360) % 360;
        break;
      }
      case 'delete_page': {
        pages.value = pages.value.filter((p) => p.id !== op.payload.pageId);
        break;
      }
      case 'crop_page': {
        if (op.payload.crop) {
          pageCrops.value[op.payload.pageId] = op.payload.crop;
        } else {
          delete pageCrops.value[op.payload.pageId];
        }
        break;
      }
      case 'update_form_value': {
        formValues.value[op.payload.fieldName] = op.payload.value;
        break;
      }
      case 'mark_redaction': {
        redactionMarks.value.push(op.payload.mark);
        break;
      }
    }
  }

  return {
    currentRevision,
    annotations,
    textObjects,
    imageObjects,
    redactionMarks,
    pages,
    pageRotations,
    pageCrops,
    pageSizes,
    pageNativeRotations,
    formValues,
    operationLog,
    initDocument,
    createPageRef,
    setPageSize,
    setPageNativeRotation,
    applyOperation,
  };
});

