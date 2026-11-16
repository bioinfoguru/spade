<template>
  <div class="h-10 bg-card border-b border-border flex items-center justify-between px-3 text-xs select-none z-20 shrink-0">
    <!-- Left Section: Tool Selection -->
    <div class="flex items-center space-x-1 overflow-x-auto">
      <!-- Select / Hand Group -->
      <div class="flex items-center space-x-0.5 bg-secondary/50 p-0.5 rounded-md border border-border/50">
        <button
          @click="appStore.setTool('select')"
          :class="[
            'p-1.5 rounded transition-colors',
            appStore.activeTool === 'select'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground hover:bg-muted'
          ]"
          title="Select Tool (V)"
        >
          <MousePointer class="w-3.5 h-3.5" />
        </button>
        <button
          @click="appStore.setTool('hand')"
          :class="[
            'p-1.5 rounded transition-colors',
            appStore.activeTool === 'hand'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground hover:bg-muted'
          ]"
          title="Pan / Hand Tool (H)"
        >
          <Hand class="w-3.5 h-3.5" />
        </button>
      </div>

      <div class="h-4 w-px bg-border/60 mx-1"></div>

      <!-- Annotation Group -->
      <div class="flex items-center space-x-0.5">
        <button
          @click="appStore.setTool('highlight')"
          :class="[
            'flex items-center space-x-1 px-2 py-1 rounded transition-colors',
            appStore.activeTool === 'highlight'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground hover:bg-muted'
          ]"
          title="Highlight Text"
        >
          <Highlighter class="w-3.5 h-3.5 text-amber-500" />
          <span class="hidden lg:inline">Highlight</span>
        </button>

        <button
          @click="appStore.setTool('draw')"
          :class="[
            'flex items-center space-x-1 px-2 py-1 rounded transition-colors',
            appStore.activeTool === 'draw'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground hover:bg-muted'
          ]"
          title="Freehand Draw"
        >
          <PenLine class="w-3.5 h-3.5" />
          <span class="hidden lg:inline">Draw</span>
        </button>

        <button
          @click="appStore.setTool('shape')"
          :class="[
            'flex items-center space-x-1 px-2 py-1 rounded transition-colors',
            appStore.activeTool === 'shape'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground hover:bg-muted'
          ]"
          title="Shapes (Rectangle, Circle, Line)"
        >
          <Square class="w-3.5 h-3.5" />
          <span class="hidden lg:inline">Shape</span>
        </button>

        <button
          @click="appStore.setTool('note')"
          :class="[
            'flex items-center space-x-1 px-2 py-1 rounded transition-colors',
            appStore.activeTool === 'note'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground hover:bg-muted'
          ]"
          title="Sticky Note"
        >
          <StickyNote class="w-3.5 h-3.5 text-amber-400" />
          <span class="hidden lg:inline">Note</span>
        </button>
      </div>

      <div class="h-4 w-px bg-border/60 mx-1"></div>

      <!-- Content Insertion Group -->
      <div class="flex items-center space-x-0.5">
        <button
          @click="appStore.setTool('text')"
          :class="[
            'flex items-center space-x-1 px-2 py-1 rounded transition-colors',
            appStore.activeTool === 'text'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground hover:bg-muted'
          ]"
          title="Add Text Box (T)"
        >
          <Type class="w-3.5 h-3.5" />
          <span>Text</span>
        </button>

        <button
          @click="$emit('add-image')"
          class="flex items-center space-x-1 px-2 py-1 rounded text-foreground hover:bg-muted transition-colors"
          title="Insert Image"
        >
          <ImageIcon class="w-3.5 h-3.5" />
          <span>Image</span>
        </button>

        <button
          @click="appStore.setTool('signature')"
          :class="[
            'flex items-center space-x-1 px-2 py-1 rounded transition-colors',
            appStore.activeTool === 'signature'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground hover:bg-muted'
          ]"
          title="Sign Document"
        >
          <FileSignature class="w-3.5 h-3.5 text-emerald-500" />
          <span>Sign</span>
        </button>
      </div>

      <div class="h-4 w-px bg-border/60 mx-1"></div>

      <!-- True Redaction Tool -->
      <button
        @click="appStore.setTool('redact')"
        :class="[
          'flex items-center space-x-1 px-2 py-1 rounded transition-colors',
          appStore.activeTool === 'redact'
            ? 'bg-destructive text-destructive-foreground shadow-sm'
            : 'text-destructive hover:bg-destructive/10'
        ]"
        title="Mark for True Redaction"
      >
        <ShieldAlert class="w-3.5 h-3.5" />
        <span>Redact</span>
      </button>
    </div>

    <!-- Right Section: Page Manipulation & Zoom Controls -->
    <div class="flex items-center space-x-1">
      <!-- Rotate Controls -->
      <button
        @click="viewerStore.rotateCounterClockwise()"
        class="p-1.5 rounded text-foreground hover:bg-muted transition-colors"
        title="Rotate Counter-Clockwise"
      >
        <RotateCcw class="w-3.5 h-3.5" />
      </button>
      <button
        @click="viewerStore.rotateClockwise()"
        class="p-1.5 rounded text-foreground hover:bg-muted transition-colors"
        title="Rotate Clockwise"
      >
        <RotateCw class="w-3.5 h-3.5" />
      </button>

      <div class="h-4 w-px bg-border/60 mx-1"></div>

      <!-- Zoom Controls -->
      <button
        @click="viewerStore.zoomOut()"
        class="p-1.5 rounded text-foreground hover:bg-muted transition-colors"
        title="Zoom Out (Ctrl+-)"
      >
        <ZoomOut class="w-3.5 h-3.5" />
      </button>
      <span class="w-12 text-center font-mono font-medium text-foreground">
        {{ viewerStore.zoomPercent }}%
      </span>
      <button
        @click="viewerStore.zoomIn()"
        class="p-1.5 rounded text-foreground hover:bg-muted transition-colors"
        title="Zoom In (Ctrl++)"
      >
        <ZoomIn class="w-3.5 h-3.5" />
      </button>

      <button
        @click="toggleRightPanel"
        :class="[
          'p-1.5 rounded transition-colors ml-1',
          appStore.rightSidebarOpen ? 'bg-secondary text-primary' : 'text-foreground hover:bg-muted'
        ]"
        title="Toggle Properties Panel"
      >
        <SlidersHorizontal class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  MousePointer,
  Hand,
  Highlighter,
  PenLine,
  Square,
  StickyNote,
  Type,
  Image as ImageIcon,
  FileSignature,
  ShieldAlert,
  RotateCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
} from 'lucide-vue-next';
import { useAppStore } from '@/stores/appStore';
import { useViewerStore } from '@/stores/viewerStore';

const appStore = useAppStore();
const viewerStore = useViewerStore();

defineEmits<{
  (e: 'add-image'): void;
}>();

function toggleRightPanel() {
  appStore.rightSidebarOpen = !appStore.rightSidebarOpen;
}
</script>
