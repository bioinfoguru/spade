<template>
  <div
    ref="overlayRef"
    class="absolute inset-0 z-[4] overflow-hidden select-none"
    :class="{
      'cursor-crosshair': ['draw', 'shape', 'text', 'note'].includes(appStore.activeTool),
      'cursor-text': appStore.activeTool === 'highlight',
      'cursor-default': appStore.activeTool === 'select',
      'cursor-grab': appStore.activeTool === 'hand',
      'pointer-events-none': appStore.activeTool === 'highlight'
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

        <!-- Selection outline for removable annotations -->
        <rect
          v-if="annot.type !== 'note' && selectedAnnotationId === annot.id && appStore.activeTool === 'select'"
          :x="toScreenX(annot.rect.x)"
          :y="toScreenY(annot.rect.y + annot.rect.height)"
          :width="Math.max(annot.rect.width * scale, 2)"
          :height="Math.max(annot.rect.height * scale, 2)"
          rx="2"
          fill="none"
          class="text-primary"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-dasharray="4 3"
          pointer-events="none"
        />
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
      class="absolute flex flex-col overflow-hidden rounded-sm bg-amber-300 text-amber-950 border border-amber-500/70 shadow-md transition-shadow hover:shadow-lg"
      :class="{
        'ring-2 ring-primary': appStore.activeTool === 'select' && selectedNoteId === note.id,
        'pointer-events-none': appStore.activeTool !== 'select',
      }"
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
      class="absolute group border rounded p-0.5 transition-colors"
      :class="[
        selectedTextId === textObj.id
          ? 'border-primary ring-1 ring-primary/40'
          : 'border-transparent hover:border-primary/50',
        appStore.activeTool === 'select' ? 'pointer-events-auto' : 'pointer-events-none',
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
      class="absolute group"
      :class="{
        'z-10': isImageSelected(img),
        'pointer-events-none': appStore.activeTool !== 'select',
      }"
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
      <div
        class="h-full w-full overflow-hidden rounded border border-transparent shadow-xs group-hover:border-primary/50"
        :class="{ 'border-primary ring-2 ring-primary/40': isImageSelected(img) }"
      >
        <img
          :src="img.imageDataUrl"
          class="pointer-events-none h-full w-full object-fill"
          draggable="false"
        />
      </div>

      <template v-if="isImageSelected(img) && !isCroppingImage(img)">
        <!-- Crop image -->
        <button
          class="absolute right-6 top-0.5 z-20 rounded bg-card p-0.5 text-foreground shadow-sm ring-1 ring-border hover:bg-muted"
          title="Crop image"
          @pointerdown.stop
          @click.stop="startImageCrop(img)"
        >
          <Crop class="h-3 w-3" />
        </button>

        <!-- Delete image -->
        <button
          class="absolute right-0.5 top-0.5 z-20 rounded bg-destructive p-0.5 text-destructive-foreground shadow-sm hover:bg-destructive/90"
          title="Delete image"
          @pointerdown.stop
          @click.stop="deleteSelectedImage"
        >
          <Trash2 class="h-3 w-3" />
        </button>

        <!-- Resize handles -->
        <div
          v-for="handle in resizeHandles"
          :key="`resize-${handle.name}`"
          class="absolute z-20 h-2.5 w-2.5 rounded-sm border border-primary bg-white shadow-sm"
          :class="[handle.positionClass, handle.cursorClass]"
          :title="'Drag to resize'"
          @pointerdown.stop.prevent="startImageResize($event, img, handle.name)"
        ></div>
      </template>

      <!-- Crop session UI -->
      <div
        v-if="isCroppingImage(img) && cropSession"
        class="absolute inset-0 z-30 overflow-hidden"
        @pointerdown.stop
      >
        <div
          class="absolute cursor-move border-2 border-primary"
          :style="cropRectStyle"
          @pointerdown.stop.prevent="startCropDrag($event, 'move')"
        >
          <!-- Rule-of-thirds guides -->
          <div class="pointer-events-none absolute inset-0 opacity-60">
            <div class="absolute bottom-0 left-1/3 top-0 w-px bg-primary/40"></div>
            <div class="absolute bottom-0 left-2/3 top-0 w-px bg-primary/40"></div>
            <div class="absolute left-0 right-0 top-1/3 h-px bg-primary/40"></div>
            <div class="absolute left-0 right-0 top-2/3 h-px bg-primary/40"></div>
          </div>

          <div
            v-for="handle in resizeHandles"
            :key="`crop-${handle.name}`"
            class="absolute h-2.5 w-2.5 rounded-sm border border-primary bg-white shadow-sm"
            :class="[handle.positionClass, handle.cursorClass]"
            @pointerdown.stop.prevent="startCropDrag($event, handle.name)"
          ></div>

          <!-- Apply / cancel -->
          <div
            class="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-md border border-border bg-card/95 px-1 py-0.5 shadow-lg backdrop-blur-sm"
            @pointerdown.stop
          >
            <button
              class="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Cancel crop"
              @click.stop="cancelImageCrop"
            >
              <X class="h-3 w-3" />
            </button>
            <button
              class="flex items-center gap-0.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90"
              title="Apply crop"
              @click.stop="applyImageCrop"
            >
              <Check class="h-3 w-3" />
              Apply
            </button>
          </div>
        </div>
      </div>
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

    <!-- 7. Floating annotation actions -->
    <div
      v-if="selectedAnnotation && appStore.activeTool === 'select'"
      class="absolute z-30 flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-1 shadow-xl pointer-events-auto"
      :style="annotationToolbarStyle"
      @pointerdown.stop
    >
      <span class="text-[10px] font-medium text-muted-foreground">{{ selectedAnnotationLabel }}</span>
      <button
        class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
        title="Remove annotation (Delete)"
        @click="deleteSelectedAnnotation"
      >
        <Trash2 class="h-3 w-3" />
        Remove
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
  Crop,
  Check,
  X,
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
const activeShapeRect = ref<Rect | null>(null);
const activeShapeEndPoint = ref<Point | null>(null);

