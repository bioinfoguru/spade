<template>
  <div
    ref="overlayRef"
    class="absolute inset-0 z-[4] overflow-hidden select-none"
    :class="{
      'cursor-crosshair': ['draw', 'shape', 'highlight', 'text', 'redact'].includes(appStore.activeTool),
      'cursor-default': appStore.activeTool === 'select',
      'cursor-grab': appStore.activeTool === 'hand'
    }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
  >
    <!-- 1. SVG Layer for vector shapes, ink paths, and highlights -->
    <svg class="absolute inset-0 w-full h-full pointer-events-none">
      <!-- Existing / Committed Annotations for this page -->
      <g v-for="annot in pageAnnotations" :key="annot.id">
        <!-- Ink / Freehand drawing -->
        <template v-if="annot.type === 'ink'">
          <path
            v-for="(path, pIdx) in annot.paths"
            :key="pIdx"
            :d="renderSvgPath(path)"
            :stroke="annot.color"
            :stroke-width="annot.strokeWidth * scale"
            :stroke-opacity="annot.opacity"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </template>

        <!-- Rectangle shape -->
        <template v-else-if="annot.type === 'square'">
          <rect
            :x="toScreenX(annot.rect.x)"
            :y="toScreenY(annot.rect.y + annot.rect.height)"
            :width="annot.rect.width * scale"
            :height="annot.rect.height * scale"
            :stroke="annot.color"
            :stroke-width="annot.strokeWidth * scale"
            :fill="annot.fillColor || 'none'"
            :stroke-opacity="annot.opacity"
          />
        </template>

        <!-- Circle shape -->
        <template v-else-if="annot.type === 'circle'">
          <ellipse
            :cx="toScreenX(annot.rect.x + annot.rect.width / 2)"
            :cy="toScreenY(annot.rect.y + annot.rect.height / 2)"
            :rx="(annot.rect.width / 2) * scale"
            :ry="(annot.rect.height / 2) * scale"
            :stroke="annot.color"
            :stroke-width="annot.strokeWidth * scale"
            :fill="annot.fillColor || 'none'"
            :stroke-opacity="annot.opacity"
          />
        </template>
      </g>

      <!-- Active Drawing In-Progress -->
      <path
        v-if="currentDrawingPoints.length > 1"
        :d="renderSvgPixelPath(currentDrawingPoints)"
        :stroke="appStore.strokeColor"
        :stroke-width="appStore.strokeWidth * scale"
        :stroke-opacity="appStore.opacity"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- Active Shape Drag In-Progress -->
      <rect
        v-if="activeShapeRect"
        :x="activeShapeRect.x"
        :y="activeShapeRect.y"
        :width="activeShapeRect.width"
        :height="activeShapeRect.height"
        :stroke="appStore.strokeColor"
        :stroke-width="appStore.strokeWidth * scale"
        :fill="appStore.fillColor"
        :stroke-opacity="appStore.opacity"
        stroke-dasharray="4"
      />

      <!-- Active Redaction In-Progress -->
      <rect
        v-if="activeRedactionRect"
        :x="activeRedactionRect.x"
        :y="activeRedactionRect.y"
        :width="activeRedactionRect.width"
        :height="activeRedactionRect.height"
        fill="rgba(220, 38, 38, 0.4)"
        stroke="#dc2626"
        stroke-width="1.5"
        stroke-dasharray="3"
      />
    </svg>

    <!-- 2. Committed Redaction Marks -->
    <div
      v-for="redact in pageRedactions"
      :key="redact.id"
      class="absolute bg-black text-white font-mono text-[9px] flex items-center justify-center pointer-events-auto border border-red-500/80 shadow-xs"
      :style="{
        left: `${toScreenX(redact.rect.x)}px`,
        top: `${toScreenY(redact.rect.y + redact.rect.height)}px`,
        width: `${redact.rect.width * scale}px`,
        height: `${redact.rect.height * scale}px`,
      }"
    >
      <span>REDACTED</span>
    </div>

    <!-- 3. Inserted Text Boxes -->
    <div
      v-for="textObj in pageTextObjects"
      :key="textObj.id"
      class="absolute pointer-events-auto group border border-transparent hover:border-primary/50 focus-within:border-primary p-0.5 rounded transition-colors"
      :style="{
        left: `${toScreenX(textObj.rect.x)}px`,
        top: `${toScreenY(textObj.rect.y + textObj.rect.height)}px`,
        width: `${textObj.rect.width * scale}px`,
        minHeight: `${textObj.rect.height * scale}px`,
      }"
    >
      <textarea
        v-model="textObj.text"
        class="w-full h-full bg-transparent resize-none border-0 focus:outline-none overflow-hidden leading-tight"
        :style="{
          color: textObj.color,
          fontSize: `${textObj.fontSize * scale}px`,
          fontFamily: textObj.fontFamily,
          fontWeight: textObj.isBold ? 'bold' : 'normal',
          fontStyle: textObj.isItalic ? 'italic' : 'normal',
          textAlign: textObj.alignment,
          opacity: textObj.opacity,
        }"
      ></textarea>
    </div>

    <!-- 4. Inserted Images -->
    <div
      v-for="img in pageImageObjects"
      :key="img.id"
      class="absolute pointer-events-auto group border border-transparent hover:border-primary/50 rounded overflow-hidden shadow-xs cursor-move"
      :style="{
        left: `${toScreenX(img.rect.x)}px`,
        top: `${toScreenY(img.rect.y + img.rect.height)}px`,
        width: `${img.rect.width * scale}px`,
        height: `${img.rect.height * scale}px`,
        opacity: img.opacity,
      }"
    >
      <img :src="img.imageDataUrl" class="w-full h-full object-contain pointer-events-none" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '@/stores/appStore';
