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
    <input
      ref="mergeInputRef"
      type="file"
      accept="application/pdf"
      multiple
      class="hidden"
      @change="onMergeFilesSelected"
    />

    <!-- 1. Top Title Bar -->
    <AppHeader
      @open-file="triggerOpenFile"
      @merge-files="triggerMergeFiles"
      @save-file="triggerSaveFile"
      @show-help="helpOpen = true"
    />

    <template v-if="!helpOpen">
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
    </template>
    <HelpPage v-else @back="helpOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { open, save, confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import AppHeader from '@/components/layout/AppHeader.vue';
import MainToolbar from '@/components/layout/MainToolbar.vue';
import LeftSidebar from '@/components/layout/LeftSidebar.vue';
import RightSidebar from '@/components/layout/RightSidebar.vue';
import StatusBar from '@/components/layout/StatusBar.vue';
import PdfViewer from '@/components/viewer/PdfViewer.vue';
import HelpPage from '@/components/layout/HelpPage.vue';
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
const helpOpen = ref(false);

const fileInputRef = ref<HTMLInputElement | null>(null);
const imageInputRef = ref<HTMLInputElement | null>(null);
const mergeInputRef = ref<HTMLInputElement | null>(null);

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

// Merge PDF files into the current document (or combine standalone files).
async function triggerMergeFiles() {
  if (isTauri()) {
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      });
      if (Array.isArray(selected) && selected.length > 0) {
        const bytesList = await Promise.all(selected.map((path) => readFile(path)));
        await mergeFiles(
          bytesList,
          selected.map((path) => path.split(/[\\/]/).pop() || 'document.pdf')
        );
        return;
      }
    } catch {
      // Fall through to the browser file input.
    }
  }
  mergeInputRef.value?.click();
}

async function onMergeFilesSelected(e: Event) {
  const target = e.target as HTMLInputElement;
  const files = Array.from(target.files || []);
  target.value = '';
  if (files.length === 0) return;

  const bytesList: Uint8Array[] = [];
  for (const file of files) {
    bytesList.push(new Uint8Array(await file.arrayBuffer()));
  }
  await mergeFiles(
    bytesList,
    files.map((file) => file.name)
  );
}

async function mergeFiles(bytesList: Uint8Array[], names: string[]) {
  if (bytesList.length === 0) return;

  docStore.isLoading = true;
  try {
    const hadCurrentDoc = !!docStore.currentDoc && !!docStore.pdfBytes;
    let appendFiles = [...bytesList];
    let appendNames = [...names];
    let baseBytes: Uint8Array;
    let baseName: string;

    if (hadCurrentDoc) {
      // Preserve current page order, crops, and markup before appending.
      baseBytes = await getCurrentEditedBytes();
      baseName = docStore.currentDoc!.fileName;
    } else {
      if (appendFiles.length < 2) {
        alert('Select at least two PDF files to merge.');
        return;
      }
      baseBytes = appendFiles.shift()!;
      baseName = appendNames.shift() || 'document.pdf';
    }

    const { mergePdfBytes } = await import('@/services/pdfMerge');
    const mergedBytes = await mergePdfBytes(baseBytes, appendFiles);

    const shortName = baseName.replace(/\.pdf$/i, '');
    const mergedName = hadCurrentDoc
      ? `${shortName}-merged.pdf`
      : `merged-${shortName || 'document'}.pdf`;

    await loadPdfData(mergedBytes, 'merged.pdf', mergedName);
    alert(`Merged ${appendFiles.length + 1} PDF files into a ${viewerStore.totalPages}-page document.`);
  } catch (err) {
    console.error('Failed to merge PDF files:', err);
    alert('Failed to merge PDF files. Make sure all selected files are valid, unprotected PDFs.');
  } finally {
    docStore.isLoading = false;
  }
}

// Core PDF loading pipeline
async function loadPdfData(bytes: Uint8Array, filePath: string, fileName: string) {
  docStore.isLoading = true;
  try {
    // PDF.js takes ownership of (and may detach) the data buffer passed to it.
    // Keep a separate copy for later saving/exporting.
    const storedBytes = new Uint8Array(bytes);
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
      storedBytes
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

async function getCurrentEditedBytes(): Promise<Uint8Array> {
  if (!docStore.pdfBytes) throw new Error('No PDF data available');
  const { buildEditedPdfBytes } = await import('@/services/pdfExport');
  return buildEditedPdfBytes(
    docStore.pdfBytes,
    opStore.pages.map((page) => ({
      sourceIndex: page.sourceIndex,
      rotation: opStore.pageRotations[page.id] || 0,
      crop: opStore.pageCrops[page.id] || null,
    })),
    {
      annotations: opStore.annotations,
      textObjects: opStore.textObjects,
      imageObjects: opStore.imageObjects,
    }
  );
}

// Save document pipeline
async function triggerSaveFile() {
  if (!docStore.currentDoc || !docStore.pdfBytes) return;

  let outputBytes = docStore.pdfBytes;
  try {
    outputBytes = await getCurrentEditedBytes();
  } catch (err) {
    console.error('Failed to apply page edits to the saved PDF:', err);
    alert(
      'Could not apply page order/crop changes to the PDF. Saving the original document instead.'
    );
  }

  try {
    if (isTauri()) {
      const destination = await save({
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
        defaultPath: docStore.currentDoc.fileName,
      });

      if (destination) {
        await writeFile(destination, outputBytes);
        docStore.markDirty(false);
        alert(`Document saved successfully to: ${destination}`);
      }
      return;
    }

    // Browser fallback: download the generated PDF directly.
    const blob = new Blob([outputBytes as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = docStore.currentDoc.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    docStore.markDirty(false);
  } catch (err) {
    console.error('Failed to save document:', err);
    // Last-resort browser download fallback
    const blob = new Blob([outputBytes as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = docStore.currentDoc.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

    const currentPageRef = opStore.pages[viewerStore.currentPage - 1];
    if (!currentPageRef) return;
    const pageIdx = currentPageRef.sourceIndex;
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

    // Make the newly inserted image immediately movable/editable.
    appStore.setTool('select');
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

// Unsaved-changes guard for closing the app/window
function hasUnsavedChanges(): boolean {
  return docStore.openDocs.some((doc) => doc.isDirty);
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!hasUnsavedChanges()) return;
  e.preventDefault();
  e.returnValue = '';
}

let unlistenClose: (() => void) | null = null;

async function setupCloseGuard() {
  // Browser fallback (dev server or non-Tauri runtime)
  if (!isTauri()) {
    window.addEventListener('beforeunload', onBeforeUnload);
    return;
  }

  try {
    const appWindow = getCurrentWindow();
    unlistenClose = await appWindow.onCloseRequested(async (event) => {
      if (!hasUnsavedChanges()) return;

      event.preventDefault();
      const confirmed = await tauriConfirm(
        'You have unsaved changes. Are you sure you want to close without saving?',
        {
          title: 'Unsaved Changes',
          kind: 'warning',
          okLabel: 'Close Without Saving',
          cancelLabel: 'Keep Editing',
        }
      );

      if (confirmed) {
        await appWindow.destroy();
      }
    });
  } catch (err) {
    console.warn('Could not register window close handler, using browser fallback:', err);
    window.addEventListener('beforeunload', onBeforeUnload);
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
  setupCloseGuard();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('beforeunload', onBeforeUnload);
  if (unlistenClose) {
    unlistenClose();
    unlistenClose = null;
  }
});
</script>

