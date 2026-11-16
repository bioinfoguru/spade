<template>
  <div
    ref="overlayRef"
    data-crop-overlay
    class="absolute inset-0 z-30 select-none touch-none overflow-hidden"
    @pointermove="onPointerMove"
    @pointerup="endDrag"
    @pointercancel="endDrag"
  >
    <!-- Crop selection rectangle. The huge box-shadow dims everything outside it. -->
    <div
      data-crop-rect
      class="absolute border-2 border-primary cursor-move"
      :style="cropRectStyle"
      @pointerdown.stop="startDrag($event, 'move')"
    >
      <!-- Rule-of-thirds guides -->
      <div class="pointer-events-none absolute inset-0 opacity-60">
        <div class="absolute top-0 bottom-0 left-1/3 w-px bg-primary/40"></div>
        <div class="absolute top-0 bottom-0 left-2/3 w-px bg-primary/40"></div>
        <div class="absolute left-0 right-0 top-1/3 h-px bg-primary/40"></div>
        <div class="absolute left-0 right-0 top-2/3 h-px bg-primary/40"></div>
      </div>

      <!-- Resize handles -->
      <div
        v-for="handle in handles"
        :key="handle.name"
        :data-handle="handle.name"
        class="absolute h-2.5 w-2.5 rounded-sm border border-primary bg-white shadow-sm"
        :class="[handle.positionClass, handle.cursorClass]"
        @pointerdown.stop="startDrag($event, handle.name)"
      ></div>
    </div>

    <!-- Floating action bar -->
    <div
      class="absolute left-1/2 top-3 z-40 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-card/95 px-2 py-1 shadow-xl backdrop-blur-sm"
      @pointerdown.stop
    >
      <span class="flex items-center gap-1 pl-0.5 text-[10px] font-semibold text-foreground">
        <Crop class="h-3 w-3 text-primary" />
        Crop Page
      </span>
      <span class="mx-0.5 h-4 w-px bg-border"></span>
      <button
        class="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Remove the crop from this page"
        @click="resetCrop"
      >
        <RotateCcw class="h-3 w-3" />
        Reset
      </button>
      <button
        class="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Cancel cropping"
        @click="cancelCrop"
      >
        <X class="h-3 w-3" />
        Cancel
      </button>
      <button
        class="flex items-center gap-1 rounded bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        title="Apply crop"
        @click="applyCrop"
      >
        <Check class="h-3 w-3" />
        Apply
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Check, Crop, RotateCcw, X } from '@lucide/vue';
import { useAppStore } from '@/stores/appStore';
import { useOperationStore } from '@/stores/operationStore';
import { useHistoryStore } from '@/stores/historyStore';
import { CoordinateConverter } from '@/services/coordinateConverter';
import { PageViewportTransform, Rect } from '@/types/geometry';

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
type DragMode = 'move' | ResizeHandle;

interface HandleDefinition {
  name: ResizeHandle;
  positionClass: string;
  cursorClass: string;
}

const props = defineProps<{
  pageId: string;
  scale: number;
  rotation: 0 | 90 | 180 | 270;
  rawWidth: number;
  rawHeight: number;
}>();

const appStore = useAppStore();
const opStore = useOperationStore();
const historyStore = useHistoryStore();

const overlayRef = ref<HTMLDivElement | null>(null);
const draftCrop = ref<Rect>({ x: 0, y: 0, width: props.rawWidth, height: props.rawHeight });

const MIN_CROP_PX = 20;

