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
              <Images class="h-4 w-4" />
            </span>
            <div>
              <h2 class="text-sm font-semibold">Images to PDF options</h2>
              <p class="text-[11px] text-muted-foreground">{{ imageCount }} {{ imageCount === 1 ? 'image' : 'images' }} selected</p>
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
          <!-- Page size -->
          <div class="space-y-2">
            <label class="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Page size
            </label>
            <div class="flex items-center gap-1 rounded-md border border-border bg-secondary/50 p-0.5">
              <button
                v-for="option in pageSizeOptions"
                :key="option.value"
                class="flex-1 rounded px-2 py-1 font-medium transition-colors"
                :class="
                  pageSize === option.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground hover:bg-muted'
                "
                @click="pageSize = option.value"
              >
                {{ option.label }}
              </button>
            </div>
            <p v-if="pageSize === 'original'" class="text-[11px] text-muted-foreground">
              Each page matches its image. Oversized images are scaled down to fit an A4 long edge.
            </p>
          </div>

          <template v-if="pageSize !== 'original'">
            <!-- Orientation -->
            <div class="space-y-2">
              <label class="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Orientation
              </label>
              <div class="flex items-center gap-1 rounded-md border border-border bg-secondary/50 p-0.5">
                <button
                  v-for="option in orientationOptions"
                  :key="option.value"
                  class="flex-1 rounded px-2 py-1 font-medium transition-colors"
                  :class="
                    orientation === option.value
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground hover:bg-muted'
                  "
                  @click="orientation = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>

            <!-- Image placement -->
            <div class="space-y-2">
              <label class="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Image placement
              </label>
              <div class="flex items-center gap-1 rounded-md border border-border bg-secondary/50 p-0.5">
                <button
                  v-for="option in fitOptions"
                  :key="option.value"
                  class="flex-1 rounded px-2 py-1 font-medium transition-colors"
                  :class="
                    fit === option.value
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground hover:bg-muted'
                  "
                  @click="fit = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
              <p class="text-[11px] text-muted-foreground">
                Fit keeps the aspect ratio; Stretch fills the page and may distort the image.
              </p>
            </div>

            <!-- Margin -->
            <div class="space-y-1.5">
              <label class="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Margin
              </label>
              <select
                v-model.number="marginMm"
                class="w-full rounded border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option :value="0">None</option>
                <option :value="5">5 mm</option>
                <option :value="10">10 mm</option>
                <option :value="20">20 mm</option>
              </select>
            </div>
          </template>
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
            class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            @click="submit"
          >
            <FilePlus2 class="h-3.5 w-3.5" />
            Create PDF
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { FilePlus2, Images, X } from '@lucide/vue';
import type {
  ImageFitMode,
  ImagesToPdfOptions,
  ImagesToPdfOrientation,
  ImagesToPdfPageSize,
} from '@/services/imageConversion';

defineProps<{ imageCount: number }>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'convert', options: ImagesToPdfOptions): void;
}>();

const pageSizeOptions: Array<{ value: ImagesToPdfPageSize; label: string }> = [
  { value: 'original', label: 'Original' },
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Letter' },
  { value: 'legal', label: 'Legal' },
];

const orientationOptions: Array<{ value: ImagesToPdfOrientation; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
];

const fitOptions: Array<{ value: ImageFitMode; label: string }> = [
  { value: 'fit', label: 'Fit' },
  { value: 'stretch', label: 'Stretch' },
];

const pageSize = ref<ImagesToPdfPageSize>('original');
const orientation = ref<ImagesToPdfOrientation>('auto');
const fit = ref<ImageFitMode>('fit');
const marginMm = ref(0);

function close() {
  emit('close');
}

function submit() {
  emit('convert', {
    pageSize: pageSize.value,
    orientation: orientation.value,
    fit: fit.value,
    marginMm: marginMm.value,
  });
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') close();
}

onMounted(() => window.addEventListener('keydown', onKeyDown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown));
</script>
