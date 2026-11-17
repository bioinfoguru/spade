<template>
  <aside
    v-show="appStore.leftSidebarOpen"
    class="w-64 bg-card border-r border-border flex flex-col select-none shrink-0 overflow-hidden z-10 transition-all duration-150"
  >
    <!-- Sidebar Header Tabs -->
    <div class="h-9 border-b border-border flex items-center justify-between px-2 bg-secondary/30">
      <div class="flex items-center space-x-1">
        <button
          @click="appStore.leftSidebarTab = 'thumbnails'"
          :class="[
            'p-1.5 rounded transition-colors',
            appStore.leftSidebarTab === 'thumbnails'
              ? 'bg-secondary text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          ]"
          title="Page Thumbnails"
        >
          <Layers class="w-3.5 h-3.5" />
        </button>

        <button
          @click="appStore.leftSidebarTab = 'outline'"
          :class="[
            'p-1.5 rounded transition-colors',
            appStore.leftSidebarTab === 'outline'
              ? 'bg-secondary text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          ]"
          title="Document Outline (TOC)"
        >
          <ListTree class="w-3.5 h-3.5" />
        </button>

        <button
          @click="appStore.leftSidebarTab = 'bookmarks'"
          :class="[
            'p-1.5 rounded transition-colors',
            appStore.leftSidebarTab === 'bookmarks'
              ? 'bg-secondary text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          ]"
          title="Bookmarks"
        >
          <Bookmark class="w-3.5 h-3.5" />
        </button>

        <button
          @click="appStore.leftSidebarTab = 'search'"
          :class="[
            'p-1.5 rounded transition-colors',
            appStore.leftSidebarTab === 'search'
              ? 'bg-secondary text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          ]"
          title="Search in Document"
        >
          <Search class="w-3.5 h-3.5" />
        </button>
      </div>

      <button
        @click="appStore.leftSidebarOpen = false"
        class="p-1 rounded text-muted-foreground hover:text-foreground"
        title="Collapse Sidebar"
      >
        <PanelLeftClose class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Sidebar Body Content -->
    <div ref="sidebarScrollRef" class="flex-1 overflow-y-auto p-2">
      <!-- 1. Page Thumbnails Tab -->
      <div v-if="appStore.leftSidebarTab === 'thumbnails'" class="flex flex-col space-y-3">
        <div v-if="!docStore.currentDoc" class="text-xs text-muted-foreground text-center py-8">
          No document loaded
        </div>
        <template v-else>
          <div class="flex items-center space-x-1.5 px-1 text-[10px] text-muted-foreground">
            <Move class="w-3 h-3 shrink-0" />
            <span>Drag a thumbnail to reorder pages</span>
          </div>

          <div ref="thumbnailListRef" class="flex flex-col space-y-3">
            <div
              v-for="(page, position) in opStore.pages"
              :key="page.id"
              :id="`sidebar-thumb-${page.id}`"
              class="sidebar-thumb-card"
              @click="onSelectPage(position + 1)"
              :class="[
                'relative flex flex-col items-center p-2 rounded-lg border cursor-grab active:cursor-grabbing transition-all group',
                viewerStore.currentPage === position + 1
                  ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-sm'
                  : 'border-border/80 hover:border-border hover:bg-secondary/40',
              ]"
            >
              <!-- Thumbnail preview container with Quick Action Overlay -->
              <div class="relative w-full aspect-[1/1.3] bg-background rounded border border-border/50 flex items-center justify-center overflow-hidden shadow-xs">
                <img
                  v-if="thumbnailSrc(page.sourceIndex)"
                  :src="thumbnailSrc(page.sourceIndex)"
                  class="w-full h-full object-contain transition-transform duration-200"
                  :style="{
                    transform: `rotate(${opStore.pageRotations[page.id] || 0}deg)`
                  }"
                  :alt="`Page ${position + 1}`"
                />
                <div v-else class="text-[11px] text-muted-foreground flex flex-col items-center">
                  <FileText class="w-5 h-5 mb-1 opacity-40" />
                  <span>Page {{ position + 1 }}</span>
                </div>

                <!-- Drag handle for reordering -->
                <div
                  data-page-drag-handle
                  class="absolute top-1 right-1 z-20 p-0.5 rounded bg-background/90 border border-border text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                  title="Drag to reorder page"
                  @click.stop
                >
                  <GripVertical class="w-3 h-3" />
                </div>

                <!-- Crop indicator -->
                <div
                  v-if="opStore.pageCrops[page.id]"
                  class="absolute top-1 left-1 z-20 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[9px] font-semibold shadow-sm pointer-events-none"
                >
                  Cropped
                </div>

                <!-- Hover Quick Action Bar for Delete, Rotate, Extract -->
                <div class="absolute inset-x-0 bottom-0 bg-background/90 backdrop-blur-xs border-t border-border/60 py-1 px-1.5 flex items-center justify-around opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    @click.stop="movePage(position, -1)"
                    :disabled="position === 0"
                    class="p-1 rounded hover:bg-muted text-foreground disabled:opacity-30"
                    title="Move Page Up"
                  >
                    <ArrowUp class="w-3 h-3" />
                  </button>
                  <button
                    @click.stop="movePage(position, 1)"
                    :disabled="position === opStore.pages.length - 1"
                    class="p-1 rounded hover:bg-muted text-foreground disabled:opacity-30"
                    title="Move Page Down"
                  >
                    <ArrowDown class="w-3 h-3" />
                  </button>
                  <button
                    @click.stop="rotatePage(page.id, -90)"
                    class="p-1 rounded hover:bg-muted text-foreground"
                    title="Rotate 90° CCW"
                  >
                    <RotateCcw class="w-3 h-3" />
                  </button>
                  <button
                    @click.stop="rotatePage(page.id, 90)"
                    class="p-1 rounded hover:bg-muted text-foreground"
                    title="Rotate 90° CW"
                  >
                    <RotateCw class="w-3 h-3" />
                  </button>
                  <button
                    @click.stop="duplicatePage(position)"
                    class="p-1 rounded hover:bg-muted text-foreground"
                    title="Duplicate Page"
                  >
                    <Copy class="w-3 h-3" />
                  </button>
                  <button
                    @click.stop="cropPage(position)"
                    class="p-1 rounded hover:bg-muted text-foreground"
                    title="Crop Page"
                  >
                    <Crop class="w-3 h-3" />
                  </button>
                  <button
                    @click.stop="deletePage(position)"
                    :disabled="opStore.pages.length <= 1"
                    class="p-1 rounded hover:bg-destructive/10 text-destructive disabled:opacity-30"
                    title="Delete Page"
                  >
                    <Trash2 class="w-3 h-3" />
                  </button>
                </div>
              </div>

              <!-- Page Number Indicator & Active Label -->
              <div class="flex items-center justify-between w-full mt-1.5 px-0.5">
                <span class="text-[11px] font-medium text-foreground">
                  Page {{ position + 1 }}
                </span>
                <span
                  v-if="opStore.pageRotations[page.id]"
                  class="text-[9px] font-mono text-muted-foreground"
                >
                  {{ opStore.pageRotations[page.id] }}°
                </span>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- 2. Document Outline / TOC Tab -->
      <div v-else-if="appStore.leftSidebarTab === 'outline'">
        <div v-if="!docStore.currentDoc || docStore.currentDoc.outline.length === 0" class="text-xs text-muted-foreground text-center py-8">
          No outline available
        </div>
        <div v-else class="text-xs space-y-1">
          <div
            v-for="(item, idx) in docStore.currentDoc.outline"
            :key="idx"
            class="flex items-center space-x-1.5 py-1 px-1.5 rounded hover:bg-secondary/60 cursor-pointer text-foreground"
          >
            <ChevronRight class="w-3 h-3 text-muted-foreground shrink-0" />
            <span class="truncate">{{ item.title }}</span>
          </div>
        </div>
      </div>

      <!-- 3. Bookmarks Tab -->
      <div v-else-if="appStore.leftSidebarTab === 'bookmarks'" class="text-xs text-muted-foreground text-center py-8">
        No bookmarks saved
      </div>

      <!-- 4. Search Tab -->
      <div v-else-if="appStore.leftSidebarTab === 'search'" class="space-y-3">
        <div class="relative">
          <input
            v-model="viewerStore.searchQuery"
            type="text"
            placeholder="Search text..."
            class="w-full pl-7 pr-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
          />
          <Search class="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-2" />
        </div>
        <div v-if="viewerStore.searchQuery" class="text-xs text-muted-foreground">
          Found {{ viewerStore.searchMatches.length }} matches
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
import Sortable from 'sortablejs';
import {
  Layers,
  ListTree,
  Bookmark,
  Search,
  PanelLeftClose,
  ChevronRight,
  FileText,
  RotateCw,
  RotateCcw,
  Copy,
  Trash2,
  Move,
  GripVertical,
  Crop,
  ArrowUp,
  ArrowDown,
} from '@lucide/vue';
import { useAppStore } from '@/stores/appStore';
import { useDocumentStore } from '@/stores/documentStore';
import { useViewerStore } from '@/stores/viewerStore';
import { useOperationStore } from '@/stores/operationStore';
import { useHistoryStore } from '@/stores/historyStore';
import { PdfService } from '@/services/pdfWorker';
import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';

