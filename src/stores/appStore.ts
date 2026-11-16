import { defineStore } from 'pinia';
import { ref } from 'vue';

export type SidebarTab = 'thumbnails' | 'outline' | 'bookmarks' | 'attachments' | 'search';
export type ActiveTool = 'select' | 'hand' | 'highlight' | 'underline' | 'strikeout' | 'draw' | 'shape' | 'note' | 'text' | 'image' | 'signature' | 'redact' | 'forms';

export const useAppStore = defineStore('app', () => {
  const isDark = ref(true);
  const leftSidebarOpen = ref(true);
  const leftSidebarTab = ref<SidebarTab>('thumbnails');
  const rightSidebarOpen = ref(true);
  const activeTool = ref<ActiveTool>('select');

  // Selected tool properties
  const strokeColor = ref('#3b82f6');
  const fillColor = ref('#93c5fd');
  const strokeWidth = ref(2);
  const opacity = ref(1.0);
  const fontSize = ref(14);
  const fontFamily = ref('Inter, sans-serif');
  const textColor = ref('#111827');
  const isBold = ref(false);
  const isItalic = ref(false);
  const textAlign = ref<'left' | 'center' | 'right'>('left');

  function toggleTheme() {
    isDark.value = !isDark.value;
    if (isDark.value) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  function setTool(tool: ActiveTool) {
    activeTool.value = tool;
  }

  return {
    isDark,
    leftSidebarOpen,
    leftSidebarTab,
    rightSidebarOpen,
    activeTool,
    strokeColor,
    fillColor,
    strokeWidth,
    opacity,
    fontSize,
    fontFamily,
    textColor,
    isBold,
    isItalic,
    textAlign,
    toggleTheme,
    setTool,
  };
});
