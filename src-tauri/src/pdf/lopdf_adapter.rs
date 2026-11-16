use lopdf::{Document, Object};
use crate::models::error::PdfError;

pub struct LopdfAdapter;

impl LopdfAdapter {
    /// Rotates a specific page by angle_degrees (90, 180, 270)
    pub fn rotate_page(doc: &mut Document, page_number: u32, angle_degrees: i32) -> Result<(), PdfError> {
        let pages = doc.get_pages();
        let page_id = pages.get(&page_number).ok_or(PdfError::InvalidPageIndex(page_number))?;

        let page_obj = doc.get_object_mut(*page_id).map_err(|e| PdfError::Parse(e.to_string()))?;
        let page_dict = page_obj.as_dict_mut().map_err(|e| PdfError::Parse(e.to_string()))?;

        let current_rot = page_dict
            .get(b"Rotate")
            .and_then(Object::as_i64)
            .unwrap_or(0);

        let new_rot = ((current_rot + angle_degrees as i64) % 360 + 360) % 360;
        page_dict.set("Rotate", Object::Integer(new_rot));

        Ok(())
    }

    /// Deletes a specific page number
    pub fn delete_page(doc: &mut Document, page_number: u32) -> Result<(), PdfError> {
        let pages = doc.get_pages();
        if pages.len() <= 1 {
            return Err(PdfError::Unsupported("Cannot delete the only page in document".into()));
        }

        doc.delete_pages(&[page_number]);
        doc.prune_objects();
        Ok(())
    }

    /// Reorders pages in the PDF document page tree
    pub fn reorder_pages(doc: &mut Document, from_index: usize, to_index: usize) -> Result<(), PdfError> {
        let pages = doc.get_pages();
        let total_pages = pages.len();

        if from_index >= total_pages || to_index >= total_pages {
            return Err(PdfError::InvalidPageIndex((from_index + 1) as u32));
        }

        let mut page_order: Vec<u32> = (1..=total_pages as u32).collect();
        let moved = page_order.remove(from_index);
        page_order.insert(to_index, moved);

        // Reconstruct pages in new order
        let mut new_doc = Document::with_version(&doc.version);
        for page_num in page_order {
            if let Some(page_id) = pages.get(&page_num) {
                if let Ok(page_obj) = doc.get_object(*page_id) {
                    new_doc.objects.insert(*page_id, page_obj.clone());
                }
            }
        }

        Ok(())
    }

    /// Merges multiple PDF documents into a single output document
    pub fn merge_documents(docs: &[Document]) -> Result<Document, PdfError> {
        if docs.is_empty() {
            return Err(PdfError::Unsupported("No documents provided to merge".into()));
        }

        let mut merged = docs[0].clone();
        for doc in &docs[1..] {
            let max_id = merged.max_id;
            let mut cloned = doc.clone();
            cloned.renumber_objects_with(max_id);

            for (id, object) in cloned.objects {
                merged.objects.insert(id, object);
            }
        }

        Ok(merged)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::content::Content;
    use lopdf::{dictionary, Stream};

    fn create_test_pdf() -> Document {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let font_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica",
        });
        let resources_id = doc.add_object(dictionary! {
            "Font" => dictionary! {
                "F1" => font_id,
            },
        });
        let content = Content { operations: vec![] };
        let content_id = doc.add_object(Stream::new(dictionary! {}, content.encode().unwrap()));
        let page_id = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "Contents" => content_id,
        });
        let pages_dict = dictionary! {
            "Type" => "Pages",
            "Kids" => vec![page_id.into()],
            "Count" => 1,
            "Resources" => resources_id,
            "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
        };
        doc.objects.insert(pages_id, Object::Dictionary(pages_dict));
        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        doc.trailer.set("Root", catalog_id);
        doc
    }

    #[test]
    fn test_rotate_page() {
        let mut doc = create_test_pdf();
        LopdfAdapter::rotate_page(&mut doc, 1, 90).unwrap();
        let pages = doc.get_pages();
        let page_obj = doc.get_object(*pages.get(&1).unwrap()).unwrap();
        let rot = page_obj.as_dict().unwrap().get(b"Rotate").unwrap().as_i64().unwrap();
        assert_eq!(rot, 90);
    }
}
