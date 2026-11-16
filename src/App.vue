<template>
  <div class="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden font-sans select-none">
    <!-- Hidden file inputs for opening documents and inserting images -->
    <input
      ref="fileInputRef"
      type="file"
      accept="application/pdf"
      class="hidden"
      @change="onFileSelected"
    />
    <input
      ref="imageInputRef"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/svg+xml"
      class="hidden"
      @change="onImageSelected"
    />

    <!-- 1. Top Title Bar -->
    <AppHeader
      @open-file="triggerOpenFile"
      @save-file="triggerSaveFile"
    />

    <!-- 2. Main Action Toolbar -->
    <MainToolbar
      @add-image="triggerAddImage"
    />

    <!-- 3. Central Workspace (Left Sidebar + Viewer + Right Sidebar) -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- Left Navigation Panel -->
      <LeftSidebar />

      <!-- Center Document Viewport -->
      <PdfViewer
        @open-file="triggerOpenFile"
      />

      <!-- Right Contextual Properties Panel -->
      <RightSidebar />
    </div>

    <!-- 4. Bottom Status Bar -->
    <StatusBar />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import AppHeader from '@/components/layout/AppHeader.vue';
import MainToolbar from '@/components/layout/MainToolbar.vue';
import LeftSidebar from '@/components/layout/LeftSidebar.vue';
import RightSidebar from '@/components/layout/RightSidebar.vue';
import StatusBar from '@/components/layout/StatusBar.vue';
import PdfViewer from '@/components/viewer/PdfViewer.vue';
import { useDocumentStore } from '@/stores/documentStore';
import { useViewerStore } from '@/stores/viewerStore';
import { useOperationStore } from '@/stores/operationStore';
import { useHistoryStore } from '@/stores/historyStore';
import { useAppStore } from '@/stores/appStore';
import { PdfService } from '@/services/pdfWorker';
import { InsertedImageObject } from '@/types/operations';

const docStore = useDocumentStore();
const viewerStore = useViewerStore();
const opStore = useOperationStore();
const historyStore = useHistoryStore();
const appStore = useAppStore();

const fileInputRef = ref<HTMLInputElement | null>(null);
const imageInputRef = ref<HTMLInputElement | null>(null);

// Trigger file opening via native Tauri dialog or browser file input fallback
async function triggerOpenFile() {
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
    });

    if (selected && typeof selected === 'string') {
      const fileBytes = await readFile(selected);
      await loadPdfData(fileBytes, selected, selected.split(/[\\/]/).pop() || 'document.pdf');
    } else if (fileInputRef.value) {
      fileInputRef.value.click();
    }
  } catch {
    // Web fallback if running without Tauri runtime
    fileInputRef.value?.click();
  }
}

// Browser input fallback
async function onFileSelected(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);
  await loadPdfData(fileBytes, file.name, file.name);
  target.value = ''; // Reset input
}

// Core PDF loading pipeline
async function loadPdfData(bytes: Uint8Array, filePath: string, fileName: string) {
  docStore.isLoading = true;
  try {
    const loaded = await PdfService.loadDocument(bytes);
    
    docStore.setCurrentDoc(
      {
        id: `doc-${Date.now()}`,
        filePath,
        fileName,
        metadata: loaded.metadata,
        outline: loaded.outline,
        isDirty: false,
        lastSavedAt: Date.now(),
      },
      loaded.pdfDocument,
      bytes
    );

    viewerStore.totalPages = loaded.numPages;
    viewerStore.currentPage = 1;
    opStore.initDocument(loaded.numPages);
    historyStore.clearHistory();
  } catch (err) {
    console.error('Failed to load PDF document:', err);
    alert('Failed to parse PDF document. It may be corrupted or encrypted.');
  } finally {
    docStore.isLoading = false;
  }
}

// Save document pipeline
async function triggerSaveFile() {
  if (!docStore.currentDoc || !docStore.pdfBytes) return;

  try {
    const destination = await save({
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
      defaultPath: docStore.currentDoc.fileName,
    });

    if (destination) {
      // In production, the Rust backend compiles the operations into the PDF.
      // For baseline saving, write the validated bytes atomically.
      await writeFile(destination, docStore.pdfBytes);
      docStore.markDirty(false);
      alert(`Document saved successfully to: ${destination}`);
    }
  } catch (err) {
    console.error('Failed to save document:', err);
    // Web download fallback
    const blob = new Blob([docStore.pdfBytes as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = docStore.currentDoc.fileName;
    a.click();
    URL.revokeObjectURL(url);
    docStore.markDirty(false);
  }
}

// Image insertion handler
function triggerAddImage() {
  imageInputRef.value?.click();
}

function onImageSelected(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target?.result as string;
    if (!dataUrl) return;

    const pageIdx = viewerStore.currentPage - 1;
    const newImage: InsertedImageObject = {
      id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      pageIndex: pageIdx,
      rect: {
        x: 100,
        y: 400,
        width: 200,
        height: 150,
      },
      imageDataUrl: dataUrl,
      rotation: 0,
      opacity: 1.0,
    };

    historyStore.pushOperation({
      id: `op-${Date.now()}`,
      type: 'insert_image',
      documentId: 'doc',
      documentRevision: opStore.currentRevision + 1,
      payload: { imageObject: newImage },
      inversePayload: { imageObjectId: newImage.id, pageIndex: pageIdx },
      timestamp: Date.now(),
    });
  };
  reader.readAsDataURL(file);
  target.value = '';
}

// Keyboard shortcuts dispatcher
function onKeyDown(e: KeyboardEvent) {
  const isCtrlOrCmd = e.ctrlKey || e.metaKey;

  if (isCtrlOrCmd && e.key.toLowerCase() === 'o') {
    e.preventDefault();
    triggerOpenFile();
  } else if (isCtrlOrCmd && e.key.toLowerCase() === 's') {
    e.preventDefault();
    triggerSaveFile();
  } else if (isCtrlOrCmd && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) {
      historyStore.redo();
    } else {
      historyStore.undo();
    }
  } else if (isCtrlOrCmd && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    historyStore.redo();
  } else if (isCtrlOrCmd && (e.key === '=' || e.key === '+')) {
    e.preventDefault();
    viewerStore.zoomIn();
  } else if (isCtrlOrCmd && e.key === '-') {
    e.preventDefault();
    viewerStore.zoomOut();
  } else if (e.key === 'Escape') {
    appStore.setTool('select');
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown);
});
</script>
