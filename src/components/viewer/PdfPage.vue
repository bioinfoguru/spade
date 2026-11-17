<template>
  <div
    class="relative bg-white shadow-md rounded-xs border border-border/40 transition-shadow hover:shadow-lg"
    :class="{ 'overflow-hidden': !showFullPage }"
    :data-page-id="pageId"
    :style="{
      width: `${computedWidth}px`,
      height: `${computedHeight}px`,
      transformOrigin: '0 0',
    }"
  >
    <!-- Full-page inner layer. When cropped, this is shifted underneath the clipped outer frame. -->
    <div
      class="absolute"
      :style="{
        left: `${innerOffsetX}px`,
        top: `${innerOffsetY}px`,
        width: `${fullWidth}px`,
        height: `${fullHeight}px`,
      }"
    >
      <!-- Layer 1: Rasterized Canvas Bitmap -->
      <PageCanvasLayer
        v-if="pageProxy"
        :page="pageProxy"
        :scale="effectiveScale"
        :rotation="effectiveRotation"
        :width="fullWidth"
        :height="fullHeight"
      />

      <!-- Layer 2: Text Selection & Search Highlights -->
      <PageTextLayer
        v-if="pageProxy"
        :page="pageProxy"
        :page-index="pageIndex"
        :scale="effectiveScale"
        :rotation="effectiveRotation"
        :raw-width="rawWidth"
        :raw-height="rawHeight"
      />

      <!-- Layer 3: AcroForms & Interactive Links -->
      <PageFormLayer
        v-if="pageProxy"
        :page="pageProxy"
        :scale="effectiveScale"
        :rotation="effectiveRotation"
      />

      <!-- Layer 4: Interactive Editor & Annotation Overlay -->
      <PageEditorOverlay
        :page-index="pageIndex"
        :scale="effectiveScale"
        :rotation="effectiveRotation"
        :raw-width="rawWidth"
        :raw-height="rawHeight"
      />

      <!-- Layer 5: Interactive Crop Rectangle -->
      <PageCropOverlay
        v-if="isCropping && pageProxy"
        :page-id="pageId"
        :scale="effectiveScale"
        :rotation="effectiveRotation"
        :raw-width="rawWidth"
        :raw-height="rawHeight"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, shallowRef } from 'vue';
import { useDocumentStore } from '@/stores/documentStore';
import { useViewerStore } from '@/stores/viewerStore';
import { useOperationStore } from '@/stores/operationStore';
import { useAppStore } from '@/stores/appStore';
import { CoordinateConverter } from '@/services/coordinateConverter';
import { PageViewportTransform, Rect } from '@/types/geometry';
import PageCanvasLayer from './PageCanvasLayer.vue';
import PageTextLayer from './PageTextLayer.vue';
import PageFormLayer from './PageFormLayer.vue';
import PageEditorOverlay from './PageEditorOverlay.vue';
import PageCropOverlay from './PageCropOverlay.vue';

const props = defineProps<{
  pageId: string; // Stable identity for this page instance
  pageIndex: number; // 0-based source page index in the original PDF
}>();

const docStore = useDocumentStore();
const viewerStore = useViewerStore();
const opStore = useOperationStore();
const appStore = useAppStore();

const pageProxy = shallowRef<any>(null);
const rawWidth = ref(612);
const rawHeight = ref(792);

const effectiveRotation = computed<0 | 90 | 180 | 270>(() => {
  const nativeRot = opStore.pageNativeRotations[props.pageIndex] || 0;
  const pageRot = opStore.pageRotations[props.pageId] || 0;
  const globalRot = viewerStore.globalRotation;
  return (((nativeRot + pageRot + globalRot) % 360) + 360) % 360 as 0 | 90 | 180 | 270;
});

const effectiveScale = computed(() => viewerStore.scale);

const isRotated90or270 = computed(() => [90, 270].includes(effectiveRotation.value));

const fullWidth = computed(() => {
  const w = isRotated90or270.value ? rawHeight.value : rawWidth.value;
  return Math.floor(w * effectiveScale.value);
});

const fullHeight = computed(() => {
  const h = isRotated90or270.value ? rawWidth.value : rawHeight.value;
  return Math.floor(h * effectiveScale.value);
});

const viewport = computed<PageViewportTransform>(() => ({
  scale: effectiveScale.value,
  rotation: effectiveRotation.value,
  offsetX: 0,
  offsetY: 0,
  width: fullWidth.value,
  height: fullHeight.value,
  rawWidth: rawWidth.value,
  rawHeight: rawHeight.value,
}));

const pagePosition = computed(
  () => opStore.pages.findIndex((page) => page.id === props.pageId) + 1
);

const isCropping = computed(
  () => appStore.activeTool === 'crop' && pagePosition.value === viewerStore.currentPage
);

const pageCrop = computed<Rect | null>(() => opStore.pageCrops[props.pageId] || null);

const cropViewportRect = computed<Rect>(() => {
  if (!pageCrop.value) {
    return { x: 0, y: 0, width: fullWidth.value, height: fullHeight.value };
  }
  return CoordinateConverter.pdfRectToViewportRect(pageCrop.value, viewport.value);
});

const showFullPage = computed(() => isCropping.value || !pageCrop.value);

const computedWidth = computed(() =>
  Math.max(1, Math.floor(showFullPage.value ? fullWidth.value : cropViewportRect.value.width))
);

const computedHeight = computed(() =>
  Math.max(1, Math.floor(showFullPage.value ? fullHeight.value : cropViewportRect.value.height))
);

const innerOffsetX = computed(() => (showFullPage.value ? 0 : -cropViewportRect.value.x));
const innerOffsetY = computed(() => (showFullPage.value ? 0 : -cropViewportRect.value.y));

onMounted(async () => {
  if (!docStore.pdfProxy) return;
  try {
    const page = await docStore.pdfProxy.getPage(props.pageIndex + 1);
    pageProxy.value = page;
    const nativeViewport = page.getViewport({ scale: 1.0 });
    const unscaledViewport = page.getViewport({ scale: 1.0, rotation: 0 });
    rawWidth.value = unscaledViewport.width;
    rawHeight.value = unscaledViewport.height;
    opStore.setPageSize(props.pageIndex, rawWidth.value, rawHeight.value);
    opStore.setPageNativeRotation(props.pageIndex, nativeViewport.rotation);
  } catch (err) {
    console.warn(`Could not load page ${props.pageIndex + 1}:`, err);
  }
});
</script>
