<template>
  <div
    ref="overlayRef"
    class="absolute inset-0 z-[4] overflow-hidden select-none"
    :class="{
      'cursor-crosshair': ['draw', 'shape', 'highlight', 'text', 'note'].includes(appStore.activeTool),
      'cursor-default': appStore.activeTool === 'select',
      'cursor-grab': appStore.activeTool === 'hand'
    }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="finishDrag"
  >
    <!-- 1. SVG Layer for vector shapes, ink paths, and highlights -->
    <svg class="absolute inset-0 w-full h-full pointer-events-none">
      <!-- Existing / Committed Annotations for this page -->
      <g
        v-for="annot in pageAnnotations"
        :key="annot.id"
        :style="{
          pointerEvents: appStore.activeTool === 'select' ? 'auto' : 'none',
          cursor: appStore.activeTool === 'select' ? 'move' : 'default',
        }"
        @pointerdown.stop="startAnnotationDrag($event, annot)"
      >
        <!-- Highlight Annotation with Multiply blending -->
        <template v-if="annot.type === 'highlight'">
          <rect
            :x="toScreenX(annot.rect.x)"
            :y="toScreenY(annot.rect.y + annot.rect.height)"
            :width="annot.rect.width * scale"
            :height="annot.rect.height * scale"
            :fill="annot.color || '#facc15'"
            :fill-opacity="annot.opacity ?? 0.5"
            rx="2"
            style="mix-blend-mode: multiply;"
          />
        </template>

        <!-- Ink / Freehand drawing -->
        <template v-else-if="annot.type === 'ink'">
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
        <!-- Line shape -->
        <template v-else-if="annot.type === 'line'">
          <line
            :x1="toScreenX(annot.startPoint ? annot.startPoint.x : annot.rect.x)"
            :y1="toScreenY(annot.startPoint ? annot.startPoint.y : annot.rect.y)"
            :x2="toScreenX(annot.endPoint ? annot.endPoint.x : annot.rect.x + annot.rect.width)"
            :y2="toScreenY(annot.endPoint ? annot.endPoint.y : annot.rect.y + annot.rect.height)"
            :stroke="annot.color"
            :stroke-width="annot.strokeWidth * scale"
            :stroke-opacity="annot.opacity"
            stroke-linecap="round"
          />
        </template>
      </g>

      <!-- Active Highlight In-Progress -->
      <rect
        v-if="activeHighlightRect"
        :x="activeHighlightRect.x"
        :y="activeHighlightRect.y"
        :width="activeHighlightRect.width"
        :height="activeHighlightRect.height"
        :fill="appStore.strokeColor"
        :fill-opacity="appStore.highlightOpacity"
        :stroke="appStore.strokeColor"
        stroke-width="1"
        rx="2"
        style="mix-blend-mode: multiply;"
      />

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
      <template v-if="activeShapeRect && appStore.shapeType === 'line' && startPoint && activeShapeEndPoint">
        <line
          :x1="startPoint.x"
          :y1="startPoint.y"
          :x2="activeShapeEndPoint.x"
          :y2="activeShapeEndPoint.y"
          :stroke="appStore.strokeColor"
          :stroke-width="appStore.strokeWidth * scale"
          :stroke-opacity="appStore.opacity"
          stroke-dasharray="4"
        />
      </template>
      <ellipse
        v-else-if="activeShapeRect && appStore.shapeType === 'circle'"
        :cx="activeShapeRect.x + activeShapeRect.width / 2"
        :cy="activeShapeRect.y + activeShapeRect.height / 2"
        :rx="activeShapeRect.width / 2"
        :ry="activeShapeRect.height / 2"
        :stroke="appStore.strokeColor"
        :stroke-width="appStore.strokeWidth * scale"
        :fill="appStore.fillColor"
        :fill-opacity="appStore.opacity"
        :stroke-opacity="appStore.opacity"
        stroke-dasharray="4"
      />
      <rect
        v-else-if="activeShapeRect"
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
    </svg>

    <!-- 3. Sticky Notes -->
    <div
      v-for="note in pageNotes"
      :key="note.id"
      class="absolute pointer-events-auto flex flex-col overflow-hidden rounded-sm bg-amber-300 text-amber-950 border border-amber-500/70 shadow-md transition-shadow hover:shadow-lg"
      :class="{ 'ring-2 ring-primary': appStore.activeTool === 'select' && selectedNoteId === note.id }"
      :style="{
        left: `${toScreenX(note.rect.x)}px`,
        top: `${toScreenY(note.rect.y + note.rect.height)}px`,
        width: `${Math.max(note.rect.width * scale, 120)}px`,
        height: `${Math.max(note.rect.height * scale, 90)}px`,
        opacity: note.opacity,
        cursor: appStore.activeTool === 'select' ? 'move' : 'default',
      }"
      :title="note.contents || 'Sticky note'"
      @pointerdown.stop="onNotePointerDown($event, note)"
    >
      <div
        data-note-drag-handle
        class="flex items-center gap-1 px-1.5 pt-1 text-[9px] font-semibold uppercase tracking-wide opacity-70 cursor-move"
      >
        <StickyNote class="w-3 h-3" />
        <span>Note</span>
      </div>
      <textarea
        v-if="appStore.activeTool === 'select' && selectedNoteId === note.id"
        :value="note.contents"
        placeholder="Type your note..."
        class="flex-1 w-full resize-none bg-transparent px-1.5 pb-1 text-[11px] leading-tight text-amber-950 outline-none placeholder:text-amber-900/50 select-text"
        @pointerdown.stop
        @focus="onNoteFocus(note)"
        @input="onNoteInput(note, $event)"
        @blur="commitNoteEdit"
      ></textarea>
      <div v-else class="flex-1 px-1.5 pb-1 overflow-hidden text-[11px] leading-tight whitespace-pre-wrap break-words">
        {{ note.contents || 'Click to write a note' }}
      </div>
    </div>

    <!-- 4. Inserted Text Boxes -->
    <div
      v-for="textObj in pageTextObjects"
      :key="textObj.id"
      class="absolute pointer-events-auto group border rounded p-0.5 transition-colors"
      :class="[
        selectedTextId === textObj.id
          ? 'border-primary ring-1 ring-primary/40'
          : 'border-transparent hover:border-primary/50',
      ]"
      :style="{
        left: `${toScreenX(textObj.rect.x)}px`,
        top: `${toScreenY(textObj.rect.y + textObj.rect.height)}px`,
        width: `${textObj.rect.width * scale}px`,
        minHeight: `${textObj.rect.height * scale}px`,
      }"
      @pointerdown.stop="onTextBoxPointerDown($event, textObj)"
    >
      <textarea
        v-model="textObj.text"
        class="w-full h-full bg-transparent resize-none border-0 focus:outline-none overflow-hidden leading-tight select-text placeholder:text-muted-foreground/60 focus:placeholder:text-transparent"
        :placeholder="TEXT_PLACEHOLDER"
        :style="{
          color: textObj.color,
          fontSize: `${textObj.fontSize * scale}px`,
          fontFamily: textObj.fontFamily,
          fontWeight: textObj.isBold ? 'bold' : 'normal',
          fontStyle: textObj.isItalic ? 'italic' : 'normal',
          textAlign: textObj.alignment,
          opacity: textObj.opacity,
        }"
        @pointerdown.stop
        @focus="onTextFocus(textObj)"
        @input="docStore.markDirty(true)"
      ></textarea>

      <!-- Drag handle -->
      <button
        class="absolute top-0.5 right-0.5 z-10 p-0.5 rounded bg-card border border-border text-muted-foreground hover:text-foreground shadow-sm cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
        :class="{ 'opacity-100': selectedTextId === textObj.id }"
        title="Drag to move"
        @pointerdown.stop.prevent="startTextDrag($event, textObj)"
      >
        <GripVertical class="w-3 h-3" />
      </button>
    </div>

    <!-- 5. Inserted Images -->
    <div
      v-for="img in pageImageObjects"
      :key="img.id"
      class="absolute pointer-events-auto group border border-transparent hover:border-primary/50 rounded overflow-hidden shadow-xs"
      :class="{ 'border-primary ring-2 ring-primary/40': appStore.activeTool === 'select' && selectedImageId === img.id }"
      :style="{
        left: `${toScreenX(img.rect.x)}px`,
        top: `${toScreenY(img.rect.y + img.rect.height)}px`,
        width: `${img.rect.width * scale}px`,
        height: `${img.rect.height * scale}px`,
        opacity: img.opacity,
        cursor: appStore.activeTool === 'select' ? 'move' : 'default',
      }"
      @pointerdown.stop="startImageDrag($event, img)"
    >
      <img
        :src="img.imageDataUrl"
        class="w-full h-full object-contain pointer-events-none"
        draggable="false"
      />
      <button
        v-if="appStore.activeTool === 'select' && selectedImageId === img.id"
        class="absolute right-0.5 top-0.5 z-10 rounded bg-destructive p-0.5 text-destructive-foreground shadow-sm hover:bg-destructive/90"
        title="Delete image"
        @pointerdown.stop
        @click.stop="deleteSelectedImage"
      >
        <Trash2 class="h-3 w-3" />
      </button>
    </div>

    <!-- 6. Floating text formatting toolbar -->
    <div
      v-if="selectedText && appStore.activeTool === 'select'"
      class="absolute z-30 flex items-center gap-1 rounded-md border border-border bg-card p-1 shadow-xl pointer-events-auto"
      :style="textToolbarStyle"
      @pointerdown.stop
    >
      <select
        :value="selectedText.fontFamily"
        class="h-6 max-w-[104px] rounded border border-border bg-background px-1 text-[10px] text-foreground focus:outline-none"
        title="Font family"
        @change="setFontFamily"
      >
        <option value="Inter, sans-serif">Inter</option>
        <option value="Arial, sans-serif">Arial</option>
        <option value="'Times New Roman', serif">Times</option>
        <option value="'Courier New', monospace">Courier</option>
        <option value="Georgia, serif">Georgia</option>
      </select>

      <input
        :value="selectedText.fontSize"
        type="number"
        min="6"
        max="144"
        class="h-6 w-12 rounded border border-border bg-background px-1 text-center text-[10px] text-foreground focus:outline-none"
        title="Font size"
        @change="setFontSize"
      />

      <button
        class="h-6 w-6 rounded text-[11px] font-bold transition-colors"
        :class="selectedText.isBold ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'"
        title="Bold"
        @click="toggleBold"
      >
        B
      </button>
      <button
        class="h-6 w-6 rounded text-[11px] italic transition-colors"
        :class="selectedText.isItalic ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'"
        title="Italic"
        @click="toggleItalic"
      >
        I
      </button>

      <input
        :value="selectedText.color"
        type="color"
        class="h-6 w-6 cursor-pointer rounded border border-border bg-transparent p-0"
        title="Text color"
        @focus="beginTextColorEdit"
        @input="setTextColorLive"
        @change="commitTextColor"
      />

      <span class="mx-0.5 h-4 w-px bg-border"></span>

      <button
        class="h-6 w-6 rounded transition-colors"
        :class="selectedText.alignment === 'left' ? 'bg-secondary text-primary' : 'hover:bg-muted text-foreground'"
        title="Align left"
        @click="setTextAlignment('left')"
      >
        <AlignLeft class="mx-auto w-3 h-3" />
      </button>
      <button
        class="h-6 w-6 rounded transition-colors"
        :class="selectedText.alignment === 'center' ? 'bg-secondary text-primary' : 'hover:bg-muted text-foreground'"
        title="Align center"
        @click="setTextAlignment('center')"
      >
        <AlignCenter class="mx-auto w-3 h-3" />
      </button>
      <button
        class="h-6 w-6 rounded transition-colors"
        :class="selectedText.alignment === 'right' ? 'bg-secondary text-primary' : 'hover:bg-muted text-foreground'"
        title="Align right"
        @click="setTextAlignment('right')"
      >
        <AlignRight class="mx-auto w-3 h-3" />
      </button>

      <button
        class="h-6 w-6 rounded text-destructive transition-colors hover:bg-destructive/10"
        title="Delete text box"
        @click="deleteSelectedText"
      >
        <Trash2 class="mx-auto w-3 h-3" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import {
  StickyNote,
  GripVertical,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
} from '@lucide/vue';
import { useAppStore } from '@/stores/appStore';
import { useOperationStore } from '@/stores/operationStore';
import { useHistoryStore } from '@/stores/historyStore';
import { useDocumentStore } from '@/stores/documentStore';
import { CoordinateConverter } from '@/services/coordinateConverter';
import { Point, Rect, PageViewportTransform } from '@/types/geometry';
import {
  AnnotationData,
  AnnotationTransform,
  InkAnnotationData,
  ShapeAnnotationData,
  HighlightAnnotationData,
  InsertedTextObject,
  InsertedImageObject,
  NoteAnnotationData,
} from '@/types/operations';

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
const docStore = useDocumentStore();

