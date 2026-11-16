pub mod compatibility;
pub mod lopdf_adapter;
pub mod transactions;

use crate::models::capabilities::{PdfCapabilities, PdfCompatibilityReport};
use crate::models::error::PdfError;
use crate::models::operations::{DocumentOperation, OperationResult};

pub trait PdfEngine: Send + Sync {
    fn inspect(&self) -> Result<(PdfCapabilities, PdfCompatibilityReport), PdfError>;
    fn apply_operation(&mut self, operation: &DocumentOperation) -> Result<OperationResult, PdfError>;
    fn validate(&self) -> Result<bool, PdfError>;
}
