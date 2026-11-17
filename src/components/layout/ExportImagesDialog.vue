<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      @click.self="close"
      @keydown.esc="close"
    >
      <div class="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-border px-4 py-3">
          <div class="flex items-center gap-2">
            <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ImageIcon class="h-4 w-4" />
            </span>
            <div>
              <h2 class="text-sm font-semibold">Export pages as images</h2>
              <p class="text-[11px] text-muted-foreground">Save pages as PNG or JPEG files</p>
            </div>
          </div>
          <button
            class="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Close"
            @click="close"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="space-y-4 px-4 py-4 text-xs">
          <!-- Pages -->
          <div class="space-y-2">
            <label class="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pages
            </label>
            <div class="flex items-center gap-1 rounded-md border border-border bg-secondary/50 p-0.5">
              <button
                v-for="option in scopeOptions"
                :key="option.value"
                class="flex-1 rounded px-2 py-1 font-medium transition-colors"
                :class="
                  scope === option.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground hover:bg-muted'
                "
                @click="scope = option.value"
              >
                {{ option.label }}
              </button>
            </div>

            <input
              v-if="scope === 'custom'"
              v-model="customRange"
              type="text"
              inputmode="numeric"
              placeholder="e.g. 1-3, 5, 8-10"
              class="w-full rounded border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              @keydown.enter="submit"
            />
            <p v-if="scope === 'custom' && rangeInvalid" class="text-[11px] text-destructive">
              Enter page numbers or ranges within 1–{{ totalPages }}.
            </p>
            <p v-else class="text-[11px] text-muted-foreground">
              {{ pages.length }} {{ pages.length === 1 ? 'page' : 'pages' }} selected
              <template v-if="scope === 'custom'"> from a {{ totalPages }}-page document</template>
            </p>
          </div>

          <!-- Format -->
          <div class="space-y-2">
            <label class="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Format
            </label>
            <div class="flex items-center gap-1 rounded-md border border-border bg-secondary/50 p-0.5">
              <button
                v-for="option in formatOptions"
                :key="option.value"
                class="flex-1 rounded px-2 py-1 font-medium transition-colors"
                :class="
                  format === option.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground hover:bg-muted'
                "
                @click="format = option.value"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <!-- Resolution -->
          <div class="space-y-1.5">
            <label class="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Resolution
            </label>
            <select
              v-model.number="dpi"
              class="w-full rounded border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option :value="96">96 DPI — Screen</option>
              <option :value="150">150 DPI — Print (recommended)</option>
              <option :value="300">300 DPI — High quality</option>
            </select>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-2 border-t border-border bg-secondary/20 px-4 py-3">
          <button
            class="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            @click="close"
          >
            Cancel
          </button>
          <button
            class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-40"
            :disabled="pages.length === 0"
            @click="submit"
          >
            <Download class="h-3.5 w-3.5" />
            Export {{ pages.length || '' }} {{ pages.length === 1 ? 'image' : 'images' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { Download, Image as ImageIcon, X } from '@lucide/vue';
import type { ImageExportFormat } from '@/services/imageConversion';

const props = defineProps<{
  totalPages: number;
  currentPage: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (
    e: 'export',
    options: { pages: number[]; format: ImageExportFormat; dpi: number }
  ): void;
}>();

type PageScope = 'current' | 'all' | 'custom';

const scopeOptions: Array<{ value: PageScope; label: string }> = [
  { value: 'current', label: 'Current page' },
  { value: 'all', label: 'All pages' },
  { value: 'custom', label: 'Custom' },
];

const formatOptions: Array<{ value: ImageExportFormat; label: string }> = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
];

const scope = ref<PageScope>('current');
const customRange = ref('');
const format = ref<ImageExportFormat>('png');
const dpi = ref(150);

function parsePageRange(input: string, total: number): number[] {
  const normalized = input.replace(/\s*-\s*/g, '-').trim();
  if (!normalized) return [];

  const pages = new Set<number>();
  for (const token of normalized.split(/[,;\s]+/)) {
    if (!token) continue;

    const match = /^(\d+)(?:-(\d+))?$/.exec(token);
    if (!match) return [];

    let start = Number(match[1]);
    let end = match[2] ? Number(match[2]) : start;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
    if (start > end) [start, end] = [end, start];

    for (let page = start; page <= end; page++) {
      if (page >= 1 && page <= total) pages.add(page);
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

const pages = computed<number[]>(() => {
  if (scope.value === 'current') {
    return props.currentPage >= 1 && props.currentPage <= props.totalPages
      ? [props.currentPage]
      : [];
  }
  if (scope.value === 'all') {
    return Array.from({ length: props.totalPages }, (_, index) => index + 1);
  }
  return parsePageRange(customRange.value, props.totalPages);
});

const rangeInvalid = computed(
  () => scope.value === 'custom' && customRange.value.trim().length > 0 && pages.value.length === 0
);

function close() {
  emit('close');
}

function submit() {
  if (pages.value.length === 0) return;
  emit('export', {
    pages: pages.value,
    format: format.value,
    dpi: dpi.value,
  });
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') close();
}

onMounted(() => window.addEventListener('keydown', onKeyDown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown));
</script>