const overlayRef = ref<HTMLDivElement | null>(null);

// Interactive state
const isInteracting = ref(false);
const startPoint = ref<Point | null>(null);
const currentDrawingPoints = ref<Point[]>([]);
const activeHighlightRect = ref<Rect | null>(null);
const activeShapeRect = ref<Rect | null>(null);
const activeShapeEndPoint = ref<Point | null>(null);

const selectedTextId = ref<string | null>(null);
const selectedNoteId = ref<string | null>(null);
const selectedImageId = ref<string | null>(null);

const TEXT_PLACEHOLDER = 'Click to edit text';

interface NoteEditState {
  id: string;
  startContents: string;
}

let noteEditState: NoteEditState | null = null;

interface TextColorEditState {
  textId: string;
  startColor: string;
}

let textColorEditState: TextColorEditState | null = null;
let textColorCommitTimer: ReturnType<typeof setTimeout> | null = null;

type DragKind = 'annotation' | 'text' | 'image';

interface DragState {
  kind: DragKind;
  id: string;
  startPdf: Point;
  startRect: Rect;
  startPaths?: Point[][];
  moved: boolean;
}

const dragState = ref<DragState | null>(null);

function onNotePointerDown(e: PointerEvent, note: NoteAnnotationData) {
  selectedNoteId.value = note.id;
  startAnnotationDrag(e, note);
}

