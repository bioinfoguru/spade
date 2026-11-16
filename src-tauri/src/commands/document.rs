use lopdf::Document;
use crate::models::capabilities::{PdfCapabilities, PdfCompatibilityReport};
use crate::pdf::compatibility::feature_detector::FeatureDetector;
use crate::pdf::transactions::atomic_file_tx::AtomicFileTransaction;

#[tauri::command]
pub async fn inspect_document(
    file_path: String,
) -> Result<(PdfCapabilities, PdfCompatibilityReport), String> {
    tokio::task::spawn_blocking(move || {
        let doc = Document::load(&file_path).map_err(|e| e.to_string())?;
        FeatureDetector::inspect_document(&doc).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn save_document_atomic(
    file_path: String,
    bytes: Vec<u8>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut tx = AtomicFileTransaction::begin(&file_path).map_err(|e| e.to_string())?;
        tx.write_and_commit(&bytes).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
