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
    <input
      ref="imagesToPdfInputRef"
      type="file"
      accept="image/png,image/jpeg,image/jpg,image/jfif,image/webp,image/gif,image/bmp,image/svg+xml,image/avif"
      multiple
      class="hidden"
      @change="onImagesToPdfSelected"
    />

    <!-- 1. Top Title Bar -->
    <AppHeader
      @open-file="triggerOpenFile"
      @merge-files="triggerMergeFiles"
      @images-to-pdf="triggerImagesToPdf"
      @export-images="exportImagesOpen = true"
      @save-file="triggerSaveFile()"
      @save-file-as="triggerSaveFile(true)"
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

    <!-- Page-to-image export options -->
    <ExportImagesDialog
      v-if="exportImagesOpen && docStore.currentDoc"
      :total-pages="viewerStore.totalPages"
      :current-page="viewerStore.currentPage"
      @close="exportImagesOpen = false"
      @export="onExportImages"
    />
    <ImagesToPdfDialog
      v-if="imagesToPdfOpen"
      :image-count="pendingImages.length"
      @close="cancelImagesToPdf"
      @convert="confirmImagesToPdf"
    />

    <!-- Busy indicator for conversions -->
    <div
      v-if="busyMessage"
      class="fixed bottom-12 left-1/2 z-[120] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs text-foreground shadow-xl"
    >
      <LoaderCircle class="h-3.5 w-3.5 animate-spin text-primary" />
      <span>{{ busyMessage }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { open, save, confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LoaderCircle } from '@lucide/vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import MainToolbar from '@/components/layout/MainToolbar.vue';
import LeftSidebar from '@/components/layout/LeftSidebar.vue';
import RightSidebar from '@/components/layout/RightSidebar.vue';
import StatusBar from '@/components/layout/StatusBar.vue';
import PdfViewer from '@/components/viewer/PdfViewer.vue';
import HelpPage from '@/components/layout/HelpPage.vue';
import ExportImagesDialog from '@/components/layout/ExportImagesDialog.vue';
import ImagesToPdfDialog from '@/components/layout/ImagesToPdfDialog.vue';
import { useDocumentStore } from '@/stores/documentStore';
import { useViewerStore } from '@/stores/viewerStore';
import { useOperationStore } from '@/stores/operationStore';
import { useHistoryStore } from '@/stores/historyStore';
import { useAppStore } from '@/stores/appStore';
import { useUpdateStore } from '@/stores/updateStore';
import { PdfService } from '@/services/pdfWorker';
import type { ImageExportFormat, ImagesToPdfOptions } from '@/services/imageConversion';
import { InsertedImageObject } from '@/types/operations';

const docStore = useDocumentStore();
const viewerStore = useViewerStore();
const opStore = useOperationStore();
const historyStore = useHistoryStore();
const appStore = useAppStore();
const updateStore = useUpdateStore();
const helpOpen = ref(false);

const fileInputRef = ref<HTMLInputElement | null>(null);
const imageInputRef = ref<HTMLInputElement | null>(null);
const mergeInputRef = ref<HTMLInputElement | null>(null);
const imagesToPdfInputRef = ref<HTMLInputElement | null>(null);
const exportImagesOpen = ref(false);
const imagesToPdfOpen = ref(false);
const pendingImages = ref<ImageFileData[]>([]);
const busyMessage = ref<string | null>(null);

interface ImageFileData {
  name: string;
  bytes: Uint8Array;
}

interface ExportImageOptions {
  pages: number[];
  format: ImageExportFormat;
  dpi: number;
}

// Trigger file opening via native Tauri dialog or browser file input fallback
async function triggerOpenFile() {
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
    });

    if (selected && typeof selected === 'string') {
      const fileBytes = await readFile(selected);
      await loadPdfData(
        fileBytes,
        selected,
        selected.split(/[\\/]/).pop() || 'document.pdf',
        selected
      );
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
      if (!Array.isArray(selected) || selected.length === 0) return;

      const bytesList = await Promise.all(selected.map((path) => readFile(path)));
      await mergeFiles(
        bytesList,
        selected.map((path) => path.split(/[\\/]/).pop() || 'document.pdf')
      );
      return;
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

// ---------------------------------------------------------------------------
// Image <-> PDF conversion
// ---------------------------------------------------------------------------

function makeTimestamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('-');
}

async function confirmReplaceCurrentDocument(): Promise<boolean> {
  if (!docStore.currentDoc?.isDirty) return true;

  const message =
    'Creating this PDF will replace the current document and discard its unsaved changes. Continue?';

  if (isTauri()) {
    try {
      return await tauriConfirm(message, {
        title: 'Unsaved Changes',
        kind: 'warning',
        okLabel: 'Continue',
        cancelLabel: 'Cancel',
      });
    } catch {
      return window.confirm(message);
    }
  }

  return window.confirm(message);
}

