<template>
  <main class="flex-1 min-h-0 overflow-y-auto bg-background">
    <div class="max-w-5xl mx-auto px-6 py-8 md:px-10 md:py-12">
      <div class="flex items-start justify-between gap-4 mb-9">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-2">SPADE guide</p>
          <h1 class="text-3xl md:text-4xl font-semibold tracking-tight">How can we help?</h1>
          <p class="text-muted-foreground mt-2 max-w-2xl">A quick guide to opening, organizing, annotating, and saving your PDF files.</p>
        </div>
        <button @click="$emit('back')" class="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card hover:bg-muted text-sm font-medium transition-colors">
          <ArrowLeft class="w-4 h-4" /> Back to editor
        </button>
      </div>

      <section class="grid gap-4 md:grid-cols-2">
        <article class="rounded-xl border border-border bg-card p-5">
          <div class="flex items-center gap-3 mb-3"><span class="p-2 rounded-lg bg-primary/10 text-primary"><FolderOpen class="w-5 h-5" /></span><h2 class="font-semibold">Open and save</h2></div>
          <p class="text-sm text-muted-foreground leading-6">Choose <strong class="text-foreground">Open</strong> to load a PDF. Use <strong class="text-foreground">Save</strong> to export your changes as a PDF. A dot beside the document name means it has unsaved changes.</p>
          <p class="text-sm text-muted-foreground leading-6 mt-2">Merge combines selected PDFs. When a document is open, the selected pages are added to it.</p>
        </article>

        <article class="rounded-xl border border-border bg-card p-5">
          <div class="flex items-center gap-3 mb-3"><span class="p-2 rounded-lg bg-primary/10 text-primary"><Layers class="w-5 h-5" /></span><h2 class="font-semibold">Navigate and organize pages</h2></div>
          <p class="text-sm text-muted-foreground leading-6">Use the left panel to browse page thumbnails. Select a page to view it; drag thumbnails to reorder pages. The toolbar can rotate, duplicate, crop, or delete the current page.</p>
          <p class="text-sm text-muted-foreground leading-6 mt-2">The outline and search tabs help you move through supported document content.</p>
        </article>

        <article class="rounded-xl border border-border bg-card p-5">
          <div class="flex items-center gap-3 mb-3"><span class="p-2 rounded-lg bg-primary/10 text-primary"><Pencil class="w-5 h-5" /></span><h2 class="font-semibold">Annotate a PDF</h2></div>
          <p class="text-sm text-muted-foreground leading-6">Choose a tool in the top toolbar, then interact with the page. Highlight text, draw freehand, add shapes or notes, insert text, or add an image. Select an annotation to adjust it in the properties panel.</p>
          <p class="text-sm text-muted-foreground leading-6 mt-2">Use Undo and Redo in the header to step through edits.</p>
        </article>

        <article class="rounded-xl border border-border bg-card p-5">
          <div class="flex items-center gap-3 mb-3"><span class="p-2 rounded-lg bg-primary/10 text-primary"><Keyboard class="w-5 h-5" /></span><h2 class="font-semibold">Keyboard shortcuts</h2></div>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-4"><dt class="text-muted-foreground">Open PDF</dt><dd><kbd>Ctrl</kbd> <span class="text-muted-foreground">+</span> <kbd>O</kbd></dd></div>
            <div class="flex justify-between gap-4"><dt class="text-muted-foreground">Save PDF</dt><dd><kbd>Ctrl</kbd> <span class="text-muted-foreground">+</span> <kbd>S</kbd></dd></div>
            <div class="flex justify-between gap-4"><dt class="text-muted-foreground">Undo / Redo</dt><dd><kbd>Ctrl</kbd> <span class="text-muted-foreground">+</span> <kbd>Z</kbd> <span class="text-muted-foreground">/</span> <kbd>Y</kbd></dd></div>
            <div class="flex justify-between gap-4"><dt class="text-muted-foreground">Zoom in / out</dt><dd><kbd>Ctrl</kbd> <span class="text-muted-foreground">+</span> <kbd>+</kbd> <span class="text-muted-foreground">/</span> <kbd>-</kbd></dd></div>
            <div class="flex justify-between gap-4"><dt class="text-muted-foreground">Return to Select tool</dt><dd><kbd>Esc</kbd></dd></div>
          </dl>
          <p class="text-xs text-muted-foreground mt-3">On Mac, use <kbd>⌘</kbd> in place of <kbd>Ctrl</kbd>.</p>
        </article>
      </section>

      <div class="mt-6 rounded-xl border border-border/70 bg-secondary/40 px-5 py-4 flex items-start gap-3">
        <Lightbulb class="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p class="text-sm text-muted-foreground leading-6"><strong class="text-foreground">Tip:</strong> Save creates an exported copy of the edited PDF. Keep the original file if you may need it later.</p>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ArrowLeft, FolderOpen, Layers, Pencil, Keyboard, Lightbulb } from '@lucide/vue';

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
