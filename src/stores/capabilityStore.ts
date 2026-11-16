import { defineStore } from 'pinia';
import { ref } from 'vue';
import { PdfCapabilities, PdfCompatibilityReport } from '@/types/capabilities';

export const useCapabilityStore = defineStore('capability', () => {
  const capabilities = ref<PdfCapabilities>({
    canRender: true,
    canExtractText: true,
    canEditPages: true,
    canInsertText: true,
    canInsertImages: true,
    canEditForms: true,
    canApplyRedactions: true,
    canEncrypt: true,
    hasExistingSignatures: false,
    certificationLevel: 'None',
    isEncrypted: false,
    requiresPassword: false,
    requiresRasterFallback: false,
    unsupportedFeatures: [],
  });

  const compatibility = ref<PdfCompatibilityReport>({
    supported: ['Standard PDF Objects', 'Annotations', 'AcroForms', 'Page Tree'],
    partiallySupported: [],
    unsupported: [],
    requiresSpecialHandling: [],
    safeToModify: true,
    warnings: [],
  });

  function setCapabilities(caps: Partial<PdfCapabilities>) {
    capabilities.value = { ...capabilities.value, ...caps };
  }

  function setCompatibility(report: PdfCompatibilityReport) {
    compatibility.value = report;
  }

  return {
    capabilities,
    compatibility,
    setCapabilities,
    setCompatibility,
  };
});