import { useOperationStore } from '@/stores/operationStore';
import { useHistoryStore } from '@/stores/historyStore';
import { CoordinateConverter } from '@/services/coordinateConverter';
import { Point, Rect, PageViewportTransform } from '@/types/geometry';
import { InkAnnotationData, ShapeAnnotationData, InsertedTextObject } from '@/types/operations';

const props = defineProps<{
  pageIndex: number;
  scale: number;
  rotation: 0 | 90 | 180 | 270;
  rawWidth: number;
  rawHeight: number;
}>();

const appStore = useAppStore();
const opStore = useOperationStore();
const historyStore = useHistoryStore();

const overlayRef = ref<HTMLDivElement | null>(null);

// Interactive state
const isInteracting = ref(false);
const startPoint = ref<Point | null>(null);
const currentDrawingPoints = ref<Point[]>([]);
const activeShapeRect = ref<Rect | null>(null);
const activeRedactionRect = ref<Rect | null>(null);

// Viewport transform helper
const viewport = computed<PageViewportTransform>(() => ({
  scale: props.scale,
  rotation: props.rotation,
  offsetX: 0,
  offsetY: 0,
  width: props.rawWidth * props.scale,
  height: props.rawHeight * props.scale,
  rawWidth: props.rawWidth,
  rawHeight: props.rawHeight,
}));

// Filter items for this page
const pageAnnotations = computed(() =>
  opStore.annotations.filter((a) => a.pageIndex === props.pageIndex)
);
const pageTextObjects = computed(() =>
  opStore.textObjects.filter((t) => t.pageIndex === props.pageIndex)
);
const pageImageObjects = computed(() =>
  opStore.imageObjects.filter((img) => img.pageIndex === props.pageIndex)
);
const pageRedactions = computed(() =>
  opStore.redactionMarks.filter((r) => r.pageIndex === props.pageIndex)
);

// Coordinate conversion helpers
function toScreenX(pdfX: number): number {
  return CoordinateConverter.pdfPointToViewportPixel({ x: pdfX, y: 0 }, viewport.value).x;
}
function toScreenY(pdfY: number): number {
  return CoordinateConverter.pdfPointToViewportPixel({ x: 0, y: pdfY }, viewport.value).y;
}

