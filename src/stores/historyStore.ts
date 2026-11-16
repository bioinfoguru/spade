import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { DocumentOperation } from '@/types/operations';
import { useOperationStore } from './operationStore';
import { useDocumentStore } from './documentStore';

export const useHistoryStore = defineStore('history', () => {
  const undoStack = ref<DocumentOperation[]>([]);
  const redoStack = ref<DocumentOperation[]>([]);
  const maxHistory = 50;

  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);
  const lastActionName = computed(() => {
    if (undoStack.value.length === 0) return '';
    const lastOp = undoStack.value[undoStack.value.length - 1];
    return formatOpName(lastOp.type);
  });

  function formatOpName(type: string): string {
    return type
      .split('_')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
  }

  function pushOperation(op: DocumentOperation) {
    const opStore = useOperationStore();
    const docStore = useDocumentStore();

    opStore.applyOperation(op);
    undoStack.value.push(op);
    if (undoStack.value.length > maxHistory) {
      undoStack.value.shift();
    }
    redoStack.value = []; // Clear redo stack on new operation
    docStore.markDirty(true);
  }

  function undo() {
    if (undoStack.value.length === 0) return;
    const op = undoStack.value.pop()!;
    const opStore = useOperationStore();
    const docStore = useDocumentStore();

    // Invert the operation
    revertOperation(op, opStore);
    redoStack.value.push(op);
    docStore.markDirty(true);
  }

  function redo() {
    if (redoStack.value.length === 0) return;
    const op = redoStack.value.pop()!;
    const opStore = useOperationStore();
    const docStore = useDocumentStore();

    opStore.applyOperation(op);
    undoStack.value.push(op);
    docStore.markDirty(true);
  }

  function revertOperation(op: DocumentOperation, opStore: ReturnType<typeof useOperationStore>) {
    switch (op.type) {
      case 'add_annotation':
        opStore.annotations = opStore.annotations.filter((a) => a.id !== op.payload.annotation.id);
        break;
      case 'delete_annotation':
        if ('annotation' in op.inversePayload) {
          opStore.annotations.push(op.inversePayload.annotation);
        }
        break;
      case 'insert_text_box':
        opStore.textObjects = opStore.textObjects.filter((t) => t.id !== op.payload.textObject.id);
        break;
      case 'transform_text_box': {
        const item = opStore.textObjects.find((t) => t.id === op.payload.textObjectId);
        if (item && 'updates' in op.inversePayload) {
          Object.assign(item, op.inversePayload.updates);
        }
        break;
      }
      case 'delete_text_box':
        if ('textObject' in op.inversePayload) {
          opStore.textObjects.push(op.inversePayload.textObject);
        }
        break;
      case 'insert_image':
        opStore.imageObjects = opStore.imageObjects.filter((i) => i.id !== op.payload.imageObject.id);
        break;
      case 'delete_image':
        if ('imageObject' in op.inversePayload) {
          opStore.imageObjects.push(op.inversePayload.imageObject);
        }
        break;
      case 'reorder_pages': {
        const [moved] = opStore.pageOrder.splice(op.payload.toIndex, 1);
        opStore.pageOrder.splice(op.payload.fromIndex, 0, moved);
        break;
      }
      case 'rotate_page': {
        const current = opStore.pageRotations[op.payload.pageIndex] || 0;
        opStore.pageRotations[op.payload.pageIndex] = (current - op.payload.angleDegrees + 360) % 360;
        break;
      }
    }
  }

  function clearHistory() {
    undoStack.value = [];
    redoStack.value = [];
  }

  return {
    undoStack,
    redoStack,
    canUndo,
    canRedo,
    lastActionName,
    pushOperation,
    undo,
    redo,
    clearHistory,
  };
});