const appStore = useAppStore();
const docStore = useDocumentStore();
const viewerStore = useViewerStore();
const opStore = useOperationStore();
const historyStore = useHistoryStore();

const thumbnails = ref<Record<number, string>>({});

function thumbnailSrc(sourceIndex: number): string {
  const pageImage = opStore.imageObjects.find(
    (image) => image.isPageImage && image.pageIndex === sourceIndex
  );
  return pageImage?.imageDataUrl || thumbnails.value[sourceIndex] || '';
}
const sidebarScrollRef = ref<HTMLDivElement | null>(null);
const thumbnailListRef = ref<HTMLElement | null>(null);
let pageSortable: Sortable | null = null;

// Page Selection handler: updates viewer and triggers scroll
function onSelectPage(pageNum: number) {
  viewerStore.setPage(pageNum);
}

function destroyPageSortable() {
  if (pageSortable) {
    pageSortable.destroy();
    pageSortable = null;
  }
}

function initPageSortable() {
  if (pageSortable || !thumbnailListRef.value) return;

  pageSortable = Sortable.create(thumbnailListRef.value, {
    animation: 160,
    // Drag anywhere on a thumbnail, except the action buttons.
    filter: 'button, input, textarea, [data-no-drag]',
    preventOnFilter: false,
    draggable: '.sidebar-thumb-card',
    // Use pointer-based dragging instead of native HTML5 DnD. Native DnD can
    // show a "not allowed" cursor in WebView2 and silently refuse the drag.
    forceFallback: true,
    fallbackTolerance: 3,
    fallbackOnBody: true,
    ghostClass: 'opacity-40',
    chosenClass: 'ring-2',
    dragClass: 'shadow-xl',
    onEnd(evt) {
      const fromIndex = evt.oldIndex;
      const toIndex = evt.newIndex;
      if (
        fromIndex === undefined ||
        toIndex === undefined ||
        fromIndex === toIndex ||
        fromIndex < 0 ||
        fromIndex >= opStore.pages.length ||
        toIndex < 0 ||
        toIndex >= opStore.pages.length
      ) {
        return;
      }

      historyStore.pushOperation({
        id: `op-${Date.now()}`,
        type: 'reorder_pages',
        documentId: 'doc',
        documentRevision: opStore.currentRevision + 1,
        payload: { fromIndex, toIndex },
        inversePayload: { fromIndex: toIndex, toIndex: fromIndex },
        timestamp: Date.now(),
      });

      viewerStore.setPage(toIndex + 1);
    },
  });
}

