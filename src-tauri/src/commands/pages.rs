use lopdf::Document;
use crate::pdf::lopdf_adapter::LopdfAdapter;
use crate::pdf::transactions::atomic_file_tx::AtomicFileTransaction;

#[tauri::command]
pub async fn rotate_page_cmd(
    file_path: String,
    page_number: u32,
    angle: i32,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut doc = Document::load(&file_path).map_err(|e| e.to_string())?;
        LopdfAdapter::rotate_page(&mut doc, page_number, angle).map_err(|e| e.to_string())?;

        let mut bytes = Vec::new();
        doc.save_to(&mut bytes).map_err(|e| e.to_string())?;

        let mut tx = AtomicFileTransaction::begin(&file_path).map_err(|e| e.to_string())?;
        tx.write_and_commit(&bytes).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_page_cmd(
    file_path: String,
    page_number: u32,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut doc = Document::load(&file_path).map_err(|e| e.to_string())?;
        LopdfAdapter::delete_page(&mut doc, page_number).map_err(|e| e.to_string())?;

        let mut bytes = Vec::new();
        doc.save_to(&mut bytes).map_err(|e| e.to_string())?;

        let mut tx = AtomicFileTransaction::begin(&file_path).map_err(|e| e.to_string())?;
        tx.write_and_commit(&bytes).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn merge_pdfs_cmd(
    file_paths: Vec<String>,
    output_path: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut docs = Vec::new();
        for p in file_paths {
            let doc = Document::load(&p).map_err(|e| e.to_string())?;
            docs.push(doc);
        }

        let mut merged = LopdfAdapter::merge_documents(&docs).map_err(|e| e.to_string())?;
        let mut bytes = Vec::new();
        merged.save_to(&mut bytes).map_err(|e| e.to_string())?;

        let mut tx = AtomicFileTransaction::begin(&output_path).map_err(|e| e.to_string())?;
        tx.write_and_commit(&bytes).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