function getLocalPixelCoords(e: PointerEvent): Point {
  const rect = overlayRef.value!.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

function onPointerDown(e: PointerEvent) {
  if (['select', 'hand'].includes(appStore.activeTool)) return;

  isInteracting.value = true;
  const pixelPoint = getLocalPixelCoords(e);
  startPoint.value = pixelPoint;

  if (appStore.activeTool === 'draw') {
    currentDrawingPoints.value = [pixelPoint];
  } else if (appStore.activeTool === 'text') {
    // Spawn new text box at point
    const pdfPoint = CoordinateConverter.viewportPixelToPdfPoint(pixelPoint, viewport.value);
    const newTextBox: InsertedTextObject = {
      id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      pageIndex: props.pageIndex,
      rect: {
        x: pdfPoint.x,
        y: pdfPoint.y - 30,
        width: 150,
        height: 35,
      },
      text: 'Click to edit text',
      fontFamily: appStore.fontFamily,
      fontSize: appStore.fontSize,
      color: appStore.textColor,
      isBold: appStore.isBold,
      isItalic: appStore.isItalic,
      alignment: appStore.textAlign,
      opacity: appStore.opacity,
    };

    historyStore.pushOperation({
      id: `op-${Date.now()}`,
      type: 'insert_text_box',
      documentId: 'doc',
      documentRevision: opStore.currentRevision + 1,
      payload: { textObject: newTextBox },
      inversePayload: { textObjectId: newTextBox.id, pageIndex: props.pageIndex },
      timestamp: Date.now(),
    });

    isInteracting.value = false;
    appStore.setTool('select');
  }
}

function onPointerMove(e: PointerEvent) {
  if (!isInteracting.value || !startPoint.value) return;

  const current = getLocalPixelCoords(e);

  if (appStore.activeTool === 'draw') {
    currentDrawingPoints.value.push(current);
  } else if (appStore.activeTool === 'shape') {
    activeShapeRect.value = {
      x: Math.min(startPoint.value.x, current.x),
      y: Math.min(startPoint.value.y, current.y),
      width: Math.abs(current.x - startPoint.value.x),
      height: Math.abs(current.y - startPoint.value.y),
    };
  } else if (appStore.activeTool === 'redact') {
    activeRedactionRect.value = {
      x: Math.min(startPoint.value.x, current.x),
      y: Math.min(startPoint.value.y, current.y),
      width: Math.abs(current.x - startPoint.value.x),
      height: Math.abs(current.y - startPoint.value.y),
    };
  }
}

function onPointerUp(_e: PointerEvent) {
  if (!isInteracting.value || !startPoint.value) return;

  if (appStore.activeTool === 'draw' && currentDrawingPoints.value.length > 1) {
    // Convert screen points to PDF User Space points
    const pdfPath = currentDrawingPoints.value.map((p) =>
      CoordinateConverter.viewportPixelToPdfPoint(p, viewport.value)
    );

    const minX = Math.min(...pdfPath.map((p) => p.x));
    const maxX = Math.max(...pdfPath.map((p) => p.x));
    const minY = Math.min(...pdfPath.map((p) => p.y));
    const maxY = Math.max(...pdfPath.map((p) => p.y));

    const inkAnnot: InkAnnotationData = {
      id: `ink-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      pageIndex: props.pageIndex,
      type: 'ink',
      rect: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      paths: [pdfPath],
      color: appStore.strokeColor,
      strokeWidth: appStore.strokeWidth,
      opacity: appStore.opacity,
      createdAt: Date.now(),
    };

    historyStore.pushOperation({
      id: `op-${Date.now()}`,
      type: 'add_annotation',
      documentId: 'doc',
      documentRevision: opStore.currentRevision + 1,
      payload: { annotation: inkAnnot },
      inversePayload: { annotationId: inkAnnot.id, pageIndex: props.pageIndex },
      timestamp: Date.now(),
    });
  } else if (appStore.activeTool === 'shape' && activeShapeRect.value && activeShapeRect.value.width > 5) {
    const pdfRect = CoordinateConverter.viewportRectToPdfRect(activeShapeRect.value, viewport.value);
    const shapeAnnot: ShapeAnnotationData = {
      id: `shape-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      pageIndex: props.pageIndex,
      type: 'square',
      rect: pdfRect,
      color: appStore.strokeColor,
      fillColor: appStore.fillColor,
      strokeWidth: appStore.strokeWidth,
      opacity: appStore.opacity,
      createdAt: Date.now(),
    };

    historyStore.pushOperation({
      id: `op-${Date.now()}`,
      type: 'add_annotation',
      documentId: 'doc',
      documentRevision: opStore.currentRevision + 1,
      payload: { annotation: shapeAnnot },
      inversePayload: { annotationId: shapeAnnot.id, pageIndex: props.pageIndex },
      timestamp: Date.now(),
    });
  } else if (appStore.activeTool === 'redact' && activeRedactionRect.value && activeRedactionRect.value.width > 5) {
    const pdfRect = CoordinateConverter.viewportRectToPdfRect(activeRedactionRect.value, viewport.value);
    const redactionMark = {
      id: `redact-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      pageIndex: props.pageIndex,
      rect: pdfRect,
      fillColor: '#000000',
    };

    historyStore.pushOperation({
      id: `op-${Date.now()}`,
      type: 'mark_redaction',
      documentId: 'doc',
      documentRevision: opStore.currentRevision + 1,
      payload: { mark: redactionMark },
      inversePayload: { markId: redactionMark.id, pageIndex: props.pageIndex },
      timestamp: Date.now(),
    });
  }

  // Reset interactive flags
  isInteracting.value = false;
  startPoint.value = null;
  currentDrawingPoints.value = [];
  activeShapeRect.value = null;
  activeRedactionRect.value = null;
}

function renderSvgPixelPath(pts: Point[]): string {
  if (pts.length === 0) return '';
  return `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
}

function renderSvgPath(pdfPts: Point[]): string {
  if (pdfPts.length === 0) return '';
  const screenPts = pdfPts.map((p) => CoordinateConverter.pdfPointToViewportPixel(p, viewport.value));
  return renderSvgPixelPath(screenPts);
}
</script>
