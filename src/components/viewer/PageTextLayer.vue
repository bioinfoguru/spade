<template>
  <div ref="containerRef" class="textLayer select-text"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue';
import * as pdfjsLib from 'pdfjs-dist';

const props = defineProps<{
  page: any;
  scale: number;
  rotation: 0 | 90 | 180 | 270;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
let textLayerTask: any = null;

async function renderTextLayer() {
  if (!containerRef.value || !props.page) return;

  const container = containerRef.value;
  container.innerHTML = '';

  try {
    const viewport = props.page.getViewport({
      scale: props.scale,
      rotation: props.rotation,
    });

    const textContent = await props.page.getTextContent();
    
    // In PDF.js v4, TextLayer is instantiated as a class
    const TextLayerClass = (pdfjsLib as any).TextLayer;
    if (TextLayerClass) {
      const textLayer = new TextLayerClass({
        textContentSource: textContent,
        container,
        viewport,
      });
      textLayerTask = textLayer;
      await textLayer.render();
    }
  } catch (err: any) {
    if (err?.name !== 'RenderingCancelledException') {
      console.warn('Text layer render failed:', err);
    }
  }
}

onMounted(() => {
  renderTextLayer();
});

watch(
  () => [props.scale, props.rotation],
  () => {
    renderTextLayer();
  }
);

onBeforeUnmount(() => {
  if (textLayerTask?.cancel) {
    textLayerTask.cancel();
  }
});
</script>
