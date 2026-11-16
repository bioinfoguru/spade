<template>
  <div
    class="relative bg-white shadow-md rounded-xs border border-border/40 transition-shadow hover:shadow-lg"
    :style="{
      width: `${computedWidth}px`,
      height: `${computedHeight}px`,
      transformOrigin: '0 0',
    }"
  >
    <!-- Layer 1: Rasterized Canvas Bitmap -->
    <PageCanvasLayer
      v-if="pageProxy"
      :page="pageProxy"
      :scale="effectiveScale"
      :rotation="effectiveRotation"
      :width="computedWidth"
      :height="computedHeight"
    />

    <!-- Layer 2: Text Selection & Search Highlights -->
    <PageTextLayer
      v-if="pageProxy"
      :page="pageProxy"
      :scale="effectiveScale"
      :rotation="effectiveRotation"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, shallowRef } from 'vue';
import { useDocumentStore } from '@/stores/documentStore';
import { useViewerStore } from '@/stores/viewerStore';
import { useOperationStore } from '@/stores/operationStore';
import PageCanvasLayer from './PageCanvasLayer.vue';
import PageTextLayer from './PageTextLayer.vue';
import PageFormLayer from './PageFormLayer.vue';
import PageEditorOverlay from './PageEditorOverlay.vue';

const props = defineProps<{
  pageIndex: number; // 0-based page index
}>();

const docStore = useDocumentStore();
const viewerStore = useViewerStore();
const opStore = useOperationStore();

const pageProxy = shallowRef<any>(null);
const rawWidth = ref(612);
const rawHeight = ref(792);

const effectiveRotation = computed<0 | 90 | 180 | 270>(() => {
  const pageRot = opStore.pageRotations[props.pageIndex] || 0;
  const globalRot = viewerStore.globalRotation;
  return ((pageRot + globalRot) % 360) as 0 | 90 | 180 | 270;
});

const effectiveScale = computed(() => viewerStore.scale);

const isRotated90or270 = computed(() => [90, 270].includes(effectiveRotation.value));

const computedWidth = computed(() => {
  const w = isRotated90or270.value ? rawHeight.value : rawWidth.value;
  return Math.floor(w * effectiveScale.value);
});

const computedHeight = computed(() => {
  const h = isRotated90or270.value ? rawWidth.value : rawHeight.value;
  return Math.floor(h * effectiveScale.value);
});

onMounted(async () => {
  if (!docStore.pdfProxy) return;
  try {
    const page = await docStore.pdfProxy.getPage(props.pageIndex + 1);
    pageProxy.value = page;
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    rawWidth.value = unscaledViewport.width;
    rawHeight.value = unscaledViewport.height;
  } catch (err) {
    console.warn(`Could not load page ${props.pageIndex + 1}:`, err);
  }
});
</script>
