<template>
  <div
    ref="scrollContainerRef"
    class="flex-1 overflow-auto bg-muted/30 relative flex flex-col items-center p-6 space-y-6"
    @wheel="onWheel"
    @scroll="onScroll"
  >
    <!-- Welcome Dropzone when no document is loaded -->
    <div
      v-if="!docStore.currentDoc"
      class="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md m-auto"
    >
      <div class="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 shadow-sm">
        <FileUp class="w-8 h-8" />
      </div>
      <h2 class="text-lg font-bold text-foreground mb-1">Open a PDF to Start</h2>
      <p class="text-xs text-muted-foreground mb-6">
        View, annotate, edit text, and organize pages.
      </p>
      <button
        @click="$emit('open-file')"
        class="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-sm transition-all flex items-center space-x-2"
      >
        <FolderOpen class="w-4 h-4" />
        <span>Select PDF Document</span>
      </button>
    </div>

    <!-- Virtualized Page Stream -->
    <template v-else>
      <div
        v-for="(page, position) in opStore.pages"
        :key="page.id"
        :id="`pdf-page-container-${page.id}`"
        class="relative flex flex-col items-center"
      >
        <!-- Mounted Page within Virtualization Window -->
        <PdfPage
          v-if="isPageInVirtualWindow(position)"
          :page-id="page.id"
          :page-index="page.sourceIndex"
        />

        <!-- Lightweight Placeholder for Offscreen Pages -->
        <div
          v-else
          class="bg-card/40 border border-border/40 rounded-xs flex items-center justify-center text-muted-foreground text-xs font-mono shadow-xs"
          :style="placeholderStyle(page)"
        >
          Page {{ position + 1 }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { FileUp, FolderOpen } from '@lucide/vue';
import { useDocumentStore } from '@/stores/documentStore';
import { useViewerStore } from '@/stores/viewerStore';
import { useOperationStore } from '@/stores/operationStore';
import PdfPage from './PdfPage.vue';

const docStore = useDocumentStore();
const viewerStore = useViewerStore();
const opStore = useOperationStore();

const scrollContainerRef = ref<HTMLDivElement | null>(null);
let isProgrammaticScroll = false;
let scrollTimeout: any = null;

defineEmits<{
  (e: 'open-file'): void;
}>();

// Estimated placeholder dimensions based on real page size, rotation, and crop
function placeholderStyle(page: { id: string; sourceIndex: number }) {
  const size = opStore.pageSizes[page.sourceIndex] || { width: 612, height: 792 };
  const crop = opStore.pageCrops[page.id];
  let width = crop ? crop.width : size.width;
  let height = crop ? crop.height : size.height;

  const rotation =
    ((opStore.pageNativeRotations[page.sourceIndex] || 0) +
      (opStore.pageRotations[page.id] || 0) +
      viewerStore.globalRotation) %
    360;
  if (rotation === 90 || rotation === 270) {
    [width, height] = [height, width];
  }

  return {
    width: `${Math.floor(width * viewerStore.scale)}px`,
    height: `${Math.floor(height * viewerStore.scale)}px`,
  };
}

// Virtualization sliding window: visible page +/- 2 lookahead pages
function isPageInVirtualWindow(position: number): boolean {
  const currentZeroBased = viewerStore.currentPage - 1;
  const buffer = 2; // 2 lookahead pages before and after
  return Math.abs(position - currentZeroBased) <= buffer;
}

// Programmatic scroll to target page (e.g. from sidebar or status bar)
function scrollToPage(pageNumber: number) {
  const page = opStore.pages[pageNumber - 1];
  if (!page) return;

  nextTick(() => {
    const el = document.getElementById(`pdf-page-container-${page.id}`);
    if (el && scrollContainerRef.value) {
      isProgrammaticScroll = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isProgrammaticScroll = false;
      }, 700);
    }
  });
}

