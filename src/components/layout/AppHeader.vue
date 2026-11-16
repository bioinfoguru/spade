<template>
  <header class="h-11 bg-card border-b border-border flex items-center justify-between px-3 select-none z-30 shrink-0">
    <!-- Left Section: Logo & App Title & Document Tabs -->
    <div class="flex items-center space-x-3 overflow-hidden">
      <div class="flex items-center space-x-2 text-primary font-bold text-sm tracking-wide">
        <img src="/logo.svg" class="w-6 h-6 rounded object-contain" alt="SPADE Logo" />
        <span class="hidden md:inline font-semibold text-foreground">SPADE</span>
      </div>

      <!-- Vertical divider -->
      <div class="h-4 w-px bg-border/60"></div>

      <!-- Document Tabs -->
      <div class="flex items-center space-x-1 overflow-x-auto max-w-md scrollbar-none">
        <div
          v-if="docStore.currentDoc"
          class="flex items-center space-x-2 px-2.5 py-1 rounded bg-secondary/80 border border-border text-xs text-foreground font-medium group transition-colors"
        >
          <FileText class="w-3.5 h-3.5 text-primary" />
          <span class="truncate max-w-[140px]">{{ docStore.currentDoc.fileName }}</span>
          <span v-if="docStore.currentDoc.isDirty" class="w-1.5 h-1.5 rounded-full bg-amber-500" title="Unsaved changes"></span>
          <button
            @click.stop="docStore.closeDocument(docStore.currentDoc.id)"
            class="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
            title="Close"
          >
            <X class="w-3 h-3" />
          </button>
        </div>
        <div v-else class="text-xs text-muted-foreground italic">
          No document open
        </div>
      </div>
    </div>

    <!-- Center Section: Signature / Certification Badge & Undo/Redo -->
    <div class="flex items-center space-x-2">
      <!-- Digital Signature Badge -->
      <div
        v-if="capStore.capabilities.hasExistingSignatures"
        class="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium"
        title="Document contains certified digital signatures"
      >
        <ShieldCheck class="w-3.5 h-3.5" />
        <span>Certified Signed</span>
      </div>

      <!-- Undo / Redo controls -->
      <div class="flex items-center space-x-0.5 bg-secondary/50 p-0.5 rounded-md border border-border/50">
        <button
          @click="historyStore.undo()"
          :disabled="!historyStore.canUndo"
          class="p-1 rounded text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 class="w-3.5 h-3.5" />
        </button>
        <button
          @click="historyStore.redo()"
          :disabled="!historyStore.canRedo"
          class="p-1 rounded text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Right Section: Actions & Theme Toggle -->
    <div class="flex items-center space-x-2">
      <button
        @click="$emit('open-file')"
        class="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-secondary hover:bg-muted border border-border text-xs font-medium text-foreground transition-colors"
      >
        <FolderOpen class="w-3.5 h-3.5" />
        <span>Open</span>
      </button>

      <button
        @click="$emit('merge-files')"
        class="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-secondary hover:bg-muted border border-border text-xs font-medium text-foreground transition-colors"
      >
        <Combine class="w-3.5 h-3.5" />
        <span>Merge</span>
      </button>

      <button
        @click="$emit('save-file')"
        :disabled="!docStore.currentDoc"
        class="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 text-xs font-medium transition-colors shadow-sm"
      >
        <Save class="w-3.5 h-3.5" />
        <span>Save</span>
      </button>

      <button
        @click="$emit('show-help')"
        class="flex items-center space-x-1.5 px-2 py-1 rounded text-xs font-medium text-foreground hover:bg-muted transition-colors"
        title="Help and keyboard shortcuts"
      >
        <CircleHelp class="w-3.5 h-3.5" />
        <span>Help</span>
      </button>

      <!-- Theme Switcher -->
      <button
        @click="appStore.toggleTheme"
        class="p-1.5 rounded hover:bg-muted text-foreground transition-colors"
        :title="appStore.isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'"
      >
        <Sun v-if="appStore.isDark" class="w-4 h-4 text-amber-400" />
        <Moon v-else class="w-4 h-4 text-slate-600" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import {
  FileText,
  FolderOpen,
  Combine,
  Save,
  Undo2,
  Redo2,
  Sun,
  Moon,
  X,
  ShieldCheck,
  CircleHelp,
} from '@lucide/vue';
import { useAppStore } from '@/stores/appStore';
import { useDocumentStore } from '@/stores/documentStore';
import { useHistoryStore } from '@/stores/historyStore';
import { useCapabilityStore } from '@/stores/capabilityStore';

const appStore = useAppStore();
const docStore = useDocumentStore();
const historyStore = useHistoryStore();
const capStore = useCapabilityStore();

defineEmits<{
  (e: 'open-file'): void;
  (e: 'merge-files'): void;
  (e: 'save-file'): void;
  (e: 'show-help'): void;
}>();
</script>

