export type CertificationLevel = 
  | "None" 
  | "NoChangesAllowed" 
  | "FormFillingAllowed" 
  | "AnnotationsAllowed";

export interface PdfCapabilities {
  canRender: boolean;
  canExtractText: boolean;
  canEditPages: boolean;
  canInsertText: boolean;
  canInsertImages: boolean;
  canEditForms: boolean;
  canApplyRedactions: boolean;
  canEncrypt: boolean;
  hasExistingSignatures: boolean;
  certificationLevel: CertificationLevel;
  isEncrypted: boolean;
  requiresPassword: boolean;
  requiresRasterFallback: boolean;
  unsupportedFeatures: string[];
}

export interface PdfCompatibilityReport {
  supported: string[];
  partiallySupported: string[];
  unsupported: string[];
  requiresSpecialHandling: string[];
  safeToModify: boolean;
  warnings: string[];
}