// Watch for external page changes (sidebar click, jump input)
watch(
  () => viewerStore.currentPage,
  (newPage) => {
    // A new page request always wins, even if a previous smooth scroll is still running.
    clearTimeout(scrollTimeout);
    isProgrammaticScroll = false;
    scrollToPage(newPage);
  }
);

// Mouse Wheel Zoom (Ctrl/Cmd + Wheel)
function onWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    if (e.deltaY < 0) {
      viewerStore.zoomIn();
    } else {
      viewerStore.zoomOut();
    }
  }
}

// Zoom stuck while resizing pages, so a scroll event is not mistaken for a page change.
watch(
  () => viewerStore.scale,
  () => {
    isProgrammaticScroll = true;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      isProgrammaticScroll = false;
    }, 300);
  }
);

// Detect visible page on scroll
function onScroll() {
  if (isProgrammaticScroll || !scrollContainerRef.value || opStore.pages.length === 0) return;
  const container = scrollContainerRef.value;
  const containerTop = container.getBoundingClientRect().top;
  const containerCenter = container.scrollTop + container.clientHeight / 3;

  let closestPagePosition = viewerStore.currentPage - 1;
  let minDistance = Infinity;

  opStore.pages.forEach((page, position) => {
    const el = document.getElementById(`pdf-page-container-${page.id}`);
    if (el) {
      const elTop = el.getBoundingClientRect().top - containerTop + container.scrollTop;
      const distance = Math.abs(containerCenter - elTop);
      if (distance < minDistance) {
        minDistance = distance;
        closestPagePosition = position;
      }
    }
  });

  const detectedPage = closestPagePosition + 1;
  if (viewerStore.currentPage !== detectedPage) {
    viewerStore.currentPage = detectedPage;
  }
}

// Resolve the displayed size (in PDF points) of the current page.
const currentPageRef = computed(() => opStore.pages[viewerStore.currentPage - 1]);
const currentSourceSize = computed(() =>
  currentPageRef.value ? opStore.pageSizes[currentPageRef.value.sourceIndex] : undefined
);

function currentDisplayPageSize() {
  const page = currentPageRef.value;
  const size = currentSourceSize.value || { width: 612, height: 792 };
  const crop = page ? opStore.pageCrops[page.id] : null;
  let width = crop ? crop.width : size.width;
  let height = crop ? crop.height : size.height;

  const rotation =
    ((page ? opStore.pageNativeRotations[page.sourceIndex] || 0 : 0) +
      (page ? opStore.pageRotations[page.id] || 0 : 0) +
      viewerStore.globalRotation) %
    360;
  if (rotation === 90 || rotation === 270) {
    [width, height] = [height, width];
  }
  return { width, height };
}

function applyFitMode() {
  const el = scrollContainerRef.value;
  if (!el || !docStore.currentDoc || viewerStore.fitMode === 'custom') return;

  const { width, height } = currentDisplayPageSize();
  const availableWidth = Math.max(120, el.clientWidth - 48);
  const availableHeight = Math.max(120, el.clientHeight - 48);

  let nextScale = viewerStore.scale;
  if (viewerStore.fitMode === 'actual') {
    nextScale = 1;
  } else if (viewerStore.fitMode === 'fit-width') {
    nextScale = availableWidth / width;
  } else if (viewerStore.fitMode === 'fit-page') {
    nextScale = Math.min(availableWidth / width, availableHeight / height);
  }

  viewerStore.scale = Math.max(0.2, Math.min(5, nextScale));
}

watch(
  [
    () => viewerStore.fitMode,
    () => viewerStore.globalRotation,
    () => viewerStore.currentPage,
    currentPageRef,
    currentSourceSize,
  ],
  () => {
    nextTick(applyFitMode);
  },
  { deep: true }
);

// ResizeObserver keeps fit modes accurate when the window/sidebars change size.
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (!scrollContainerRef.value) return;

  resizeObserver = new ResizeObserver(() => {
    applyFitMode();
  });

  resizeObserver.observe(scrollContainerRef.value);
  nextTick(applyFitMode);
});

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});
</script>

