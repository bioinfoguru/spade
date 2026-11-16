use lopdf::{Document, Object};
use crate::models::capabilities::{CertificationLevel, PdfCapabilities, PdfCompatibilityReport};
use crate::models::error::PdfError;

pub struct FeatureDetector;

impl FeatureDetector {
    pub fn inspect_document(doc: &Document) -> Result<(PdfCapabilities, PdfCompatibilityReport), PdfError> {
        let mut caps = PdfCapabilities::default();
        let mut report = PdfCompatibilityReport {
            supported: vec!["Standard Content Streams".into(), "Text Selection".into()],
            partially_supported: Vec::new(),
            unsupported: Vec::new(),
            requires_special_handling: Vec::new(),
            safe_to_modify: true,
            warnings: Vec::new(),
        };

        // 1. Check encryption
        if doc.is_encrypted() {
            caps.is_encrypted = true;
            caps.requires_password = true;
            report.partially_supported.push("Encrypted PDF".into());
            report.warnings.push("Document is password protected".into());
        }

        // 2. Check Catalog / Root dictionary
        if let Ok(catalog) = doc.catalog() {
            // Check for AcroForms / XFA
            if let Ok(acro_form) = catalog.get(b"AcroForm") {
                if let Ok(form_dict) = acro_form.as_dict() {
                    caps.can_edit_forms = true;
                    report.supported.push("AcroForms".into());

                    // Check if XFA is present
                    if form_dict.has(b"XFA") {
                        report.unsupported.push("XFA Dynamic Forms".into());
                        report.warnings.push(
                            "Document contains dynamic XFA forms. Only static representation is supported.".into()
                        );
                        report.safe_to_modify = false;
                    }

                    // Check for signatures (/SigFlags)
                    if let Ok(sig_flags) = form_dict.get(b"SigFlags").and_then(Object::as_i64) {
                        if sig_flags > 0 {
                            caps.has_existing_signatures = true;
                            caps.certification_level = CertificationLevel::AnnotationsAllowed;
                            report.requires_special_handling.push("Digital Signatures Present".into());
                            report.warnings.push(
                                "Document is digitally signed. Editing pages will invalidate cryptographic signatures.".into()
                            );
                        }
                    }
                }
            }

            // Check for Optional Content Groups (Layers)
            if catalog.has(b"OCProperties") {
                report.partially_supported.push("Optional Content Groups (Layers)".into());
            }

            // Check for Permissions (DocMDP)
            if let Ok(perms) = catalog.get(b"Perms").and_then(Object::as_dict) {
                if perms.has(b"DocMDP") {
                    caps.has_existing_signatures = true;
                    caps.certification_level = CertificationLevel::NoChangesAllowed;
                    report.warnings.push("DocMDP certification policy restricts document modifications.".into());
                }
            }
        }

        // 3. Linearized check
        // Linearized PDFs have a linearization parameter dictionary near object 1
        for (_, object) in doc.objects.iter() {
            if let Ok(dict) = object.as_dict() {
                if dict.has(b"Linearized") {
                    report.requires_special_handling.push("Linearized (Fast Web View)".into());
                    break;
                }
            }
        }

        Ok((caps, report))
    }
}