// Ask for a set of images and combine them into a new PDF document.
async function triggerImagesToPdf() {
  if (isTauri()) {
    try {
      const selected = await open({
        multiple: true,
        title: 'Select images to combine into a PDF',
        filters: [
          {
            name: 'Images',
            extensions: ['png', 'jpg', 'jpeg', 'jfif', 'webp', 'gif', 'bmp', 'svg', 'avif'],
          },
        ],
      });
      if (!Array.isArray(selected) || selected.length === 0) return;

      const images: ImageFileData[] = [];
      for (const path of selected) {
        images.push({
          name: path.split(/[\\/]/).pop() || 'image',
          bytes: await readFile(path),
        });
      }

      startImagesToPdf(images);
      return;
    } catch (err) {
      console.warn('Native image picker failed, falling back to browser input:', err);
    }
  }

  imagesToPdfInputRef.value?.click();
}

async function onImagesToPdfSelected(e: Event) {
  const target = e.target as HTMLInputElement;
  const files = Array.from(target.files || []);
  target.value = '';
  if (files.length === 0) return;

  const images: ImageFileData[] = [];
  for (const file of files) {
    images.push({
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
  }

  startImagesToPdf(images);
}

function startImagesToPdf(images: ImageFileData[]) {
  if (images.length === 0) return;
  pendingImages.value = images;
  imagesToPdfOpen.value = true;
}

function cancelImagesToPdf() {
  imagesToPdfOpen.value = false;
  pendingImages.value = [];
}

async function confirmImagesToPdf(options: ImagesToPdfOptions) {
  const images = pendingImages.value;
  imagesToPdfOpen.value = false;
  pendingImages.value = [];
  await convertImagesToPdf(images, options);
}

async function convertImagesToPdf(images: ImageFileData[], options: ImagesToPdfOptions = {}) {
  if (images.length === 0) return;
  if (!(await confirmReplaceCurrentDocument())) return;

  busyMessage.value = `Creating a PDF from ${images.length} ${
    images.length === 1 ? 'image' : 'images'
  }...`;

  try {
    const { createPdfFromImages } = await import('@/services/imageConversion');
    const result = await createPdfFromImages(images, options);

    const fileName = `images-${makeTimestamp()}.pdf`;
    await loadPdfData(result.bytes, fileName, fileName, null);

    // Keep converted images as editable overlay objects so they can be
    // selected, moved, resized, or cropped after conversion.
    opStore.imageObjects = result.images.map((image, index) => ({
      id: `img-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
      pageIndex: image.pageIndex,
      rect: { ...image.rect },
      imageDataUrl: image.dataUrl,
      rotation: 0,
      opacity: 1,
      isPageImage: true,
    }));
    docStore.markDirty(true);

    if (result.skipped.length > 0) {
      alert(
        `Created a ${result.pageCount}-page PDF. ${result.skipped.length} image(s) could not be read and were skipped:\n${result.skipped.join(
          '\n'
        )}`
      );
    }
  } catch (err) {
    console.error('Failed to create a PDF from images:', err);
    alert(
      'Could not create a PDF from the selected images. Make sure they are valid image files.'
    );
  } finally {
    busyMessage.value = null;
  }
}

async function onExportImages(options: ExportImageOptions) {
  exportImagesOpen.value = false;
  if (!docStore.currentDoc || !docStore.pdfBytes) return;

  const docName = docStore.currentDoc.fileName;
  busyMessage.value = 'Preparing pages for export...';

  try {
    // Export the edited document so annotations, page order, and crops are included.
    const editedBytes = await getCurrentEditedBytes();
    const { renderPdfPagesToImages } = await import('@/services/imageConversion');

    const images = await renderPdfPagesToImages(editedBytes, {
      pages: options.pages,
      format: options.format,
      dpi: options.dpi,
      onProgress: (completed, total) => {
        busyMessage.value = `Rendering image ${completed} of ${total}...`;
      },
    });

    const baseName = docName.replace(/\.pdf$/i, '') || 'document';
    const extension = options.format === 'png' ? 'png' : 'jpg';
    const mimeType = options.format === 'png' ? 'image/png' : 'image/jpeg';
    const maxPage = images.reduce((max, image) => Math.max(max, image.pageNumber), 1);
    const pad = Math.max(2, String(maxPage).length);

    const files = images.map((image) => ({
      fileName: `${baseName}-page-${String(image.pageNumber).padStart(pad, '0')}.${extension}`,
      bytes: image.bytes,
      mimeType,
    }));

    await saveExportedImages(files);
  } catch (err) {
    console.error('Failed to export pages as images:', err);
    alert('Could not export the selected pages as images.');
  } finally {
    busyMessage.value = null;
  }
}

interface ExportedImageFile {
  fileName: string;
  bytes: Uint8Array;
  mimeType: string;
}

async function saveExportedImages(files: ExportedImageFile[]) {
  if (files.length === 0) return;

  if (isTauri()) {
    const folder = await open({
      directory: true,
      multiple: false,
      recursive: true,
      title: 'Choose a folder for the exported images',
    });
    if (!folder || Array.isArray(folder)) return;

    busyMessage.value = `Writing ${files.length} ${files.length === 1 ? 'image' : 'images'}...`;
    for (const file of files) {
      await writeFile(await join(folder, file.fileName), file.bytes);
    }

    alert(
      `Exported ${files.length} ${files.length === 1 ? 'image' : 'images'} to:\n${folder}`
    );
    return;
  }

  // Browser fallback: trigger one download per image.
  for (const file of files) {
    downloadBytes(file.bytes, file.fileName, file.mimeType);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  alert(`Downloaded ${files.length} ${files.length === 1 ? 'image' : 'images'}.`);
}

// Core PDF loading pipeline
async function loadPdfData(
  bytes: Uint8Array,
  filePath: string,
  fileName: string,
  savePath: string | null = null
) {
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
        savePath,
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

function downloadBytes(bytes: Uint8Array, fileName: string, mimeType: string) {
  const blob = new Blob([bytes as any], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadPdf(bytes: Uint8Array, fileName: string) {
  downloadBytes(bytes, fileName, 'application/pdf');
}

/**
 * Save pipeline.
 *
 * - Normal save (button / Ctrl+S) writes straight to the document's existing
 *   location, so no dialog appears after the first save.
 * - Save As (dropdown / Ctrl+Shift+S) always asks for a new destination.
 * - Documents that have never been saved to disk prompt once, then remember
 *   the chosen path for subsequent saves.
 */
async function triggerSaveFile(saveAs = false) {
  if (!docStore.currentDoc || !docStore.pdfBytes) return;
  const doc = docStore.currentDoc;

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
      let destination = saveAs ? null : doc.savePath || null;

      if (!destination) {
        destination = await save({
          filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
          defaultPath: doc.fileName,
        });
      }

      if (!destination) return;

      await writeFile(destination, outputBytes);
      docStore.markSaved(destination);
      return;
    }

    // Browser fallback: download the generated PDF directly.
    downloadPdf(outputBytes, doc.fileName);
    docStore.markSaved();
  } catch (err) {
    console.error('Failed to save document:', err);

    if (isTauri()) {
      alert('Could not save the document. Check the file location and try again.');
      return;
    }

    // Last-resort browser download fallback
    downloadPdf(outputBytes, docStore.currentDoc.fileName);
    docStore.markSaved();
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

    // Size the image box to the image's natural aspect ratio, capped to a
    // comfortable size, so it never appears stretched or squashed.
    const image = new Image();
    image.onload = () => {
      const maxEdge = 240;
      const ratio = image.naturalWidth / Math.max(1, image.naturalHeight);
      const width = ratio >= 1 ? maxEdge : maxEdge * ratio;
      const height = ratio >= 1 ? maxEdge / ratio : maxEdge;

      const pageSize = opStore.pageSizes[pageIdx] || { width: 612, height: 792 };
      const rect = {
        x: Math.max(20, (pageSize.width - width) / 2),
        y: Math.max(20, (pageSize.height - height) / 2),
        width,
        height,
      };

      insertImage(dataUrl, pageIdx, rect);
    };
    image.onerror = () => {
      insertImage(dataUrl, pageIdx, { x: 100, y: 400, width: 200, height: 150 });
    };
    image.src = dataUrl;
  };
  reader.readAsDataURL(file);
  target.value = '';
}

function insertImage(dataUrl: string, pageIdx: number, rect: InsertedImageObject['rect']) {
  const newImage: InsertedImageObject = {
    id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    pageIndex: pageIdx,
    rect,
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
  appStore.selectedImageId = newImage.id;
}

// Keyboard shortcuts dispatcher
function onKeyDown(e: KeyboardEvent) {
  const isCtrlOrCmd = e.ctrlKey || e.metaKey;

  // The desktop webview treats Ctrl+R as a page reload, which discards open
  // documents and unsaved edits. Keep it disabled inside the editor.
  if (isCtrlOrCmd && e.key.toLowerCase() === 'r') {
    e.preventDefault();
    return;
  }

  if (isCtrlOrCmd && e.key.toLowerCase() === 'o') {
    e.preventDefault();
    triggerOpenFile();
  } else if (isCtrlOrCmd && e.key.toLowerCase() === 's') {
    e.preventDefault();
    triggerSaveFile(e.shiftKey);
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
let startupUpdateTimer: number | null = null;

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

  // Check quietly after the first render so it never competes with app startup.
  startupUpdateTimer = window.setTimeout(() => {
    updateStore.checkForUpdates({ silent: true });
  }, 2000);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('beforeunload', onBeforeUnload);
  if (startupUpdateTimer !== null) {
    window.clearTimeout(startupUpdateTimer);
    startupUpdateTimer = null;
  }
  if (unlistenClose) {
    unlistenClose();
    unlistenClose = null;
  }
});
</script>

