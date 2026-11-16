import { defineStore } from 'pinia';
import { ref } from 'vue';
import { 
  AnnotationData, 
  InsertedTextObject, 
  InsertedImageObject, 
  RedactionMark, 
  DocumentOperation 
} from '@/types/operations';

export const useOperationStore = defineStore('operations', () => {
  const currentRevision = ref(0);
  const annotations = ref<AnnotationData[]>([]);
  const textObjects = ref<InsertedTextObject[]>([]);
  const imageObjects = ref<InsertedImageObject[]>([]);
  const redactionMarks = ref<RedactionMark[]>([]);
  const pageOrder = ref<number[]>([]);
  const pageRotations = ref<Record<number, number>>({});
  const formValues = ref<Record<string, any>>({});

  // Chronological operation log
  const operationLog = ref<DocumentOperation[]>([]);

  function initDocument(pageCount: number) {
    currentRevision.value = 0;
    annotations.value = [];
    textObjects.value = [];
    imageObjects.value = [];
    redactionMarks.value = [];
    pageOrder.value = Array.from({ length: pageCount }, (_, i) => i);
    pageRotations.value = {};
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
      case 'reorder_pages': {
        const [moved] = pageOrder.value.splice(op.payload.fromIndex, 1);
        pageOrder.value.splice(op.payload.toIndex, 0, moved);
        break;
      }
      case 'rotate_page': {
        const current = pageRotations.value[op.payload.pageIndex] || 0;
        pageRotations.value[op.payload.pageIndex] = (current + op.payload.angleDegrees + 360) % 360;
        break;
      }
      case 'delete_page': {
        pageOrder.value = pageOrder.value.filter((p) => p !== op.payload.pageIndex);
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
    pageOrder,
    pageRotations,
    formValues,
    operationLog,
    initDocument,
    applyOperation,
  };
});
