<template>
  <div class="h-10 bg-card border-b border-border flex items-center justify-between px-3 text-xs select-none z-20 shrink-0">
    <!-- Left Section: Tool Selection -->
    <div class="flex items-center space-x-1 overflow-x-auto">
      <!-- Select / Hand Group -->
      <div class="flex items-center space-x-0.5 bg-secondary/50 p-0.5 rounded-md border border-border/50">
        <button
          @click="appStore.setTool('select')"
          :class="[
            'p-1.5 rounded transition-colors',
            appStore.activeTool === 'select'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground hover:bg-muted'
          ]"
          title="Select Tool (V)"
        >
          <MousePointer class="w-3.5 h-3.5" />
        </button>
        <button
          @click="appStore.setTool('hand')"
          :class="[
            'p-1.5 rounded transition-colors',
            appStore.activeTool === 'hand'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground hover:bg-muted'
          ]"
          title="Pan / Hand Tool (H)"
        >
          <Hand class="w-3.5 h-3.5" />
        </button>
      </div>

      <div class="h-4 w-px bg-border/60 mx-1"></div>

      <!-- Annotation Group -->
      <div class="flex items-center space-x-0.5">
        <button
          @click="appStore.setTool('highlight')"
          :class="[
            'flex items-center space-x-1 px-2 py-1 rounded transition-colors',
            appStore.activeTool === 'highlight'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground hover:bg-muted'
          ]"
          title="Highlight Text (Select text to highlight)"
        >
          <Highlighter class="w-3.5 h-3.5 text-amber-500" />
          <span class="hidden lg:inline">Highlight</span>
        </button>

        <button
          @click="appStore.setTool('draw')"
          :class="[
            'flex items-center space-x-1 px-2 py-1 rounded transition-colors',
            appStore.activeTool === 'draw'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground hover:bg-muted'
          ]"
          title="Freehand Draw"
        >
          <PenLine class="w-3.5 h-3.5" />
          <span class="hidden lg:inline">Draw</span>
        </button>

        <button
          @click="appStore.setTool('shape')"
          :class="[
            'flex items-center space-x-1 px-2 py-1 rounded transition-colors',
            appStore.activeTool === 'shape'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground hover:bg-muted'
          ]"
          title="Shapes (Rectangle, Circle, Line)"
        >
          <Square class="w-3.5 h-3.5" />
          <span class="hidden lg:inline">Shape</span>
        </button>

        <button
          @click="appStore.setTool('note')"
          :class="[
            'flex items-center space-x-1 px-2 py-1 rounded transition-colors',
            appStore.activeTool === 'note'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground hover:bg-muted'
          ]"
          title="Sticky Note"
        >
          <StickyNote class="w-3.5 h-3.5 text-amber-400" />
          <span class="hidden lg:inline">Note</span>
        </button>
      </div>

      <div class="h-4 w-px bg-border/60 mx-1"></div>

      <!-- Content Insertion Group -->
      <div class="flex items-center space-x-0.5">
        <button
          @click="appStore.setTool('text')"
          :class="[
            'flex items-center space-x-1 px-2 py-1 rounded transition-colors',
            appStore.activeTool === 'text'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground hover:bg-muted'
          ]"
          title="Add Text Box (T)"
        >
          <Type class="w-3.5 h-3.5" />
          <span>Text</span>
        </button>

        <button
          @click="$emit('add-image')"
          class="flex items-center space-x-1 px-2 py-1 rounded text-foreground hover:bg-muted transition-colors"
          title="Insert Image"
        >
          <ImageIcon class="w-3.5 h-3.5" />
          <span>Image</span>
        </button>
      </div>

      <div class="h-4 w-px bg-border/60 mx-1"></div>

      <!-- Page Organize Group (Delete, Duplicate, Rotate) -->
      <div class="flex items-center space-x-0.5 bg-secondary/30 p-0.5 rounded border border-border/40">
        <button
          @click="rotateCurrentPage(-90)"
          :disabled="!docStore.currentDoc"
          class="p-1 rounded text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
          title="Rotate Current Page CCW (-90°)"
        >
          <RotateCcw class="w-3.5 h-3.5" />
        </button>

        <button
          @click="rotateCurrentPage(90)"
          :disabled="!docStore.currentDoc"
          class="p-1 rounded text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
          title="Rotate Current Page CW (+90°)"
        >
          <RotateCw class="w-3.5 h-3.5" />
        </button>

        <button
          @click="duplicateCurrentPage"
          :disabled="!docStore.currentDoc"
          class="p-1 rounded text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
          title="Duplicate Current Page"
        >
          <Copy class="w-3.5 h-3.5" />
        </button>

        <button
          @click="toggleCropCurrentPage"
          :disabled="!docStore.currentDoc"
          :class="[
            'p-1 rounded transition-colors disabled:opacity-30',
            appStore.activeTool === 'crop'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground hover:bg-muted'
          ]"
          title="Crop Current Page"
        >
          <Crop class="w-3.5 h-3.5" />
        </button>

        <button
          @click="deleteCurrentPage"
          :disabled="!docStore.currentDoc || opStore.pages.length <= 1"
          class="p-1 rounded text-destructive hover:bg-destructive/10 disabled:opacity-30 transition-colors"
          title="Delete Current Page"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>

    </div>

    <!-- Right Section: Panel Toggles -->
    <div class="flex items-center space-x-1">
      <button
        @click="toggleLeftPanel"
        :class="[
          'p-1.5 rounded transition-colors',
          appStore.leftSidebarOpen ? 'bg-secondary text-primary' : 'text-foreground hover:bg-muted'
        ]"
        title="Toggle Pages Panel"
      >
        <PanelLeft class="w-3.5 h-3.5" />
      </button>
      <button
        @click="toggleRightPanel"
        :class="[
          'p-1.5 rounded transition-colors ml-1',
          appStore.rightSidebarOpen ? 'bg-secondary text-primary' : 'text-foreground hover:bg-muted'
        ]"
        title="Toggle Properties Panel"
      >
        <SlidersHorizontal class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  MousePointer,
  Hand,
  Highlighter,
  PenLine,
  Square,
  StickyNote,
  Type,
  Image as ImageIcon,
  RotateCw,
  RotateCcw,
  Copy,
  Crop,
  Trash2,
  SlidersHorizontal,
  PanelLeft,
} from '@lucide/vue';
import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';
import { useAppStore } from '@/stores/appStore';
import { useViewerStore } from '@/stores/viewerStore';
import { useDocumentStore } from '@/stores/documentStore';
import { useOperationStore } from '@/stores/operationStore';
import { useHistoryStore } from '@/stores/historyStore';

