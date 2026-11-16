<template>
  <div class="absolute inset-0 z-[1] overflow-hidden">
    <canvas ref="canvasRef" class="block w-full h-full pointer-events-none"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import type { RenderTask } from 'pdfjs-dist';
import { CoordinateConverter } from '@/services/coordinateConverter';

const props = defineProps<{
  page: any;
  scale: number;
  rotation: 0 | 90 | 180 | 270;
  width: number;
  height: number;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let currentRenderTask: RenderTask | null = null;

async function renderCanvas() {
  if (!canvasRef.value || !props.page) return;

  // Cancel any running render task on this canvas before starting a new one
  if (currentRenderTask) {
    currentRenderTask.cancel();
    currentRenderTask = null;
  }

  try {
    const canvas = canvasRef.value;
    const dpr = window.devicePixelRatio || 1;

    // Use high-DPI canvas setup: DPR exclusively applied to backing buffer
    const ctx = CoordinateConverter.setupCanvasResolution(
      canvas,
      props.width,
      props.height,
      dpr
    );

    const viewport = props.page.getViewport({
      scale: props.scale * dpr,
      rotation: props.rotation,
    });

    const task = props.page.render({
      canvasContext: ctx,
      viewport,
      intent: 'display',
    });
    currentRenderTask = task;

    await task.promise;
    currentRenderTask = null;
  } catch (err: any) {
    if (err?.name !== 'RenderingCancelledException') {
      console.warn('Canvas render error on page:', err);
    }
  }
}

onMounted(() => {
  renderCanvas();
});

watch(
  () => [props.scale, props.rotation, props.width, props.height],
  () => {
    renderCanvas();
  }
);

onBeforeUnmount(() => {
  if (currentRenderTask) {
    currentRenderTask.cancel();
    currentRenderTask = null;
  }
});
</script>
