<template>
  <div
    ref="containerRef"
    class="textLayer select-text"
    :class="{ 'textLayer--markup': isTextMarkupTool }"
  ></div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
import * as pdfjsLib from 'pdfjs-dist';
import { useAppStore } from '@/stores/appStore';
import { useOperationStore } from '@/stores/operationStore';
import { useHistoryStore } from '@/stores/historyStore';
import { CoordinateConverter } from '@/services/coordinateConverter';
import { PageViewportTransform, Rect } from '@/types/geometry';
import { HighlightAnnotationData } from '@/types/operations';

const props = defineProps<{
  page: any;
  pageIndex: number;
  scale: number;
  rotation: 0 | 90 | 180 | 270;
  rawWidth: number;
  rawHeight: number;
}>();

const appStore = useAppStore();
const opStore = useOperationStore();
const historyStore = useHistoryStore();

const containerRef = ref<HTMLDivElement | null>(null);
let textLayerTask: any = null;

const isTextMarkupTool = computed(() => appStore.activeTool === 'highlight');

const viewport = computed<PageViewportTransform>(() => {
  const isRotated90or270 = props.rotation === 90 || props.rotation === 270;
  return {
    scale: props.scale,
    rotation: props.rotation,
    offsetX: 0,
    offsetY: 0,
    width: (isRotated90or270 ? props.rawHeight : props.rawWidth) * props.scale,
    height: (isRotated90or270 ? props.rawWidth : props.rawHeight) * props.scale,
    rawWidth: props.rawWidth,
    rawHeight: props.rawHeight,
  };
});

async function renderTextLayer() {
  if (!containerRef.value || !props.page) return;

  const container = containerRef.value;
  container.innerHTML = '';

  try {
    const pageViewport = props.page.getViewport({
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
        viewport: pageViewport,
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

/**
 * Converts the current DOM text selection into one highlight annotation per
 * selected line. Runs on a window-level mouseup so a selection that ends
 * outside the page still gets picked up, and so selections spanning several
 * pages are handled by each page's text layer independently.
 */
function onWindowMouseUp() {
  if (appStore.activeTool !== 'highlight') return;
  const container = containerRef.value;
  const selection = window.getSelection();
  if (!container || !selection || selection.isCollapsed || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const pageRect = container.getBoundingClientRect();
  if (pageRect.width < 1 || pageRect.height < 1) return;

  const clientRects = Array.from(range.getClientRects());
  if (clientRects.length === 0) return;

  const pdfRects: Rect[] = [];

  for (const rect of clientRects) {
    // Keep only the portion of each selection rect that lies on this page.
    const left = Math.max(rect.left, pageRect.left);
    const right = Math.min(rect.right, pageRect.right);
    const top = Math.max(rect.top, pageRect.top);
    const bottom = Math.min(rect.bottom, pageRect.bottom);

    if (right - left < 1 || bottom - top < 1) continue;

    const pdfRect = CoordinateConverter.viewportRectToPdfRect(
      {
        x: left - pageRect.left,
        y: top - pageRect.top,
        width: right - left,
        height: bottom - top,
      },
      viewport.value
    );

    if (pdfRect.width < 0.5 || pdfRect.height < 0.5) continue;
    pdfRects.push(pdfRect);
  }

  if (pdfRects.length === 0) return;

  for (const rect of pdfRects) {
    const highlight: HighlightAnnotationData = {
      id: `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      pageIndex: props.pageIndex,
      type: 'highlight',
      rect,
      color: appStore.highlightColor || '#facc15',
      opacity: appStore.highlightOpacity,
      createdAt: Date.now(),
    };

    historyStore.pushOperation({
      id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'add_annotation',
      documentId: 'doc',
      documentRevision: opStore.currentRevision + 1,
      payload: { annotation: highlight },
      inversePayload: { annotationId: highlight.id, pageIndex: props.pageIndex },
      timestamp: Date.now(),
    });
  }

  // Defer clearing so every mounted page can read the selection first; this
  // keeps multi-page selections working when each page adds its own highlights.
  setTimeout(() => window.getSelection()?.removeAllRanges(), 0);
}

onMounted(() => {
  renderTextLayer();
  window.addEventListener('mouseup', onWindowMouseUp);
});

watch(
  () => [props.scale, props.rotation],
  () => {
    renderTextLayer();
  }
);

onBeforeUnmount(() => {
  window.removeEventListener('mouseup', onWindowMouseUp);
  if (textLayerTask?.cancel) {
    textLayerTask.cancel();
  }
});
</script>