watch(
  () => [docStore.currentDoc, appStore.leftSidebarTab, appStore.leftSidebarOpen] as const,
  async () => {
    await nextTick();
    if (docStore.currentDoc && appStore.leftSidebarTab === 'thumbnails' && appStore.leftSidebarOpen) {
      initPageSortable();
    } else {
      destroyPageSortable();
    }
  },
  { immediate: true }
);

onBeforeUnmount(destroyPageSortable);

// Enter crop mode for a specific page.
function cropPage(position: number) {
  viewerStore.setPage(position + 1);
  appStore.setTool('crop');
}

// Move Page Command (fallback for drag-and-drop)
function movePage(position: number, delta: number) {
  const toIndex = position + delta;
  if (toIndex < 0 || toIndex >= opStore.pages.length) return;

  historyStore.pushOperation({
    id: `op-${Date.now()}`,
    type: 'reorder_pages',
    documentId: 'doc',
    documentRevision: opStore.currentRevision + 1,
    payload: { fromIndex: position, toIndex },
    inversePayload: { fromIndex: toIndex, toIndex: position },
    timestamp: Date.now(),
  });

  viewerStore.setPage(toIndex + 1);
}

// Rotate Page Command
function rotatePage(pageId: string, angle: 90 | -90) {
  historyStore.pushOperation({
    id: `op-${Date.now()}`,
    type: 'rotate_page',
    documentId: 'doc',
    documentRevision: opStore.currentRevision + 1,
    payload: { pageId, angleDegrees: angle },
    inversePayload: { pageId, angleDegrees: (-angle as 90 | -90 | 180) },
    timestamp: Date.now(),
  });
}

