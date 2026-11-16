<template>
  <aside
    v-show="appStore.rightSidebarOpen"
    class="w-64 bg-card border-l border-border flex flex-col select-none shrink-0 overflow-y-auto text-xs z-10 transition-all duration-150"
  >
    <!-- Header -->
    <div class="h-9 border-b border-border flex items-center justify-between px-3 bg-secondary/30">
      <span class="font-semibold text-foreground uppercase tracking-wider text-[11px]">Properties</span>
      <button
        @click="appStore.rightSidebarOpen = false"
        class="p-1 rounded text-muted-foreground hover:text-foreground"
        title="Close Properties"
      >
        <PanelRightClose class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Properties Body -->
    <div class="p-3 space-y-4">
      <!-- 1. Text Properties (when text tool active) -->
      <div v-if="appStore.activeTool === 'text'" class="space-y-3">
        <div class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Typography
        </div>

        <div>
          <label class="block text-[11px] text-muted-foreground mb-1">Font Family</label>
          <select
            v-model="appStore.fontFamily"
            class="w-full bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="Inter, sans-serif">Inter</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="'Times New Roman', serif">Times New Roman</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="Georgia, serif">Georgia</option>
          </select>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] text-muted-foreground mb-1">Font Size</label>
            <input
              v-model.number="appStore.fontSize"
              type="number"
              min="8"
              max="96"
              class="w-full bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label class="block text-[11px] text-muted-foreground mb-1">Color</label>
            <div class="flex items-center space-x-1.5 bg-background border border-border rounded px-2 py-0.5">
              <input
                v-model="appStore.textColor"
                type="color"
                class="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
              />
              <span class="font-mono text-[10px] text-foreground">{{ appStore.textColor }}</span>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-[11px] text-muted-foreground mb-1">Style</label>
          <div class="flex items-center space-x-1">
            <button
              @click="appStore.isBold = !appStore.isBold"
              :class="[
                'flex-1 py-1 rounded border font-bold text-center transition-colors',
                appStore.isBold
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-foreground hover:bg-muted'
              ]"
            >
              B
            </button>
            <button
              @click="appStore.isItalic = !appStore.isItalic"
              :class="[
                'flex-1 py-1 rounded border italic text-center transition-colors',
                appStore.isItalic
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-foreground hover:bg-muted'
              ]"
            >
              I
            </button>
          </div>
        </div>
      </div>

      <!-- 2. Shape / Drawing / Highlight Properties -->
      <div v-else-if="['highlight', 'draw', 'shape'].includes(appStore.activeTool)" class="space-y-3">
        <div class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Stroke & Fill
        </div>

        <div>
          <label class="block text-[11px] text-muted-foreground mb-1">Stroke Color</label>
          <div class="flex items-center space-x-2 bg-background border border-border rounded px-2 py-1">
            <input
              v-model="appStore.strokeColor"
              type="color"
              class="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
            />
            <span class="font-mono text-xs text-foreground">{{ appStore.strokeColor }}</span>
          </div>
        </div>

        <div v-if="appStore.activeTool === 'shape'">
          <label class="block text-[11px] text-muted-foreground mb-1">Shape Type</label>
          <select
            v-model="appStore.shapeType"
            title="Shape type"
            class="w-full bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="square">Rectangle</option>
            <option value="circle">Circle</option>
            <option value="line">Line</option>
          </select>
        </div>

        <div v-if="appStore.activeTool === 'shape'">
          <label class="block text-[11px] text-muted-foreground mb-1">Fill Color</label>
          <div class="flex items-center space-x-2 bg-background border border-border rounded px-2 py-1">
            <input
              v-model="appStore.fillColor"
              type="color"
              class="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
            />
            <span class="font-mono text-xs text-foreground">{{ appStore.fillColor }}</span>
          </div>
        </div>

        <div>
          <div class="flex justify-between text-[11px] text-muted-foreground mb-1">
            <span>Stroke Width</span>
            <span>{{ appStore.strokeWidth }}px</span>
          </div>
          <input
            v-model.number="appStore.strokeWidth"
            type="range"
            min="1"
            max="12"
            class="w-full accent-primary"
          />
        </div>

        <div>
          <div class="flex justify-between text-[11px] text-muted-foreground mb-1">
            <span>Opacity</span>
            <span>{{ Math.round(activeOpacity * 100) }}%</span>
          </div>
          <input
            v-model.number="activeOpacity"
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            class="w-full accent-primary"
          />
        </div>
      </div>

      <!-- 3. Document Metadata Section -->
      <div class="pt-3 border-t border-border space-y-2">
        <div class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Document Info
        </div>

        <div v-if="docStore.currentDoc" class="space-y-1.5 text-[11px]">
          <div class="flex justify-between text-muted-foreground">
            <span>Pages:</span>
            <span class="font-medium text-foreground">{{ docStore.currentDoc.metadata.pageCount }}</span>
          </div>
          <div class="flex justify-between text-muted-foreground">
            <span>PDF Version:</span>
            <span class="font-medium text-foreground">{{ docStore.currentDoc.metadata.pdfVersion }}</span>
          </div>
          <div v-if="docStore.currentDoc.metadata.title" class="flex justify-between text-muted-foreground">
            <span>Title:</span>
            <span class="font-medium text-foreground truncate max-w-[120px]">{{ docStore.currentDoc.metadata.title }}</span>
          </div>
          <div v-if="docStore.currentDoc.metadata.author" class="flex justify-between text-muted-foreground">
            <span>Author:</span>
            <span class="font-medium text-foreground truncate max-w-[120px]">{{ docStore.currentDoc.metadata.author }}</span>
          </div>
        </div>
        <div v-else class="text-xs text-muted-foreground italic">
          No document loaded
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { PanelRightClose } from '@lucide/vue';
import { useAppStore } from '@/stores/appStore';
import { useDocumentStore } from '@/stores/documentStore';

const appStore = useAppStore();
const docStore = useDocumentStore();

// Highlights have their own opacity so changing them doesn't affect ink/shapes.
const activeOpacity = computed({
  get: () =>
    appStore.activeTool === 'highlight'
      ? appStore.highlightOpacity
      : appStore.opacity,
  set: (value: number) => {
    if (appStore.activeTool === 'highlight') {
      appStore.highlightOpacity = value;
    } else {
      appStore.opacity = value;
    }
  },
});
</script>

