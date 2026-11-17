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
            @click.stop="closeCurrentDocument"
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

      <!-- Convert dropdown: images to PDF and PDF pages to images -->
      <div ref="convertMenuRef" class="relative">
        <button
          @click.stop="toggleConvertMenu"
          class="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-secondary hover:bg-muted border border-border text-xs font-medium text-foreground transition-colors"
          title="Convert between images and PDF"
          aria-haspopup="menu"
          :aria-expanded="convertMenuOpen"
        >
          <Images class="w-3.5 h-3.5" />
          <span>Convert</span>
          <ChevronDown class="w-3 h-3" />
        </button>

        <div
          v-if="convertMenuOpen"
          class="absolute right-0 top-full z-50 mt-1 w-60 rounded-md border border-border bg-card p-1 text-xs shadow-xl"
          role="menu"
        >
          <button
            class="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-foreground hover:bg-muted transition-colors"
            role="menuitem"
            @click="chooseImagesToPdf"
          >
            <Images class="mt-0.5 w-3.5 h-3.5 text-muted-foreground" />
            <span class="flex flex-col">
              <span>Images to PDF...</span>
              <span class="text-[10px] text-muted-foreground">Combine pictures into a new PDF</span>
            </span>
          </button>
          <button
            class="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
            role="menuitem"
            :disabled="!docStore.currentDoc"
            @click="chooseExportImages"
          >
            <FileImage class="mt-0.5 w-3.5 h-3.5 text-muted-foreground" />
            <span class="flex flex-col">
              <span>Export pages as images...</span>
              <span class="text-[10px] text-muted-foreground">Save pages as PNG or JPEG</span>
            </span>
          </button>
        </div>
      </div>

      <!-- Save split button: click saves in place, arrow opens Save As -->
      <div ref="saveMenuRef" class="relative flex items-stretch">
        <button
          @click="chooseSave"
          :disabled="!docStore.currentDoc"
          class="flex items-center space-x-1.5 px-2.5 py-1 rounded-l bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 text-xs font-medium transition-colors shadow-sm"
          title="Save (Ctrl+S)"
        >
          <Save class="w-3.5 h-3.5" />
          <span>Save</span>
        </button>
        <button
          @click.stop="saveMenuOpen = !saveMenuOpen"
          :disabled="!docStore.currentDoc"
          class="flex items-center rounded-r border-l border-primary-foreground/25 bg-primary px-1 text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors shadow-sm"
          title="Save options"
          aria-haspopup="menu"
          :aria-expanded="saveMenuOpen"
        >
          <ChevronDown class="w-3 h-3" />
        </button>

        <div
          v-if="saveMenuOpen"
          class="absolute right-0 top-full z-50 mt-1 w-52 rounded-md border border-border bg-card p-1 text-xs shadow-xl"
          role="menu"
        >
          <button
            class="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-foreground hover:bg-muted transition-colors"
            role="menuitem"
            @click="chooseSave"
          >
            <span class="flex items-center gap-2">
              <Save class="w-3.5 h-3.5 text-muted-foreground" />
              Save
            </span>
            <span class="font-mono text-[10px] text-muted-foreground">Ctrl+S</span>
          </button>
          <button
            class="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-foreground hover:bg-muted transition-colors"
            role="menuitem"
            @click="chooseSaveAs"
          >
            <span class="flex items-center gap-2">
              <SaveAll class="w-3.5 h-3.5 text-muted-foreground" />
              Save As...
            </span>
            <span class="font-mono text-[10px] text-muted-foreground">Ctrl+Shift+S</span>
          </button>
        </div>
      </div>

      <button
        @click="$emit('show-help')"
        class="relative flex items-center space-x-1.5 px-2 py-1 rounded text-xs font-medium text-foreground hover:bg-muted transition-colors"
        :title="
          updateStore.updateAvailable
            ? `Update available: SPADE ${updateStore.latestVersion}`
            : 'Help and keyboard shortcuts'
        "
      >
        <CircleHelp class="w-3.5 h-3.5" />
        <span>Help</span>
        <span
          v-if="updateStore.updateAvailable"
          class="pointer-events-none absolute right-0 top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-card"
          aria-hidden="true"
        ></span>
        <span v-if="updateStore.updateAvailable" class="sr-only">Update available</span>
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
import { ref, onMounted, onBeforeUnmount } from 'vue';
import {
  FileText,
  FolderOpen,
  Combine,
  Images,
  FileImage,
  Save,
  SaveAll,
  ChevronDown,
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
import { useUpdateStore } from '@/stores/updateStore';
import { isTauri } from '@tauri-apps/api/core';
import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';

const appStore = useAppStore();
const docStore = useDocumentStore();
const historyStore = useHistoryStore();
const capStore = useCapabilityStore();
const updateStore = useUpdateStore();

const emit = defineEmits<{
  (e: 'open-file'): void;
  (e: 'merge-files'): void;
  (e: 'images-to-pdf'): void;
  (e: 'export-images'): void;
  (e: 'save-file'): void;
  (e: 'save-file-as'): void;
  (e: 'show-help'): void;
}>();

const saveMenuRef = ref<HTMLElement | null>(null);
const saveMenuOpen = ref(false);
const convertMenuRef = ref<HTMLElement | null>(null);
const convertMenuOpen = ref(false);

function toggleConvertMenu() {
  convertMenuOpen.value = !convertMenuOpen.value;
  if (convertMenuOpen.value) saveMenuOpen.value = false;
}

function chooseImagesToPdf() {
  convertMenuOpen.value = false;
  emit('images-to-pdf');
}

function chooseExportImages() {
  convertMenuOpen.value = false;
  emit('export-images');
}

function chooseSave() {
  saveMenuOpen.value = false;
  emit('save-file');
}

function chooseSaveAs() {
  saveMenuOpen.value = false;
  emit('save-file-as');
}

async function closeCurrentDocument() {
  const doc = docStore.currentDoc;
  if (!doc) return;

  if (doc.isDirty) {
    const message =
      'You have unsaved changes. Are you sure you want to close without saving?';

    let confirmed = false;
    if (isTauri()) {
      try {
        confirmed = await tauriConfirm(message, {
          title: 'Unsaved Changes',
          kind: 'warning',
          okLabel: 'Close Without Saving',
          cancelLabel: 'Keep Editing',
        });
      } catch {
        confirmed = window.confirm(message);
      }
    } else {
      confirmed = window.confirm(message);
    }

    if (!confirmed) return;
  }

  docStore.closeDocument(doc.id);
}

function onDocumentPointerDown(e: PointerEvent) {
  const target = e.target as Node | null;
  if (saveMenuOpen.value && !(target && saveMenuRef.value?.contains(target))) {
    saveMenuOpen.value = false;
  }
  if (convertMenuOpen.value && !(target && convertMenuRef.value?.contains(target))) {
    convertMenuOpen.value = false;
  }
}

function onDocumentKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    saveMenuOpen.value = false;
    convertMenuOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
  document.addEventListener('keydown', onDocumentKeyDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  document.removeEventListener('keydown', onDocumentKeyDown);
});
</script>

