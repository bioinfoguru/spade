use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CertificationLevel {
    None,
    NoChangesAllowed,
    FormFillingAllowed,
    AnnotationsAllowed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfCapabilities {
    pub can_render: bool,
    pub can_extract_text: bool,
    pub can_edit_pages: bool,
    pub can_insert_text: bool,
    pub can_insert_images: bool,
    pub can_edit_forms: bool,
    pub can_apply_redactions: bool,
    pub can_encrypt: bool,
    pub has_existing_signatures: bool,
    pub certification_level: CertificationLevel,
    pub is_encrypted: bool,
    pub requires_password: bool,
    pub requires_raster_fallback: bool,
    pub unsupported_features: Vec<String>,
}


impl Default for PdfCapabilities {
    fn default() -> Self {
        Self {
            can_render: true,
            can_extract_text: true,
            can_edit_pages: true,
            can_insert_text: true,
            can_insert_images: true,
            can_edit_forms: true,
            can_apply_redactions: true,
            can_encrypt: true,
            has_existing_signatures: false,
            certification_level: CertificationLevel::None,
            is_encrypted: false,
            requires_password: false,
            requires_raster_fallback: false,
            unsupported_features: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfCompatibilityReport {
    pub supported: Vec<String>,
    pub partially_supported: Vec<String>,
    pub unsupported: Vec<String>,
    pub requires_special_handling: Vec<String>,
    pub safe_to_modify: bool,
    pub warnings: Vec<String>,
}
