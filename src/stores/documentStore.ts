import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PdfDocumentInfo } from '@/types/pdf';

export const useDocumentStore = defineStore('document', () => {
  const currentDoc = ref<PdfDocumentInfo | null>(null);
  const openDocs = ref<PdfDocumentInfo[]>([]);
  const pdfProxy = shallowRef<PDFDocumentProxy | null>(null);
  const pdfBytes = shallowRef<Uint8Array | null>(null);
  const isLoading = ref(false);
  const loadingProgress = ref(0);

  function setCurrentDoc(doc: PdfDocumentInfo | null, proxy: PDFDocumentProxy | null, bytes?: Uint8Array) {
    currentDoc.value = doc;
    pdfProxy.value = proxy;
    if (bytes) {
      pdfBytes.value = bytes;
    }
    if (doc && !openDocs.value.some((d) => d.id === doc.id)) {
      openDocs.value.push(doc);
    }
  }

  function markDirty(dirty = true) {
    if (currentDoc.value) {
      currentDoc.value.isDirty = dirty;
    }
  }

  function closeDocument(docId: string) {
    const idx = openDocs.value.findIndex((d) => d.id === docId);
    if (idx !== -1) {
      openDocs.value.splice(idx, 1);
      if (currentDoc.value?.id === docId) {
        currentDoc.value = openDocs.value[0] || null;
      }
    }
  }

  return {
    currentDoc,
    openDocs,
    pdfProxy,
    pdfBytes,
    isLoading,
    loadingProgress,
    setCurrentDoc,
    markDirty,
    closeDocument,
  };
});