const selectedTextId = ref<string | null>(null);
const selectedNoteId = ref<string | null>(null);
const selectedImageId = ref<string | null>(null);
const selectedAnnotationId = ref<string | null>(null);

watch(selectedImageId, (id) => {
  appStore.selectedImageId = id;
});

watch(
  () => appStore.selectedImageId,
  (id) => {
    if (id !== selectedImageId.value) selectedImageId.value = id;
  }
);

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

/* ---- Image resizing & cropping ---- */

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

interface HandleDefinition {
  name: ResizeHandle;
  positionClass: string;
  cursorClass: string;
}

const resizeHandles: HandleDefinition[] = [
  { name: 'nw', positionClass: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2', cursorClass: 'cursor-nwse-resize' },
  { name: 'n', positionClass: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2', cursorClass: 'cursor-ns-resize' },
  { name: 'ne', positionClass: 'right-0 top-0 translate-x-1/2 -translate-y-1/2', cursorClass: 'cursor-nesw-resize' },
  { name: 'e', positionClass: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2', cursorClass: 'cursor-ew-resize' },
  { name: 'se', positionClass: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2', cursorClass: 'cursor-nwse-resize' },
  { name: 's', positionClass: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2', cursorClass: 'cursor-ns-resize' },
  { name: 'sw', positionClass: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2', cursorClass: 'cursor-nesw-resize' },
  { name: 'w', positionClass: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2', cursorClass: 'cursor-ew-resize' },
];

interface ImageResizeState {
  id: string;
  handle: ResizeHandle;
  startPdf: Point;
  startRect: Rect;
  moved: boolean;
}

const imageResizeState = ref<ImageResizeState | null>(null);

interface CropSession {
  imageId: string;
  boxWidth: number;
  boxHeight: number;
  draft: Rect;
}

const cropSession = ref<CropSession | null>(null);

interface CropDragState {
  mode: 'move' | ResizeHandle;
  startClientX: number;
  startClientY: number;
  startRect: Rect;
  pointerId: number;
}

let cropDragState: CropDragState | null = null;

const MIN_IMAGE_PX = 16;

function imageById(id: string | null): InsertedImageObject | null {
  if (!id) return null;
  return opStore.imageObjects.find((img) => img.id === id) || null;
}

function isImageSelected(img: InsertedImageObject): boolean {
  return appStore.activeTool === 'select' && selectedImageId.value === img.id;
}

function isCroppingImage(img: InsertedImageObject): boolean {
  return cropSession.value?.imageId === img.id;
}

const cropRectStyle = computed(() => {
  const session = cropSession.value;
  if (!session) return {};
  return {
    left: `${session.draft.x}px`,
    top: `${session.draft.y}px`,
    width: `${session.draft.width}px`,
    height: `${session.draft.height}px`,
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
  };
});

function startImageResize(e: PointerEvent, image: InsertedImageObject, handle: ResizeHandle) {
  if (appStore.activeTool !== 'select') return;
  selectedImageId.value = image.id;
  selectedTextId.value = null;
  selectedNoteId.value = null;
  selectedAnnotationId.value = null;

  imageResizeState.value = {
    id: image.id,
    handle,
    startPdf: CoordinateConverter.viewportPixelToPdfPoint(
      getLocalPixelCoords(e),
      viewport.value
    ),
    startRect: cloneRect(image.rect),
    moved: false,
  };

  try {
    overlayRef.value?.setPointerCapture(e.pointerId);
  } catch {
    // Pointer capture is best-effort (not supported in every webview)
  }
}

function updateImageResize(currentPdf: Point) {
  const state = imageResizeState.value;
  if (!state) return;

  const item = imageById(state.id);
  if (!item) return;

  const dx = currentPdf.x - state.startPdf.x;
  const dy = currentPdf.y - state.startPdf.y;
  const start = state.startRect;
  const minSize = MIN_IMAGE_PX / Math.max(props.scale, 0.01);
  const handle = state.handle;

  const hasHorizontal = handle.includes('e') || handle.includes('w');
  const hasVertical = handle.includes('n') || handle.includes('s');
  const isCorner = hasHorizontal && hasVertical;
  const useAspectLock = appStore.lockImageAspect && isCorner;

  let x = start.x;
  let y = start.y;
  let width = start.width;
  let height = start.height;

  if (useAspectLock) {
    const ratio = Math.max(start.height, 0.01) / Math.max(start.width, 0.01);
    const horizontalDelta = handle.includes('e') ? dx : -dx;
    const verticalDelta = handle.includes('s') ? dy : -dy;

    // Follow the axis the pointer moved furthest along; the other dimension
    // is derived so the image never changes shape while the lock is on.
    if (Math.abs(horizontalDelta) >= Math.abs(verticalDelta)) {
      width = Math.max(minSize, start.width + horizontalDelta);
      height = width * ratio;
    } else {
      height = Math.max(minSize, start.height + verticalDelta);
      width = height / ratio;
    }

    const minWidth = Math.max(minSize, minSize / ratio);
    const maxWidth = Math.min(props.rawWidth, props.rawHeight / ratio);
    width = Math.max(minWidth, Math.min(width, maxWidth));
    height = width * ratio;

    x = handle.includes('w') ? start.x + start.width - width : start.x;
    y = handle.includes('n') ? start.y + start.height - height : start.y;
  } else {
    if (handle.includes('w')) {
      x = start.x + dx;
      width = start.width - dx;
    }
    if (handle.includes('e')) {
      width = start.width + dx;
    }
    if (handle.includes('n')) {
      height = start.height + dy;
    }
    if (handle.includes('s')) {
      y = start.y + dy;
      height = start.height - dy;
    }

    // Keep a minimum on-screen size without letting the box flip over.
    if (width < minSize) {
      width = minSize;
      if (handle.includes('w')) x = start.x + start.width - minSize;
    }
    if (height < minSize) {
      height = minSize;
      if (handle.includes('s')) y = start.y + start.height - minSize;
    }

    width = Math.min(width, props.rawWidth);
    height = Math.min(height, props.rawHeight);
  }

  x = Math.max(0, Math.min(x, props.rawWidth - width));
  y = Math.max(0, Math.min(y, props.rawHeight - height));

  item.rect = { x, y, width, height };
  state.moved = Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05;
}

function finishImageResize() {
  const state = imageResizeState.value;
  imageResizeState.value = null;
  if (!state || !state.moved) return;

  const item = imageById(state.id);
  if (!item) return;

  historyStore.pushOperation({
    id: `op-${Date.now()}`,
    type: 'transform_image',
    documentId: 'doc',
    documentRevision: opStore.currentRevision + 1,
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
    timestamp: Date.now(),
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load image'));
    image.src = src;
  });
}

function startImageCrop(image: InsertedImageObject) {
  selectedImageId.value = image.id;
  const boxWidth = Math.max(1, image.rect.width * props.scale);
  const boxHeight = Math.max(1, image.rect.height * props.scale);

  cropSession.value = {
    imageId: image.id,
    boxWidth,
    boxHeight,
    draft: { x: 0, y: 0, width: boxWidth, height: boxHeight },
  };
}

function startCropDrag(e: PointerEvent, mode: 'move' | ResizeHandle) {
  const session = cropSession.value;
  if (!session) return;

  cropDragState = {
    mode,
    startClientX: e.clientX,
    startClientY: e.clientY,
    startRect: { ...session.draft },
    pointerId: e.pointerId,
  };

  try {
    overlayRef.value?.setPointerCapture(e.pointerId);
  } catch {
    // Pointer capture is best-effort (not supported in every webview)
  }
}

function updateCropDrag(e: PointerEvent) {
  const session = cropSession.value;
  const drag = cropDragState;
  if (!session || !drag) return;

  const dx = e.clientX - drag.startClientX;
  const dy = e.clientY - drag.startClientY;
  const start = drag.startRect;
  const min = 12;

  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;

  if (drag.mode === 'move') {
    left = Math.max(0, Math.min(start.x + dx, session.boxWidth - start.width));
    top = Math.max(0, Math.min(start.y + dy, session.boxHeight - start.height));
    right = left + start.width;
    bottom = top + start.height;
  } else {
    if (drag.mode.includes('w')) left = Math.max(0, Math.min(start.x + dx, right - min));
    if (drag.mode.includes('e')) right = Math.min(session.boxWidth, Math.max(right + dx, left + min));
    if (drag.mode.includes('n')) top = Math.max(0, Math.min(start.y + dy, bottom - min));
    if (drag.mode.includes('s')) bottom = Math.min(session.boxHeight, Math.max(bottom + dy, top + min));
  }

  session.draft = {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function endCropDrag(e: PointerEvent) {
  if (!cropDragState) return;
  if (e.pointerId === cropDragState.pointerId) {
    try {
      overlayRef.value?.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if capture was never acquired
    }
  }
  cropDragState = null;
}

function cancelImageCrop() {
  cropSession.value = null;
  cropDragState = null;
}

async function applyImageCrop() {
  const session = cropSession.value;
  if (!session) return;

  const item = imageById(session.imageId);
  if (!item) {
    cropSession.value = null;
    return;
  }

  const fx0 = Math.max(0, Math.min(1, session.draft.x / session.boxWidth));
  const fy0 = Math.max(0, Math.min(1, session.draft.y / session.boxHeight));
  const fx1 = Math.max(0, Math.min(1, (session.draft.x + session.draft.width) / session.boxWidth));
  const fy1 = Math.max(0, Math.min(1, (session.draft.y + session.draft.height) / session.boxHeight));

  if (fx1 - fx0 < 0.01 || fy1 - fy0 < 0.01) {
    cancelImageCrop();
    return;
  }

  const startRect = cloneRect(item.rect);
  const startDataUrl = item.imageDataUrl;

  try {
    const imageEl = await loadImageElement(startDataUrl);
    const naturalWidth = imageEl.naturalWidth || 1;
    const naturalHeight = imageEl.naturalHeight || 1;

    const sx = Math.round(fx0 * naturalWidth);
    const sy = Math.round(fy0 * naturalHeight);
    const sw = Math.max(1, Math.round((fx1 - fx0) * naturalWidth));
    const sh = Math.max(1, Math.round((fy1 - fy0) * naturalHeight));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create crop canvas');

    ctx.drawImage(imageEl, sx, sy, sw, sh, 0, 0, sw, sh);
    const croppedDataUrl = canvas.toDataURL('image/png');

    const newRect: Rect = {
      x: startRect.x + fx0 * startRect.width,
      // Draft coordinates are measured from the top, PDF rects from the bottom.
      y: startRect.y + (1 - fy1) * startRect.height,
      width: Math.max(1, startRect.width * (fx1 - fx0)),
      height: Math.max(1, startRect.height * (fy1 - fy0)),
    };

    cropSession.value = null;

    historyStore.pushOperation({
      id: `op-${Date.now()}`,
      type: 'transform_image',
      documentId: 'doc',
      documentRevision: opStore.currentRevision + 1,
      payload: {
        imageObjectId: item.id,
        pageIndex: props.pageIndex,
        updates: { rect: newRect, imageDataUrl: croppedDataUrl },
      },
      inversePayload: {
        imageObjectId: item.id,
        pageIndex: props.pageIndex,
        updates: { rect: startRect, imageDataUrl: startDataUrl },
      },
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error('Failed to crop image:', err);
    cancelImageCrop();
  }
}

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
      selectedAnnotationId.value = null;
      imageResizeState.value = null;
      cancelImageCrop();
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

const selectedAnnotation = computed(() =>
  opStore.annotations.find(
    (a) => a.id === selectedAnnotationId.value && a.pageIndex === props.pageIndex
  ) || null
);

const selectedAnnotationLabel = computed(() => {
  switch (selectedAnnotation.value?.type) {
    case 'highlight':
      return 'Highlight';
    case 'ink':
      return 'Drawing';
    case 'square':
    case 'circle':
    case 'line':
      return 'Shape';
    case 'note':
      return 'Note';
    default:
      return 'Annotation';
  }
});

const annotationToolbarStyle = computed(() => {
  if (!selectedAnnotation.value) return {};

  const rect = CoordinateConverter.pdfRectToViewportRect(
    selectedAnnotation.value.rect,
    viewport.value
  );
  const toolbarWidth = 150;
  const left = Math.max(4, Math.min(rect.x + rect.width - toolbarWidth, viewport.value.width - toolbarWidth - 4));
  const top = rect.y > 40 ? rect.y - 34 : rect.y + rect.height + 8;

  return {
    left: `${left}px`,
    top: `${Math.max(4, top)}px`,
  };
});

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
  selectedNoteId.value = null;
  selectedImageId.value = null;
  selectedAnnotationId.value = null;

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
  selectedAnnotationId.value = annot.id;
  selectedImageId.value = null;
  selectedNoteId.value = annot.type === 'note' ? annot.id : null;
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
  selectedNoteId.value = null;
  selectedImageId.value = null;
  selectedAnnotationId.value = null;
  beginDrag(e, 'text', textObj.id, textObj.rect);
}

function startImageDrag(e: PointerEvent, image: InsertedImageObject) {
  selectedImageId.value = image.id;
  selectedTextId.value = null;
  selectedNoteId.value = null;
  selectedAnnotationId.value = null;
  if (cropSession.value && cropSession.value.imageId !== image.id) {
    cancelImageCrop();
  }
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

function deleteSelectedAnnotation() {
  const item = selectedAnnotation.value;
  if (!item) return;

  historyStore.pushOperation({
    id: `op-${Date.now()}`,
    type: 'delete_annotation',
    documentId: 'doc',
    documentRevision: opStore.currentRevision + 1,
    payload: { annotationId: item.id, pageIndex: props.pageIndex },
    inversePayload: { annotation: item },
    timestamp: Date.now(),
  });

  selectedAnnotationId.value = null;
  selectedNoteId.value = null;
}

function onPointerDown(e: PointerEvent) {
  if (appStore.activeTool === 'select') {
    commitNoteEdit();
    selectedTextId.value = null;
    selectedNoteId.value = null;
    selectedImageId.value = null;
    selectedAnnotationId.value = null;
    cancelImageCrop();
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
  if (cropDragState) {
    updateCropDrag(e);
    return;
  }

  if (imageResizeState.value) {
    updateImageResize(
      CoordinateConverter.viewportPixelToPdfPoint(getLocalPixelCoords(e), viewport.value)
    );
    return;
  }

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

  if (appStore.activeTool === 'draw') {
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

function onPointerUp(e: PointerEvent) {
  if (cropDragState) {
    endCropDrag(e);
    return;
  }

  if (imageResizeState.value) {
    finishImageResize();
    return;
  }

  if (dragState.value) {
    finishDrag();
    return;
  }

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
  } else if (selectedAnnotation.value) {
    e.preventDefault();
    deleteSelectedAnnotation();
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeyDown);
});
</script>