function onNoteFocus(note: NoteAnnotationData) {
  selectedNoteId.value = note.id;
  if (!noteEditState || noteEditState.id !== note.id) {
    noteEditState = { id: note.id, startContents: note.contents || '' };
  }
}

function onNoteInput(note: NoteAnnotationData, e: Event) {
  note.contents = (e.target as HTMLTextAreaElement).value;
  docStore.markDirty(true);
}

function commitNoteEdit() {
  if (!noteEditState) return;
  const state = noteEditState;
  noteEditState = null;

  const note = opStore.annotations.find(
    (a): a is NoteAnnotationData => a.id === state.id && a.type === 'note'
  );
  if (!note) return;

  const endContents = note.contents || '';
  if (endContents === state.startContents) return;

  historyStore.pushOperation({
    id: `op-${Date.now()}`,
    type: 'transform_annotation',
    documentId: 'doc',
    documentRevision: opStore.currentRevision + 1,
    payload: {
      annotationId: note.id,
      pageIndex: note.pageIndex,
      updates: { contents: endContents },
    },
    inversePayload: {
      annotationId: note.id,
      pageIndex: note.pageIndex,
      updates: { contents: state.startContents },
    },
    timestamp: Date.now(),
  });
}

// Keep selection from leaking across tool changes.
watch(
  () => appStore.activeTool,
  (tool) => {
    if (tool !== 'select') {
      commitNoteEdit();
      selectedTextId.value = null;
      selectedNoteId.value = null;
      selectedImageId.value = null;
    }
  }
);

