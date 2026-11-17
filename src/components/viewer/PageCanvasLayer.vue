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
let renderSequence = 0;

async function cancelCurrentRender(): Promise<void> {
  const task = currentRenderTask;
  if (!task) return;

  currentRenderTask = null;
  try {
    task.cancel();
  } catch {
    // Ignore tasks that already finished.
  }
  try {
    await task.promise;
  } catch (err: any) {
    if (err?.name !== 'RenderingCancelledException') {
      console.warn('Canvas render cancel error:', err);
    }
  }
}

async function renderCanvas() {
  if (!canvasRef.value || !props.page) return;

  const sequence = ++renderSequence;
  await cancelCurrentRender();
  if (sequence !== renderSequence || !canvasRef.value) return;

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
      canvas,
      canvasContext: ctx,
      viewport,
      intent: 'display',
    });
    currentRenderTask = task;

    try {
      await task.promise;
    } finally {
      if (currentRenderTask === task) currentRenderTask = null;
    }
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
  renderSequence += 1;
  if (currentRenderTask) {
    currentRenderTask.cancel();
    currentRenderTask = null;
  }
});
</script>
