<template>
  <footer class="h-8 bg-card border-t border-border flex items-center justify-between px-3 text-xs select-none z-30 shrink-0">
    <!-- Left: Page Navigation -->
    <div class="flex items-center space-x-1.5">
      <button
        @click="viewerStore.prevPage()"
        :disabled="viewerStore.currentPage <= 1"
        class="p-1 rounded text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
        title="Previous Page"
      >
        <ChevronLeft class="w-3.5 h-3.5" />
      </button>

      <div class="flex items-center space-x-1 font-mono text-[11px] text-foreground">
        <span>Page</span>
        <input
          v-model.lazy.number="pageInput"
          type="number"
          min="1"
          :max="viewerStore.totalPages"
          class="w-10 text-center bg-background border border-border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary font-mono text-[11px]"
        />
        <span class="text-muted-foreground">of {{ viewerStore.totalPages }}</span>
      </div>

      <button
        @click="viewerStore.nextPage()"
        :disabled="viewerStore.currentPage >= viewerStore.totalPages"
        class="p-1 rounded text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
        title="Next Page"
      >
        <ChevronRight class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Center: Fit Mode Presets -->
    <div class="flex items-center space-x-1 bg-secondary/50 p-0.5 rounded border border-border/50 text-[11px]">
      <button
        @click="setFitMode('fit-width')"
        :class="[
          'px-2 py-0.5 rounded transition-colors',
          viewerStore.fitMode === 'fit-width'
            ? 'bg-primary text-primary-foreground font-medium'
            : 'text-foreground hover:bg-muted'
        ]"
      >
        Fit Width
      </button>
      <button
        @click="setFitMode('fit-page')"
        :class="[
          'px-2 py-0.5 rounded transition-colors',
          viewerStore.fitMode === 'fit-page'
            ? 'bg-primary text-primary-foreground font-medium'
            : 'text-foreground hover:bg-muted'
        ]"
      >
        Fit Page
      </button>
      <button
        @click="setFitMode('actual')"
        :class="[
          'px-2 py-0.5 rounded transition-colors',
          viewerStore.fitMode === 'actual'
            ? 'bg-primary text-primary-foreground font-medium'
            : 'text-foreground hover:bg-muted'
        ]"
      >
        100%
      </button>
    </div>

    <!-- Right: Zoom Slider & Save Status -->
    <div class="flex items-center space-x-3">
      <!-- Save status indicator -->
      <div class="flex items-center space-x-1.5 text-[11px]">
        <span
          :class="[
            'w-1.5 h-1.5 rounded-full',
            docStore.currentDoc?.isDirty ? 'bg-amber-500' : 'bg-emerald-500'
          ]"
        ></span>
        <span class="text-muted-foreground">
          {{ docStore.currentDoc?.isDirty ? 'Unsaved Edits' : 'Saved' }}
        </span>
      </div>

      <!-- Zoom Slider -->
      <div class="flex items-center space-x-1.5">
        <input
          type="range"
          min="0.2"
          max="3.0"
          step="0.05"
          :value="viewerStore.scale"
          @input="onSliderZoom"
          class="w-20 accent-primary cursor-pointer"
        />
        <span class="w-10 text-right font-mono text-[11px] text-foreground">
          {{ viewerStore.zoomPercent }}%
        </span>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { useViewerStore, FitMode } from '@/stores/viewerStore';
import { useDocumentStore } from '@/stores/documentStore';

const viewerStore = useViewerStore();
const docStore = useDocumentStore();

const pageInput = computed({
  get: () => viewerStore.currentPage,
  set: (val: number) => viewerStore.setPage(val),
});

function setFitMode(mode: FitMode) {
  viewerStore.fitMode = mode;
  if (mode === 'actual') {
    viewerStore.setScale(1.0);
  }
}

function onSliderZoom(e: Event) {
  const target = e.target as HTMLInputElement;
  viewerStore.setScale(parseFloat(target.value));
}
</script>