// Viewport transform helper
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

// Filter items for this page
const pageAnnotations = computed(() =>
  opStore.annotations.filter(
    (a) => a.pageIndex === props.pageIndex && a.type !== 'note'
  )
);
const pageTextObjects = computed(() =>
  opStore.textObjects.filter((t) => t.pageIndex === props.pageIndex)
);
const pageImageObjects = computed(() =>
  opStore.imageObjects.filter((img) => img.pageIndex === props.pageIndex)
);
const pageNotes = computed(() =>
  opStore.annotations.filter(
    (a): a is NoteAnnotationData => a.type === 'note' && a.pageIndex === props.pageIndex
  )
);

const selectedText = computed(() =>
  opStore.textObjects.find(
    (t) => t.id === selectedTextId.value && t.pageIndex === props.pageIndex
  ) || null
);

const selectedImage = computed(() =>
  opStore.imageObjects.find(
    (img) => img.id === selectedImageId.value && img.pageIndex === props.pageIndex
  ) || null
);

const textToolbarStyle = computed(() => {
  if (!selectedText.value) return {};

  const rect = CoordinateConverter.pdfRectToViewportRect(
    selectedText.value.rect,
    viewport.value
  );
  const toolbarWidth = 330;
  const left = Math.max(4, Math.min(rect.x, viewport.value.width - toolbarWidth - 4));
  const top = rect.y > 46 ? rect.y - 38 : rect.y + rect.height + 8;

  return {
    left: `${left}px`,
    top: `${Math.max(4, top)}px`,
  };
});

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

