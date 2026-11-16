import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type FitMode = 'fit-width' | 'fit-page' | 'actual' | 'custom';

export const useViewerStore = defineStore('viewer', () => {
  const currentPage = ref(1);
  const totalPages = ref(1);
  const scale = ref(1.0);
  const fitMode = ref<FitMode>('fit-width');
  const globalRotation = ref<0 | 90 | 180 | 270>(0);
  const searchQuery = ref('');
  const searchMatches = ref<{ pageIndex: number; matchIndex: number; total: number }[]>([]);
  const currentMatchIndex = ref(0);

  const zoomPercent = computed(() => Math.round(scale.value * 100));

  function setPage(page: number) {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page;
    }
  }

  function nextPage() {
    setPage(currentPage.value + 1);
  }

  function prevPage() {
    setPage(currentPage.value - 1);
  }

  function setScale(newScale: number) {
    scale.value = Math.max(0.2, Math.min(5.0, newScale));
    fitMode.value = 'custom';
  }

  function zoomIn() {
    setScale(scale.value * 1.15);
  }

  function zoomOut() {
    setScale(scale.value / 1.15);
  }

  function rotateClockwise() {
    globalRotation.value = ((globalRotation.value + 90) % 360) as 0 | 90 | 180 | 270;
  }

  function rotateCounterClockwise() {
    globalRotation.value = ((globalRotation.value + 270) % 360) as 0 | 90 | 180 | 270;
  }

  return {
    currentPage,
    totalPages,
    scale,
    fitMode,
    globalRotation,
    searchQuery,
    searchMatches,
    currentMatchIndex,
    zoomPercent,
    setPage,
    nextPage,
    prevPage,
    setScale,
    zoomIn,
    zoomOut,
    rotateClockwise,
    rotateCounterClockwise,
  };
});

