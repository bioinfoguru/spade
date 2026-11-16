import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { DocumentOperation } from '@/types/operations';
import { useOperationStore } from './operationStore';
import { useDocumentStore } from './documentStore';
import { useViewerStore } from './viewerStore';

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

  // Keep the viewer's page count in sync after page-level operations
  function syncPageCount() {
    const opStore = useOperationStore();
    const viewerStore = useViewerStore();
    viewerStore.totalPages = Math.max(1, opStore.pages.length);
    if (viewerStore.currentPage > viewerStore.totalPages) {
      viewerStore.setPage(viewerStore.totalPages);
    }
  }

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
    syncPageCount();
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
    syncPageCount();
  }

  function redo() {
    if (redoStack.value.length === 0) return;
    const op = redoStack.value.pop()!;
    const opStore = useOperationStore();
    const docStore = useDocumentStore();

    opStore.applyOperation(op);
    undoStack.value.push(op);
    docStore.markDirty(true);
    syncPageCount();
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
      case 'transform_annotation': {
        const item = opStore.annotations.find((a) => a.id === op.inversePayload.annotationId);
        if (item) {
          if (op.inversePayload.updates.rect) {
            item.rect = op.inversePayload.updates.rect;
          }
          if (item.type === 'ink' && op.inversePayload.updates.paths) {
            item.paths = op.inversePayload.updates.paths;
          }
          if (op.inversePayload.updates.contents !== undefined) {
            item.contents = op.inversePayload.updates.contents;
          }
        }
        break;
      }
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
      case 'transform_image': {
        const item = opStore.imageObjects.find((i) => i.id === op.inversePayload.imageObjectId);
        if (item) {
          item.rect = op.inversePayload.updates.rect;
        }
        break;
      }
      case 'reorder_pages': {
        const [moved] = opStore.pages.splice(op.payload.toIndex, 1);
        if (moved) {
          opStore.pages.splice(op.payload.fromIndex, 0, moved);
        }
        break;
      }
      case 'duplicate_page': {
        opStore.pages = opStore.pages.filter((p) => p.id !== op.inversePayload.pageId);
        delete opStore.pageRotations[op.inversePayload.pageId];
        delete opStore.pageCrops[op.inversePayload.pageId];
        break;
      }
      case 'rotate_page': {
        const current = opStore.pageRotations[op.payload.pageId] || 0;
        opStore.pageRotations[op.payload.pageId] = (current - op.payload.angleDegrees + 360) % 360;
        break;
      }
      case 'delete_page': {
        opStore.pages.splice(op.inversePayload.index, 0, op.inversePayload.page);
        break;
      }
      case 'crop_page': {
        if (op.inversePayload.crop) {
          opStore.pageCrops[op.inversePayload.pageId] = op.inversePayload.crop;
        } else {
          delete opStore.pageCrops[op.inversePayload.pageId];
        }
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