function cloneRect(rect: Rect): Rect {
  return { ...rect };
}

function clonePaths(paths: Point[][]): Point[][] {
  return paths.map((path) => path.map((point) => ({ ...point })));
}

function onTextBoxPointerDown(e: PointerEvent, textObj: InsertedTextObject) {
  selectedTextId.value = textObj.id;

  // Clicking the box's border/padding should still enter edit mode, which
  // hides the placeholder and places the caret in the textarea.
  const target = e.target as HTMLElement;
  const textarea = (e.currentTarget as HTMLElement).querySelector('textarea');
  if (textarea && target !== textarea) {
    textarea.focus();
  }
}

function onTextFocus(textObj: InsertedTextObject) {
  selectedTextId.value = textObj.id;

  // Older text boxes stored the placeholder as real content.
  if (textObj.text === TEXT_PLACEHOLDER) {
    textObj.text = '';
    docStore.markDirty(true);
  }
}

function findTextObject(textId: string | null): InsertedTextObject | null {
  if (!textId) return null;
  return (
    opStore.textObjects.find(
      (t) => t.id === textId && t.pageIndex === props.pageIndex
    ) || null
  );
}

function beginDrag(
  e: PointerEvent,
  kind: DragKind,
  id: string,
  rect: Rect,
  paths?: Point[][]
) {
  if (appStore.activeTool !== 'select') return;

  if (kind !== 'text') {
    selectedTextId.value = null;
  }

  dragState.value = {
    kind,
    id,
    startPdf: CoordinateConverter.viewportPixelToPdfPoint(
      getLocalPixelCoords(e),
      viewport.value
    ),
    startRect: cloneRect(rect),
    startPaths: paths ? clonePaths(paths) : undefined,
    moved: false,
  };

  try {
    overlayRef.value?.setPointerCapture(e.pointerId);
  } catch {
    // Pointer capture is best-effort (not supported in every webview)
  }
}

function startAnnotationDrag(e: PointerEvent, annot: AnnotationData) {
  beginDrag(
    e,
    'annotation',
    annot.id,
    annot.rect,
    annot.type === 'ink' ? annot.paths : undefined
  );
}

function startTextDrag(e: PointerEvent, textObj: InsertedTextObject) {
  selectedTextId.value = textObj.id;
  beginDrag(e, 'text', textObj.id, textObj.rect);
}

function startImageDrag(e: PointerEvent, image: InsertedImageObject) {
  selectedImageId.value = image.id;
  beginDrag(e, 'image', image.id, image.rect);
}

function updateDraggedPosition(currentPdf: Point) {
  const state = dragState.value;
  if (!state) return;

  const dx = currentPdf.x - state.startPdf.x;
  const dy = currentPdf.y - state.startPdf.y;
  const rect: Rect = {
    ...state.startRect,
    x: state.startRect.x + dx,
    y: state.startRect.y + dy,
  };

  if (state.kind === 'text') {
    const item = opStore.textObjects.find((t) => t.id === state.id);
    if (item) item.rect = rect;
  } else if (state.kind === 'image') {
    const item = opStore.imageObjects.find((i) => i.id === state.id);
    if (item) item.rect = rect;
  } else {
    const item = opStore.annotations.find((a) => a.id === state.id);
    if (item) {
      item.rect = rect;
      if (item.type === 'ink' && state.startPaths) {
        item.paths = state.startPaths.map((path) =>
          path.map((point) => ({ x: point.x + dx, y: point.y + dy }))
        );
      }
    }
  }

  state.moved = Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05;
}