const appStore = useAppStore();
const viewerStore = useViewerStore();
const docStore = useDocumentStore();
const opStore = useOperationStore();
const historyStore = useHistoryStore();

defineEmits<{
  (e: 'add-image'): void;
}>();

function toggleLeftPanel() {
  appStore.leftSidebarOpen = !appStore.leftSidebarOpen;
}

function toggleRightPanel() {
  appStore.rightSidebarOpen = !appStore.rightSidebarOpen;
}

// Current page index (0-based)
function getCurrentPageIndex(): number {
  return viewerStore.currentPage - 1;
}

function rotateCurrentPage(angle: 90 | -90) {
  const page = opStore.pages[getCurrentPageIndex()];
  if (!page) return;

  historyStore.pushOperation({
    id: `op-${Date.now()}`,
    type: 'rotate_page',
    documentId: 'doc',
    documentRevision: opStore.currentRevision + 1,
    payload: { pageId: page.id, angleDegrees: angle },
    inversePayload: { pageId: page.id, angleDegrees: (-angle as 90 | -90 | 180) },
    timestamp: Date.now(),
  });
}

async function deleteCurrentPage() {
  if (opStore.pages.length <= 1) return;
  const pageIdx = getCurrentPageIndex();
  const page = opStore.pages[pageIdx];
  if (!page) return;

  const confirmed = await tauriConfirm(
    `Delete Page ${pageIdx + 1}? You can undo this action.`,
    { title: 'Confirm Delete', kind: 'warning' }
  );
  if (!confirmed) return;

  historyStore.pushOperation({
    id: `op-${Date.now()}`,
    type: 'delete_page',
    documentId: 'doc',
    documentRevision: opStore.currentRevision + 1,
    payload: { pageId: page.id },
    inversePayload: { page, index: pageIdx },
    timestamp: Date.now(),
  });

  viewerStore.totalPages = opStore.pages.length;
  if (viewerStore.currentPage > opStore.pages.length) {
    viewerStore.setPage(opStore.pages.length);
  }
}

function duplicateCurrentPage() {
  const pageIdx = getCurrentPageIndex();
  const page = opStore.pages[pageIdx];
  if (!page) return;

  const clone = opStore.createPageRef(page.sourceIndex);
  historyStore.pushOperation({
    id: `op-${Date.now()}`,
    type: 'duplicate_page',
    documentId: 'doc',
    documentRevision: opStore.currentRevision + 1,
    payload: { page: clone, insertIndex: pageIdx + 1, rotation: opStore.pageRotations[page.id] || 0, crop: opStore.pageCrops[page.id] || null },
    inversePayload: { pageId: clone.id },
    timestamp: Date.now(),
  });

  viewerStore.totalPages = opStore.pages.length;
}

function toggleCropCurrentPage() {
  if (!docStore.currentDoc) return;
  appStore.setTool(appStore.activeTool === 'crop' ? 'select' : 'crop');
}
</script>
