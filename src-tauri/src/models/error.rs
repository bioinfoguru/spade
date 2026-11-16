use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize)]
pub enum PdfError {
    #[error("I/O error: {0}")]
    Io(String),

    #[error("PDF parsing error: {0}")]
    Parse(String),

    #[error("Invalid page index: {0}")]
    InvalidPageIndex(u32),

    #[error("Document is password protected")]
    PasswordProtected,

    #[error("Incorrect password supplied")]
    IncorrectPassword,

    #[error("Transaction failed: {0}")]
    Transaction(String),

    #[error("Atomic save failed: {0}")]
    AtomicSave(String),

    #[error("Operation unsupported for this PDF: {0}")]
    Unsupported(String),
}

impl From<std::io::Error> for PdfError {
    fn from(err: std::io::Error) -> Self {
        PdfError::Io(err.to_string())
    }
}

impl From<lopdf::Error> for PdfError {
    fn from(err: lopdf::Error) -> Self {
        PdfError::Parse(err.to_string())
    }
}