function finishDrag() {
  const state = dragState.value;
  dragState.value = null;
  if (!state || !state.moved) return;

  const base = {
    id: `op-${Date.now()}`,
    documentId: 'doc',
    documentRevision: opStore.currentRevision + 1,
    timestamp: Date.now(),
  };

  if (state.kind === 'text') {
    const item = opStore.textObjects.find((t) => t.id === state.id);
    if (!item) return;

    historyStore.pushOperation({
      ...base,
      type: 'transform_text_box',
      payload: {
        textObjectId: item.id,
        pageIndex: props.pageIndex,
        updates: { rect: { ...item.rect } },
      },
      inversePayload: {
        textObjectId: item.id,
        pageIndex: props.pageIndex,
        updates: { rect: cloneRect(state.startRect) },
      },
    });
    return;
  }

  if (state.kind === 'image') {
    const item = opStore.imageObjects.find((i) => i.id === state.id);
    if (!item) return;

    historyStore.pushOperation({
      ...base,
      type: 'transform_image',
      payload: {
        imageObjectId: item.id,
        pageIndex: props.pageIndex,
        updates: { rect: { ...item.rect } },
      },
      inversePayload: {
        imageObjectId: item.id,
        pageIndex: props.pageIndex,
        updates: { rect: cloneRect(state.startRect) },
      },
    });
    return;
  }

  const item = opStore.annotations.find((a) => a.id === state.id);
  if (!item) return;

  const updates: AnnotationTransform = { rect: { ...item.rect } };
  const inverseUpdates: AnnotationTransform = { rect: cloneRect(state.startRect) };

  if (item.type === 'ink') {
    updates.paths = clonePaths(item.paths);
    if (state.startPaths) {
      inverseUpdates.paths = clonePaths(state.startPaths);
    }
  }

  historyStore.pushOperation({
    ...base,
    type: 'transform_annotation',
    payload: {
      annotationId: item.id,
      pageIndex: props.pageIndex,
      updates,
    },
    inversePayload: {
      annotationId: item.id,
      pageIndex: props.pageIndex,
      updates: inverseUpdates,
    },
  });
}

// Floating text formatting toolbar actions
function updateTextFormat(updates: Partial<InsertedTextObject>) {
  const item = selectedText.value;
  if (!item) return;

  const inverse: Partial<InsertedTextObject> = {};
  for (const key of Object.keys(updates) as Array<keyof InsertedTextObject>) {
    (inverse as Record<string, unknown>)[key] = item[key];
  }

  historyStore.pushOperation({
    id: `op-${Date.now()}`,
    type: 'transform_text_box',
    documentId: 'doc',
    documentRevision: opStore.currentRevision + 1,
    payload: {
      textObjectId: item.id,
      pageIndex: props.pageIndex,
      updates,
    },
    inversePayload: {
      textObjectId: item.id,
      pageIndex: props.pageIndex,
      updates: inverse,
    },
    timestamp: Date.now(),
  });
}

function setFontFamily(e: Event) {
  updateTextFormat({ fontFamily: (e.target as HTMLSelectElement).value });
}

function setFontSize(e: Event) {
  const size = Number((e.target as HTMLInputElement).value);
  if (Number.isFinite(size)) {
    updateTextFormat({ fontSize: Math.max(6, Math.min(144, size)) });
  }
}

function beginTextColorEdit() {
  const item = selectedText.value;
  if (!item) return;

  // Flush any color edit for a different box before starting a new one.
  if (textColorEditState && textColorEditState.textId !== item.id) {
    commitTextColor();
  }

  if (!textColorEditState) {
    textColorEditState = { textId: item.id, startColor: item.color };
  }
}