// Delete Page Command
async function deletePage(position: number) {
  const page = opStore.pages[position];
  if (!page || opStore.pages.length <= 1) return;

  const confirmed = await tauriConfirm(
    `Delete Page ${position + 1}? You can undo this action.`,
    { title: 'Confirm Delete', kind: 'warning' }
  );
  if (!confirmed) return;

  historyStore.pushOperation({
    id: `op-${Date.now()}`,
    type: 'delete_page',
    documentId: 'doc',
    documentRevision: opStore.currentRevision + 1,
    payload: { pageId: page.id },
    inversePayload: { page, index: position },
    timestamp: Date.now(),
  });

  viewerStore.totalPages = opStore.pages.length;
  if (viewerStore.currentPage > opStore.pages.length) {
    viewerStore.setPage(opStore.pages.length);
  }
}

// Duplicate Page Command
function duplicatePage(position: number) {
  const page = opStore.pages[position];
  if (!page) return;

  const clone = opStore.createPageRef(page.sourceIndex);
  historyStore.pushOperation({
    id: `op-${Date.now()}`,
    type: 'duplicate_page',
    documentId: 'doc',
    documentRevision: opStore.currentRevision + 1,
    payload: { page: clone, insertIndex: position + 1, rotation: opStore.pageRotations[page.id] || 0, crop: opStore.pageCrops[page.id] || null },
    inversePayload: { pageId: clone.id },
    timestamp: Date.now(),
  });

  viewerStore.totalPages = opStore.pages.length;
}

// Auto-scroll sidebar thumbnail into view when current page changes
watch(
  () => viewerStore.currentPage,
  (page) => {
    nextTick(() => {
      const pageRef = opStore.pages[page - 1];
      if (!pageRef) return;
      const thumbEl = document.getElementById(`sidebar-thumb-${pageRef.id}`);
      if (thumbEl && sidebarScrollRef.value) {
        thumbEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }
);

// Lazy thumbnail rendering
watch(
  () => docStore.pdfProxy,
  async (proxy) => {
    thumbnails.value = {};
    if (!proxy) return;

    const count = Math.min(proxy.numPages, 40);
    for (let i = 1; i <= count; i++) {
      try {
        const page = await proxy.getPage(i);
        const nativeViewport = page.getViewport({ scale: 1.0 });
        const unscaledViewport = page.getViewport({ scale: 1.0, rotation: 0 });
        opStore.setPageSize(i - 1, unscaledViewport.width, unscaledViewport.height);
        opStore.setPageNativeRotation(i - 1, nativeViewport.rotation);
        const dataUrl = await PdfService.renderThumbnail(page, 180);
        thumbnails.value[i - 1] = dataUrl;
      } catch (err) {
        console.warn(`Failed to render thumbnail for page ${i}:`, err);
      }
    }
  },
  { immediate: true }
);
</script>
