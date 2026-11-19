<template>
  <main class="flex-1 min-h-0 overflow-y-auto bg-background">
    <div class="max-w-5xl mx-auto px-6 py-8 md:px-10 md:py-12">
      <div class="flex items-start justify-between gap-4 mb-9">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-2">SPADE guide</p>
          <p class="text-base md:text-lg text-muted-foreground mb-2"><strong class="text-foreground">S</strong>imple <strong class="text-foreground">P</strong>DF <strong class="text-foreground">A</strong>nnotation &amp; <strong class="text-foreground">D</strong>ocument <strong class="text-foreground">E</strong>ditor</p>
          <p class="text-muted-foreground mt-2 max-w-2xl">A quick guide to opening, organizing, annotating, converting, and saving your PDF files.</p>
        </div>
        <button @click="$emit('back')" class="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card hover:bg-muted text-sm font-medium transition-colors">
          <ArrowLeft class="w-4 h-4" /> Back to editor
        </button>
      </div>

      <section class="grid gap-4 md:grid-cols-2">
        <article class="rounded-xl border border-border bg-card p-5">
          <div class="flex items-center gap-3 mb-3"><span class="p-2 rounded-lg bg-primary/10 text-primary"><FolderOpen class="w-5 h-5" /></span><h2 class="font-semibold">Open and save</h2></div>
          <p class="text-sm text-muted-foreground leading-6">Choose <strong class="text-foreground">Open</strong> to load a PDF. Use <strong class="text-foreground">Save</strong> to write your changes back to the current file. The arrow next to Save offers <strong class="text-foreground">Save As</strong> when you want a separate copy. A dot beside the document name means it has unsaved changes, and closing a document with unsaved changes asks for confirmation.</p>
          <p class="text-sm text-muted-foreground leading-6 mt-2">Merge combines selected PDFs. When a document is open, the selected pages are added to it.</p>
        </article>

        <article class="rounded-xl border border-border bg-card p-5">
          <div class="flex items-center gap-3 mb-3"><span class="p-2 rounded-lg bg-primary/10 text-primary"><Layers class="w-5 h-5" /></span><h2 class="font-semibold">Navigate and organize pages</h2></div>
          <p class="text-sm text-muted-foreground leading-6">Use the left panel to browse page thumbnails. Select a page to view it; drag thumbnails to reorder pages. The toolbar can rotate, duplicate, crop, or delete the current page.</p>
          <p class="text-sm text-muted-foreground leading-6 mt-2">The outline and search tabs help you move through supported document content.</p>
        </article>

        <article class="rounded-xl border border-border bg-card p-5">
          <div class="flex items-center gap-3 mb-3"><span class="p-2 rounded-lg bg-primary/10 text-primary"><Pencil class="w-5 h-5" /></span><h2 class="font-semibold">Annotate a PDF</h2></div>
          <p class="text-sm text-muted-foreground leading-6">Choose a tool in the top toolbar, then interact with the page. With the highlight tool, drag across the text you want to mark. To remove a highlight, drawing, shape, or note, switch to Select, click it, then click Remove or press Delete. You can also draw freehand, add shapes or notes, insert text, or add an image. Select an inserted image to resize it with the handles, or use the crop button to trim it. The Properties panel also shows exact width, height, and position fields for the selected image.</p>
          <p class="text-sm text-muted-foreground leading-6 mt-2">Use Undo and Redo in the header to step through edits.</p>
        </article>

        <article class="rounded-xl border border-border bg-card p-5">
          <div class="flex items-center gap-3 mb-3"><span class="p-2 rounded-lg bg-primary/10 text-primary"><Images class="w-5 h-5" /></span><h2 class="font-semibold">Convert images and PDFs</h2></div>
          <p class="text-sm text-muted-foreground leading-6">Open <strong class="text-foreground">Convert → Images to PDF</strong> to combine PNG, JPEG, WebP, GIF, BMP, SVG, or AVIF pictures into a new PDF. Choose <strong class="text-foreground">Original</strong> to keep each image's natural page size, or pick A4, Letter, or Legal with portrait/landscape orientation, Fit or Stretch placement, and optional margins. Original pages are scaled down if they exceed an A4 long edge.</p>
          <p class="text-sm text-muted-foreground leading-6 mt-2">Choose <strong class="text-foreground">Convert → Export pages as images</strong> to save pages as PNG or JPEG. Pick the current page, all pages, or a range such as <code class="text-foreground">1-3, 5, 8-10</code>, then choose 96, 150, or 300 DPI and, on desktop, an output folder. Annotations, reordering, rotations, and crops are included in the exported images.</p>
          <p class="text-sm text-muted-foreground leading-6 mt-2">A generated PDF opens as an unsaved document with its images still editable. Select an image to resize, move, or crop it, or edit its exact size in the Properties panel. Save or Save As to keep it. If another PDF has unsaved changes, SPADE asks before replacing it. Exported image files are named after the document, for example <code class="text-foreground">report-page-03.png</code>.</p>
        </article>

        <article class="rounded-xl border border-border bg-card p-5">
          <div class="flex items-center gap-3 mb-3"><span class="p-2 rounded-lg bg-primary/10 text-primary"><Keyboard class="w-5 h-5" /></span><h2 class="font-semibold">Keyboard shortcuts</h2></div>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-4"><dt class="text-muted-foreground">Open PDF</dt><dd><kbd>Ctrl</kbd> <span class="text-muted-foreground">+</span> <kbd>O</kbd></dd></div>
            <div class="flex justify-between gap-4"><dt class="text-muted-foreground">Save PDF</dt><dd><kbd>Ctrl</kbd> <span class="text-muted-foreground">+</span> <kbd>S</kbd></dd></div>
            <div class="flex justify-between gap-4"><dt class="text-muted-foreground">Save As</dt><dd><kbd>Ctrl</kbd> <span class="text-muted-foreground">+</span> <kbd>Shift</kbd> <span class="text-muted-foreground">+</span> <kbd>S</kbd></dd></div>
            <div class="flex justify-between gap-4"><dt class="text-muted-foreground">Undo / Redo</dt><dd><kbd>Ctrl</kbd> <span class="text-muted-foreground">+</span> <kbd>Z</kbd> <span class="text-muted-foreground">/</span> <kbd>Y</kbd></dd></div>
            <div class="flex justify-between gap-4"><dt class="text-muted-foreground">Zoom in / out</dt><dd><kbd>Ctrl</kbd> <span class="text-muted-foreground">+</span> <kbd>+</kbd> <span class="text-muted-foreground">/</span> <kbd>-</kbd></dd></div>
            <div class="flex justify-between gap-4"><dt class="text-muted-foreground">Return to Select tool</dt><dd><kbd>Esc</kbd></dd></div>
          </dl>
          <p class="text-xs text-muted-foreground mt-3">On Mac, use <kbd>⌘</kbd> in place of <kbd>Ctrl</kbd>.</p>
        </article>
      </section>

      <section class="mt-6 rounded-xl border border-border bg-card p-5" aria-labelledby="updates-heading">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 id="updates-heading" class="font-semibold">App updates</h2>
            <p class="text-sm text-muted-foreground mt-1">Installed version: {{ updateStore.currentVersion }}</p>
          </div>
          <button
            type="button"
            :disabled="updateStore.isChecking"
            @click="updateStore.checkForUpdates()"
            class="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-border bg-secondary hover:bg-muted disabled:opacity-60 text-sm font-medium transition-colors"
          >
            <RefreshCw :class="['w-4 h-4', updateStore.isChecking && 'animate-spin']" />
            {{ updateStore.isChecking ? 'Checking…' : 'Check for updates' }}
          </button>
        </div>

        <div v-if="updateStore.statusMessage" class="mt-3 text-sm" role="status" aria-live="polite">
          <p
            :class="
              updateStore.updateAvailable
                ? 'text-emerald-600 dark:text-emerald-400'
                : updateStore.hasError
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-muted-foreground'
            "
          >
            {{ updateStore.statusMessage }}
          </p>
          <a
            v-if="updateStore.updateAvailable && updateStore.releasePageUrl"
            :href="updateStore.releasePageUrl"
            @click.prevent="openReleasePage"
            class="inline-flex items-center gap-1.5 mt-2 text-primary hover:underline font-medium"
          >
            View release {{ updateStore.latestVersion }} on GitHub
            <ExternalLink class="w-3.5 h-3.5" />
          </a>
          <p v-if="lastCheckedLabel && !updateStore.isChecking" class="text-[11px] text-muted-foreground mt-1.5">
            Last checked at {{ lastCheckedLabel }}
          </p>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ArrowLeft, FolderOpen, Layers, Pencil, Images, Keyboard, RefreshCw, ExternalLink } from '@lucide/vue';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useUpdateStore } from '@/stores/updateStore';

const updateStore = useUpdateStore();

async function openReleasePage() {
  if (updateStore.releasePageUrl) {
    await openUrl(updateStore.releasePageUrl);
  }
}

const lastCheckedLabel = computed(() => {
  if (!updateStore.lastCheckedAt) return '';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(updateStore.lastCheckedAt));
});

defineEmits<{ (event: 'back'): void }>();
</script>

<style scoped>
kbd {
  display: inline-block;
  min-width: 1.5rem;
  padding: 0.1rem 0.35rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.3rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  text-align: center;
  font-size: 0.72rem;
  font-family: inherit;
}
</style>