function setTextColorLive(e: Event) {
  beginTextColorEdit();

  const state = textColorEditState;
  if (!state) return;

  const item = findTextObject(state.textId);
  if (!item) {
    textColorEditState = null;
    return;
  }

  // Update the color immediately so the change is visible while the native
  // color picker is still open. The history entry is committed on change or
  // shortly after the last input event.
  item.color = (e.target as HTMLInputElement).value;
  docStore.markDirty(true);

  if (textColorCommitTimer) clearTimeout(textColorCommitTimer);
  textColorCommitTimer = setTimeout(() => commitTextColor(), 250);
}

function commitTextColor() {
  if (textColorCommitTimer) {
    clearTimeout(textColorCommitTimer);
    textColorCommitTimer = null;
  }

  const state = textColorEditState;
  textColorEditState = null;
  if (!state) return;

  const item = findTextObject(state.textId);
  if (!item || item.color === state.startColor) return;

  historyStore.pushOperation({
    id: `op-${Date.now()}`,
    type: 'transform_text_box',
    documentId: 'doc',
    documentRevision: opStore.currentRevision + 1,
    payload: {
      textObjectId: item.id,
      pageIndex: props.pageIndex,
      updates: { color: item.color },
    },
    inversePayload: {
      textObjectId: item.id,
      pageIndex: props.pageIndex,
      updates: { color: state.startColor },
    },
    timestamp: Date.now(),
  });
}

function toggleBold() {
  if (selectedText.value) {
    updateTextFormat({ isBold: !selectedText.value.isBold });
  }
}

function toggleItalic() {
  if (selectedText.value) {
    updateTextFormat({ isItalic: !selectedText.value.isItalic });
  }
}

function setTextAlignment(alignment: InsertedTextObject['alignment']) {
  updateTextFormat({ alignment });
}

function deleteSelectedImage() {
  const item = selectedImage.value;
  if (!item) return;

  historyStore.pushOperation({
    id: `op-${Date.now()}`,
    type: 'delete_image',
    documentId: 'doc',
    documentRevision: opStore.currentRevision + 1,
    payload: { imageObjectId: item.id, pageIndex: props.pageIndex },
    inversePayload: { imageObject: item },
    timestamp: Date.now(),
  });

  selectedImageId.value = null;
}

function deleteSelectedText() {
  const item = selectedText.value;
  if (!item) return;

  historyStore.pushOperation({
    id: `op-${Date.now()}`,
    type: 'delete_text_box',
    documentId: 'doc',
    documentRevision: opStore.currentRevision + 1,
    payload: { textObjectId: item.id, pageIndex: props.pageIndex },
    inversePayload: { textObject: item },
    timestamp: Date.now(),
  });

  selectedTextId.value = null;
}

function onPointerDown(e: PointerEvent) {
  if (appStore.activeTool === 'select') {
    commitNoteEdit();
    selectedTextId.value = null;
    selectedNoteId.value = null;
    selectedImageId.value = null;
    return;
  }
  if (appStore.activeTool === 'hand') return;

  isInteracting.value = true;
  const pixelPoint = getLocalPixelCoords(e);
  startPoint.value = pixelPoint;
  if (appStore.activeTool === 'shape') {
    activeShapeEndPoint.value = pixelPoint;
  }

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
      text: '',
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

    selectedTextId.value = newTextBox.id;
    isInteracting.value = false;
    appStore.setTool('select');
  } else if (appStore.activeTool === 'note') {
    // Spawn a sticky note at the click point
    const pdfPoint = CoordinateConverter.viewportPixelToPdfPoint(pixelPoint, viewport.value);
    const note: NoteAnnotationData = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      pageIndex: props.pageIndex,
      type: 'note',
      rect: {
        x: pdfPoint.x - 60,
        y: pdfPoint.y - 45,
        width: 120,
        height: 90,
      },
      color: '#f59e0b',
      opacity: 1,
      icon: 'note',
      contents: '',
      createdAt: Date.now(),
    };

    historyStore.pushOperation({
      id: `op-${Date.now()}`,
      type: 'add_annotation',
      documentId: 'doc',
      documentRevision: opStore.currentRevision + 1,
      payload: { annotation: note },
      inversePayload: { annotationId: note.id, pageIndex: props.pageIndex },
      timestamp: Date.now(),
    });

    selectedNoteId.value = note.id;
    isInteracting.value = false;
    appStore.setTool('select');
  }
}

