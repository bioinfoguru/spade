#[allow(unused_imports)]
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use crate::models::error::PdfError;

pub struct AtomicFileTransaction {
    dest_path: PathBuf,
    temp_path: PathBuf,
    committed: bool,
}

impl AtomicFileTransaction {
    /// Begins an atomic file transaction on the same filesystem
    pub fn begin(dest_path: impl AsRef<Path>) -> Result<Self, PdfError> {
        let dest = dest_path.as_ref().to_path_buf();
        let parent_dir = dest.parent().unwrap_or_else(|| Path::new("."));

        // Generate temporary filename in the same directory
        let temp_filename = format!(
            ".{}.tmp-{}",
            dest.file_name().and_then(|f| f.to_str()).unwrap_or("doc"),
            uuid::Uuid::new_v4()
        );
        let temp_path = parent_dir.join(temp_filename);

        Ok(Self {
            dest_path: dest,
            temp_path,
            committed: false,
        })
    }

    /// Writes data, calls fsync, validates integrity, and performs atomic replacement
    pub fn write_and_commit(&mut self, data: &[u8]) -> Result<(), PdfError> {
        // 1. Structural pre-validation: verify bytes form a valid PDF
        lopdf::Document::load_mem(data).map_err(|e| {
            PdfError::AtomicSave(format!("Pre-save PDF validation failed: {}", e))
        })?;

        // 2. Write to temporary file in the same directory
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&self.temp_path)
            .map_err(|e| PdfError::Io(format!("Failed to create temporary file: {}", e)))?;

        file.write_all(data)
            .map_err(|e| PdfError::Io(format!("Failed to write temporary bytes: {}", e)))?;

        // 3. Physical durability: fsync
        file.sync_all()
            .map_err(|e| PdfError::Io(format!("Failed to fsync temporary file: {}", e)))?;
        drop(file);

        // 4. Atomic rename replacement
        #[cfg(windows)]
        {
            // On Windows, if destination exists, remove or replace atomically
            if self.dest_path.exists() {
                // Remove existing destination or replace
                let _ = std::fs::remove_file(&self.dest_path);
            }
            std::fs::rename(&self.temp_path, &self.dest_path).map_err(|e| {
                PdfError::AtomicSave(format!("Failed to atomic rename on Windows: {}", e))
            })?;
        }

        #[cfg(not(windows))]
        {
            std::fs::rename(&self.temp_path, &self.dest_path).map_err(|e| {
                PdfError::AtomicSave(format!("Failed to atomic rename: {}", e))
            })?;

            // Directory fsync on Unix
            if let Some(parent) = self.dest_path.parent() {
                if let Ok(dir_file) = File::open(parent) {
                    let _ = dir_file.sync_all();
                }
            }
        }

        self.committed = true;
        Ok(())
    }
}

impl Drop for AtomicFileTransaction {
    fn drop(&mut self) {
        if !self.committed && self.temp_path.exists() {
            let _ = std::fs::remove_file(&self.temp_path);
        }
    }
}
