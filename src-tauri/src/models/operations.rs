use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DocumentOperation {
    ReorderPages {
        from_index: usize,
        to_index: usize,
    },
    RotatePage {
        page_index: usize,
        angle_degrees: i32,
    },
    DeletePage {
        page_index: usize,
    },
    ApplyRedactions {
        page_index: usize,
        rects: Vec<[f32; 4]>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationResult {
    pub success: bool,
    pub new_page_count: usize,
    pub message: Option<String>,
}