const handles: HandleDefinition[] = [
  { name: 'nw', positionClass: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2', cursorClass: 'cursor-nwse-resize' },
  { name: 'n', positionClass: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2', cursorClass: 'cursor-ns-resize' },
  { name: 'ne', positionClass: 'right-0 top-0 translate-x-1/2 -translate-y-1/2', cursorClass: 'cursor-nesw-resize' },
  { name: 'e', positionClass: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2', cursorClass: 'cursor-ew-resize' },
  { name: 'se', positionClass: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2', cursorClass: 'cursor-nwse-resize' },
  { name: 's', positionClass: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2', cursorClass: 'cursor-ns-resize' },
  { name: 'sw', positionClass: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2', cursorClass: 'cursor-nesw-resize' },
  { name: 'w', positionClass: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2', cursorClass: 'cursor-ew-resize' },
];

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

const draftViewportRect = computed(() =>
  CoordinateConverter.pdfRectToViewportRect(draftCrop.value, viewport.value)
);

const cropRectStyle = computed(() => {
  const rect = draftViewportRect.value;
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
  };
});

let dragState: {
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  startRect: Rect;
  pointerId: number;
} | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampPdfRect(rect: Rect): Rect {
  const width = clamp(rect.width, 0.5, props.rawWidth);
  const height = clamp(rect.height, 0.5, props.rawHeight);
  const x = clamp(rect.x, 0, Math.max(0, props.rawWidth - width));
  const y = clamp(rect.y, 0, Math.max(0, props.rawHeight - height));
  return { x, y, width, height };
}

function initDraft() {
  const existing = opStore.pageCrops[props.pageId];
  if (existing) {
    draftCrop.value = clampPdfRect({ ...existing });
  } else {
    draftCrop.value = {
      x: 0,
      y: 0,
      width: props.rawWidth,
      height: props.rawHeight,
    };
  }
}

watch(
  () => [props.pageId, props.rawWidth, props.rawHeight] as const,
  () => {
    if (!dragState) initDraft();
  },
  { immediate: true }
);

function startDrag(e: PointerEvent, mode: DragMode) {
  if (e.button !== 0) return;
  e.preventDefault();

  dragState = {
    mode,
    startClientX: e.clientX,
    startClientY: e.clientY,
    startRect: { ...draftViewportRect.value },
    pointerId: e.pointerId,
  };

  overlayRef.value?.setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!dragState || e.pointerId !== dragState.pointerId) return;

  const dx = e.clientX - dragState.startClientX;
  const dy = e.clientY - dragState.startClientY;
  const start = dragState.startRect;
  const maxWidth = viewport.value.width;
  const maxHeight = viewport.value.height;

  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;

  if (dragState.mode === 'move') {
    const width = Math.min(start.width, maxWidth);
    const height = Math.min(start.height, maxHeight);
    left = clamp(start.x + dx, 0, Math.max(0, maxWidth - width));
    top = clamp(start.y + dy, 0, Math.max(0, maxHeight - height));
    right = left + width;
    bottom = top + height;
  } else {
    const mode = dragState.mode;
    if (mode.includes('w')) {
      left = clamp(start.x + dx, 0, right - MIN_CROP_PX);
    }
    if (mode.includes('e')) {
      right = clamp(right + dx, left + MIN_CROP_PX, maxWidth);
    }
    if (mode.includes('n')) {
      top = clamp(start.y + dy, 0, bottom - MIN_CROP_PX);
    }
    if (mode.includes('s')) {
      bottom = clamp(bottom + dy, top + MIN_CROP_PX, maxHeight);
    }
  }

  const nextViewportRect: Rect = {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };

  draftCrop.value = clampPdfRect(
    CoordinateConverter.viewportRectToPdfRect(nextViewportRect, viewport.value)
  );
}

function endDrag(e: PointerEvent) {
  if (!dragState) return;
  if (e.pointerId === dragState.pointerId) {
    overlayRef.value?.releasePointerCapture(e.pointerId);
  }
  dragState = null;
}

function rectsAlmostEqual(a: Rect | null, b: Rect | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.x - b.x) < 0.1 &&
    Math.abs(a.y - b.y) < 0.1 &&
    Math.abs(a.width - b.width) < 0.1 &&
    Math.abs(a.height - b.height) < 0.1
  );
}

function applyCrop() {
  const next = clampPdfRect({ ...draftCrop.value });
  const isFullPage =
    next.x <= 0.5 &&
    next.y <= 0.5 &&
    next.width >= props.rawWidth - 1 &&
    next.height >= props.rawHeight - 1;
  const nextCrop = isFullPage ? null : next;
  const previousCrop = opStore.pageCrops[props.pageId]
    ? { ...opStore.pageCrops[props.pageId] }
    : null;

  if (!rectsAlmostEqual(previousCrop, nextCrop)) {
    historyStore.pushOperation({
      id: `op-${Date.now()}`,
      type: 'crop_page',
      documentId: 'doc',
      documentRevision: opStore.currentRevision + 1,
      payload: { pageId: props.pageId, crop: nextCrop },
      inversePayload: { pageId: props.pageId, crop: previousCrop },
      timestamp: Date.now(),
    });
  }

  appStore.setTool('select');
}

function resetCrop() {
  const previousCrop = opStore.pageCrops[props.pageId]
    ? { ...opStore.pageCrops[props.pageId] }
    : null;

  if (previousCrop) {
    historyStore.pushOperation({
      id: `op-${Date.now()}`,
      type: 'crop_page',
      documentId: 'doc',
      documentRevision: opStore.currentRevision + 1,
      payload: { pageId: props.pageId, crop: null },
      inversePayload: { pageId: props.pageId, crop: previousCrop },
      timestamp: Date.now(),
    });
  }

  appStore.setTool('select');
}

function cancelCrop() {
  appStore.setTool('select');
}
</script>