function onPointerMove(e: PointerEvent) {
  if (dragState.value) {
    const currentPdf = CoordinateConverter.viewportPixelToPdfPoint(
      getLocalPixelCoords(e),
      viewport.value
    );
    updateDraggedPosition(currentPdf);
    return;
  }

  if (!isInteracting.value || !startPoint.value) return;

  const current = getLocalPixelCoords(e);

  if (appStore.activeTool === 'highlight') {
    activeHighlightRect.value = {
      x: Math.min(startPoint.value.x, current.x),
      y: Math.min(startPoint.value.y, current.y),
      width: Math.abs(current.x - startPoint.value.x),
      height: Math.abs(current.y - startPoint.value.y),
    };
  } else if (appStore.activeTool === 'draw') {
    currentDrawingPoints.value.push(current);
  } else if (appStore.activeTool === 'shape') {
    activeShapeRect.value = {
      x: Math.min(startPoint.value.x, current.x),
      y: Math.min(startPoint.value.y, current.y),
      width: Math.abs(current.x - startPoint.value.x),
      height: Math.abs(current.y - startPoint.value.y),
    };
    activeShapeEndPoint.value = current;
  }
}

function onPointerUp(_e: PointerEvent) {
  if (dragState.value) {
    finishDrag();
    return;
  }

  if (!isInteracting.value || !startPoint.value) return;

  if (appStore.activeTool === 'highlight' && activeHighlightRect.value && activeHighlightRect.value.width > 3) {
    const pdfRect = CoordinateConverter.viewportRectToPdfRect(activeHighlightRect.value, viewport.value);
    const highlightAnnot: HighlightAnnotationData = {
      id: `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      pageIndex: props.pageIndex,
      type: 'highlight',
      rect: pdfRect,
      color: appStore.strokeColor || '#facc15',
      opacity: appStore.highlightOpacity,
      createdAt: Date.now(),
    };

    historyStore.pushOperation({
      id: `op-${Date.now()}`,
      type: 'add_annotation',
      documentId: 'doc',
      documentRevision: opStore.currentRevision + 1,
      payload: { annotation: highlightAnnot },
      inversePayload: { annotationId: highlightAnnot.id, pageIndex: props.pageIndex },
      timestamp: Date.now(),
    });
  } else if (appStore.activeTool === 'draw' && currentDrawingPoints.value.length > 1) {
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
    const startPdf = CoordinateConverter.viewportPixelToPdfPoint(startPoint.value, viewport.value);
    const endPdf = CoordinateConverter.viewportPixelToPdfPoint(
      activeShapeEndPoint.value || {
        x: activeShapeRect.value.x + activeShapeRect.value.width,
        y: activeShapeRect.value.y + activeShapeRect.value.height,
      },
      viewport.value
    );
    const shapeType = appStore.shapeType;
    const shapeAnnot: ShapeAnnotationData = {
      id: `shape-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      pageIndex: props.pageIndex,
      type: shapeType,
      rect: pdfRect,
      color: appStore.strokeColor,
      fillColor: shapeType === 'line' ? 'none' : appStore.fillColor,
      strokeWidth: appStore.strokeWidth,
      opacity: appStore.opacity,
      createdAt: Date.now(),
      ...(shapeType === 'line' ? { startPoint: startPdf, endPoint: endPdf } : {}),
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
  }

  // Reset interactive flags
  isInteracting.value = false;
  startPoint.value = null;
  currentDrawingPoints.value = [];
  activeHighlightRect.value = null;
  activeShapeRect.value = null;
  activeShapeEndPoint.value = null;
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

function onGlobalKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return;
  if (appStore.activeTool !== 'select') return;

  const active = document.activeElement;
  if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return;

  if (selectedImage.value) {
    e.preventDefault();
    deleteSelectedImage();
  } else if (selectedText.value) {
    e.preventDefault();
    deleteSelectedText();
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeyDown);
});
</script>
