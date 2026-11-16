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
        View, annotate, edit text, organize pages, and truly redact sensitive documents.
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
        v-for="pageIndex in opStore.pageOrder"
        :key="pageIndex"
        :id="`pdf-page-container-${pageIndex}`"
        class="relative flex flex-col items-center"
      >
        <!-- Mounted Page within Virtualization Window -->
        <PdfPage
          v-if="isPageInVirtualWindow(pageIndex)"
          :page-index="pageIndex"
        />

        <!-- Lightweight Placeholder for Offscreen Pages -->
        <div
          v-else
          class="bg-card/40 border border-border/40 rounded-xs flex items-center justify-center text-muted-foreground text-xs font-mono shadow-xs"
          :style="{
            width: `${placeholderWidth}px`,
            height: `${placeholderHeight}px`,
          }"
        >
          Page {{ pageIndex + 1 }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { FileUp, FolderOpen } from 'lucide-vue-next';
import { useDocumentStore } from '@/stores/documentStore';
import { useViewerStore } from '@/stores/viewerStore';
import { useOperationStore } from '@/stores/operationStore';
import PdfPage from './PdfPage.vue';

const docStore = useDocumentStore();
const viewerStore = useViewerStore();
const opStore = useOperationStore();

const scrollContainerRef = ref<HTMLDivElement | null>(null);

defineEmits<{
  (e: 'open-file'): void;
}>();

// Estimated placeholder dimensions based on standard US Letter (612x792 pt)
const placeholderWidth = computed(() => Math.floor(612 * viewerStore.scale));
const placeholderHeight = computed(() => Math.floor(792 * viewerStore.scale));

// Virtualization sliding window: visible page +/- 1 lookahead page
function isPageInVirtualWindow(pageIndex: number): boolean {
  const currentZeroBased = viewerStore.currentPage - 1;
  const buffer = 1; // 1 lookahead page before and after
  return pageIndex >= currentZeroBased - buffer && pageIndex <= currentZeroBased + buffer;
}

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

// Detect visible page on scroll
function onScroll() {
  if (!scrollContainerRef.value || opStore.pageOrder.length === 0) return;
  const container = scrollContainerRef.value;
  const containerCenter = container.scrollTop + container.clientHeight / 2;

  let closestPageIndex = viewerStore.currentPage - 1;
  let minDistance = Infinity;

  for (const pageIdx of opStore.pageOrder) {
    const el = document.getElementById(`pdf-page-container-${pageIdx}`);
    if (el) {
      const elCenter = el.offsetTop + el.clientHeight / 2;
      const distance = Math.abs(containerCenter - elCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestPageIndex = pageIdx;
      }
    }
  }

  viewerStore.currentPage = closestPageIndex + 1;
}

// ResizeObserver for dynamic Fit Width and Fit Page
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (!scrollContainerRef.value) return;

  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const containerWidth = entry.contentRect.width;
      if (viewerStore.fitMode === 'fit-width' && containerWidth > 100) {
        // Fit width: standard page width ~612pt with 48px padding
        const targetScale = (containerWidth - 64) / 612;
        viewerStore.scale = Math.max(0.3, Math.min(3.0, targetScale));
      }
    }
  });

  resizeObserver.observe(scrollContainerRef.value);
});

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});
</script>
