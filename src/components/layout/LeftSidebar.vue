<template>
  <aside
    v-show="appStore.leftSidebarOpen"
    class="w-64 bg-card border-r border-border flex flex-col select-none shrink-0 overflow-hidden z-10 transition-all duration-150"
  >
    <!-- Sidebar Header Tabs -->
    <div class="h-9 border-b border-border flex items-center justify-between px-2 bg-secondary/30">
      <div class="flex items-center space-x-1">
        <button
          @click="appStore.leftSidebarTab = 'thumbnails'"
          :class="[
            'p-1.5 rounded transition-colors',
            appStore.leftSidebarTab === 'thumbnails'
              ? 'bg-secondary text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          ]"
          title="Page Thumbnails"
        >
          <Layers class="w-3.5 h-3.5" />
        </button>

        <button
          @click="appStore.leftSidebarTab = 'outline'"
          :class="[
            'p-1.5 rounded transition-colors',
            appStore.leftSidebarTab === 'outline'
              ? 'bg-secondary text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          ]"
          title="Document Outline (TOC)"
        >
          <ListTree class="w-3.5 h-3.5" />
        </button>

        <button
          @click="appStore.leftSidebarTab = 'bookmarks'"
          :class="[
            'p-1.5 rounded transition-colors',
            appStore.leftSidebarTab === 'bookmarks'
              ? 'bg-secondary text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          ]"
          title="Bookmarks"
        >
          <Bookmark class="w-3.5 h-3.5" />
        </button>

        <button
          @click="appStore.leftSidebarTab = 'search'"
          :class="[
            'p-1.5 rounded transition-colors',
            appStore.leftSidebarTab === 'search'
              ? 'bg-secondary text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          ]"
          title="Search in Document"
        >
          <Search class="w-3.5 h-3.5" />
        </button>
      </div>

      <button
        @click="appStore.leftSidebarOpen = false"
        class="p-1 rounded text-muted-foreground hover:text-foreground"
        title="Collapse Sidebar"
      >
        <PanelLeftClose class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Sidebar Body Content -->
    <div class="flex-1 overflow-y-auto p-2">
      <!-- 1. Page Thumbnails Tab -->
      <div v-if="appStore.leftSidebarTab === 'thumbnails'" class="flex flex-col space-y-3">
        <div v-if="!docStore.currentDoc" class="text-xs text-muted-foreground text-center py-8">
          No document loaded
        </div>
        <div
          v-else
          v-for="pageIndex in opStore.pageOrder"
          :key="pageIndex"
          @click="viewerStore.setPage(pageIndex + 1)"
          :class="[
            'relative flex flex-col items-center p-2 rounded-lg border cursor-pointer transition-all group',
            viewerStore.currentPage === pageIndex + 1
              ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-sm'
              : 'border-border/80 hover:border-border hover:bg-secondary/40'
          ]"
        >
          <!-- Thumbnail preview container -->
          <div class="w-full aspect-[1/1.3] bg-background rounded border border-border/50 flex items-center justify-center overflow-hidden shadow-xs">
            <img
              v-if="thumbnails[pageIndex]"
              :src="thumbnails[pageIndex]"
              class="w-full h-full object-contain"
              :alt="`Page ${pageIndex + 1}`"
            />
            <div v-else class="text-[11px] text-muted-foreground flex flex-col items-center">
              <FileText class="w-5 h-5 mb-1 opacity-40" />
              <span>Page {{ pageIndex + 1 }}</span>
            </div>
          </div>
          <!-- Page Number Indicator -->
          <span class="text-[11px] font-medium text-foreground mt-1.5">
            {{ pageIndex + 1 }}
          </span>
        </div>
      </div>

      <!-- 2. Document Outline / TOC Tab -->
      <div v-else-if="appStore.leftSidebarTab === 'outline'">
        <div v-if="!docStore.currentDoc || docStore.currentDoc.outline.length === 0" class="text-xs text-muted-foreground text-center py-8">
          No outline available
        </div>
        <div v-else class="text-xs space-y-1">
          <div
            v-for="(item, idx) in docStore.currentDoc.outline"
            :key="idx"
            class="flex items-center space-x-1.5 py-1 px-1.5 rounded hover:bg-secondary/60 cursor-pointer text-foreground"
          >
            <ChevronRight class="w-3 h-3 text-muted-foreground shrink-0" />
            <span class="truncate">{{ item.title }}</span>
          </div>
        </div>
      </div>

      <!-- 3. Bookmarks Tab -->
      <div v-else-if="appStore.leftSidebarTab === 'bookmarks'" class="text-xs text-muted-foreground text-center py-8">
        No bookmarks saved
      </div>

      <!-- 4. Search Tab -->
      <div v-else-if="appStore.leftSidebarTab === 'search'" class="space-y-3">
        <div class="relative">
          <input
            v-model="viewerStore.searchQuery"
            type="text"
            placeholder="Search text..."
            class="w-full pl-7 pr-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
          />
          <Search class="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-2" />
        </div>
        <div v-if="viewerStore.searchQuery" class="text-xs text-muted-foreground">
          Found {{ viewerStore.searchMatches.length }} matches
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  Layers,
  ListTree,
  Bookmark,
  Search,
  PanelLeftClose,
  ChevronRight,
  FileText,
} from 'lucide-vue-next';
import { useAppStore } from '@/stores/appStore';
import { useDocumentStore } from '@/stores/documentStore';
import { useViewerStore } from '@/stores/viewerStore';
import { useOperationStore } from '@/stores/operationStore';
import { PdfService } from '@/services/pdfWorker';

const appStore = useAppStore();
const docStore = useDocumentStore();
const viewerStore = useViewerStore();
const opStore = useOperationStore();

const thumbnails = ref<Record<number, string>>({});

// Lazy thumbnail rendering
watch(
  () => docStore.pdfProxy,
  async (proxy) => {
    thumbnails.value = {};
    if (!proxy) return;

    const count = Math.min(proxy.numPages, 30); // Preload first 30 thumbnails
    for (let i = 1; i <= count; i++) {
      try {
        const page = await proxy.getPage(i);
        const dataUrl = await PdfService.renderThumbnail(page, 180);
        thumbnails.value[i - 1] = dataUrl;
      } catch (err) {
        console.warn(`Failed to render thumbnail for page ${i}:`, err);
      }
    }
  },
  { immediate: true }
);
</script>
