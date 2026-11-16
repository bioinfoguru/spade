# MASTER DEVELOPMENT PLAN: BUILD A PROFESSIONAL DESKTOP PDF EDITOR

Act as a senior software architect, senior Vue.js developer, Rust systems engineer, UI/UX designer, and desktop application developer.

Your task is to design and build a polished, production-oriented desktop PDF editor comparable in usability, responsiveness, and visual quality to Adobe Acrobat, PDFgear, and Foxit PDF Editor.

The application must run reliably on Windows, macOS, and Linux.

Do not build a basic PDF viewer or a prototype with decorative buttons. Build a fully functional desktop PDF editing application with a professional interface, a modular architecture, reliable document processing, and an industrial-grade foundation for future advanced features.

---

## 1. TECHNOLOGY STACK & UNIFIED CAPABILITY-BASED ENGINE ARCHITECTURE

### FRONTEND
- **Framework:** Vue 3 (Composition API with `<script setup>`, TypeScript)
- **Bundler:** Vite
- **State Management:** Pinia (modular stores for app, document state, viewer, capabilities, compatibility, operation history, fonts, settings)
- **Routing:** Vue Router (for Home / Editor / Settings navigation)
- **Styling:** Tailwind CSS
- **Components:** shadcn-vue (or Radix Vue primitives) styled to desktop standards
- **Icons:** Lucide Vue Next
- **PDF Viewing & Text Extraction:** PDF.js (`pdfjs-dist`) with dedicated web worker
- **Drag & Drop:** SortableJS / Vue Draggable Plus for page reordering and thumbnail management
- **Canvas / Drawing Engine:** HTML5 Canvas / SVG overlay for interactive annotations and transform gizmos

### DESKTOP RUNTIME (TAURI 2)
- **Core:** Tauri 2 (Rust backend with native windowing and system integration)
- **IPC Architecture:** Typed asynchronous commands, custom streaming asset protocols, and event emitters
- **System Integration:** Native file dialogs (`tauri-plugin-dialog`), secure filesystem operations (`tauri-plugin-fs`), native drag-and-drop, OS menu integration, and native clipboard
- **Memory Safety:** `zeroize` crate for zeroing sensitive password buffers in memory

---

### CAPABILITY-BASED RUST PDF ENGINE ABSTRACTION

PDFium, `lopdf`, and `pdf-writer` **do not share a common in-memory document representation**, and PDFium should not automatically be treated as the universal engine for every PDF modification. Available editing capabilities in Rust bindings must be evaluated feature-by-feature.

The backend introduces a **Capability-Based Unified Rust Engine Abstraction (`PdfEngine` trait)** with a dedicated **Engine Capability Registry**:

```rust
pub trait PdfEngine {
    fn inspect(&self) -> Result<PdfCapabilities, PdfError>;
    fn render_page(&self, page: u32) -> Result<RenderedPage, PdfError>;
    fn apply_operation(&self, operation: &DocumentOperation) -> Result<OperationResult, PdfError>;
    fn validate(&self) -> Result<ValidationReport, PdfError>;
}
```

#### Engine Responsibility Boundaries

| Engine / Library | Recommended Responsibility | Notes & Boundaries |
| :--- | :--- | :--- |
| **PDF.js** | Interactive frontend viewer | High-performance canvas rendering, text selection/search layer, native annotation/form viewing. |
| **PDFium (`pdfium-render` 0.9.5+)** | Native inspection, text extraction, forms, page objects, and rendering fallback | Deep document inspection, glyph/text extraction with exact bounding boxes, AcroForm interaction, page object manipulation, document concatenation, watermarking, and raster fallback. |
| **`lopdf`** | Low-level PDF structure and object manipulation | Low-level dictionary/stream editing, object repair, cross-reference table adjustments, and page tree modifications. Note: `lopdf` keeps all objects in memory, requiring deliberate memory benchmarking. |
| **`pdf-writer`** | Generating new PDF structures and standalone content | Generating new synthetic PDF streams, stamps, or standalone exported documents from scratch. Not an in-place existing-document modifier. |

- **Authoritative Baseline & Serialization Boundary:** The original source file remains immutable on disk. Edits are compiled to verified intermediate files; when another engine must inspect or render modified output, the resulting PDF is cleanly reopened.
- **IPC Data Transfer:** Custom Tauri asset protocol (`app.register_asynchronous_uri_scheme_protocol`) and range-chunk streaming. **Never transfer entire PDF files as Base64 strings across JSON IPC.**

---

### FONT MANAGEMENT & EMBEDDING SUBSYSTEM

Text insertion in PDF is only reliable if fonts are properly discovered, mapped, subsetted, and embedded. The application includes a dedicated Font Management subsystem:
- **Backend (`src-tauri/src/pdf/fonts/`):**
  - Cross-platform system font discovery (Windows DirectWrite / registry, macOS CoreText / FontBook, Linux Fontconfig).
  - TrueType/OpenType font parsing, glyph mapping, and font metrics calculation.
  - Font subsetting and embedding to minimize output file size while ensuring identical rendering across all devices.
  - Support for Unicode, complex scripts, Right-to-Left (RTL, e.g. Arabic/Hebrew), and CJK font fallbacks.
  - Font licensing validation (embedding permission flags in `OS/2` table).
- **Frontend (`src/services/fontManager.ts`):**
  - Font picker with system font family enumeration and live preview.
  - Missing-font notification when opening documents with unavailable font subsets.

---

## 2. PRODUCT DESIGN AND VISUAL DIRECTION

Create a sophisticated, modern, dark/light desktop application.

### Design Inspiration
- Adobe Acrobat & Foxit PDF Editor (document workspace, navigation, tools layout)
- Linear & Figma (clean typography, crisp micro-interactions, subtle borders, high information density without clutter)
- PDFgear (approachable toolbars and page manipulation)

### Design & Usability Requirements
- **Typography:** Crisp typography with native system font stack (Inter, SF Pro, Segoe UI).
- **Surfaces & Borders:** Subtle borders (`border-border/60`), muted surface layers, and controlled elevation shadows.
- **States:** Comprehensive hover, active, selected, focused, and disabled states across all tools.
- **Themes:** First-class Dark and Light theme support with seamless system theme detection.
- **Collapsible & Resizable Panels:** Left sidebar (navigation/thumbnails) and Right panel (contextual properties) with fluid resplit handles.
- **Accessibility:** Full keyboard navigability, focus rings, and screen-reader accessible tooltips.

---

## 3. APPLICATION LAYOUT, CAPABILITIES & COMPATIBILITY LAYER

The interface follows a focused, 5-region document workspace:

```
┌────────────────────────────────────────────────────────────────────────┐
│ A. Top Title Bar (Window controls, Document Title, Undo/Redo, Theme)   │
├────────────────────────────────────────────────────────────────────────┤
│ B. Main Action Toolbar (Dynamically enabled by Capability Registry)   │
├──────────────┬──────────────────────────────────────────┬──────────────┤
│              │                                          │              │
│ C. Left      │ D. Central Document Canvas               │ E. Right     │
│ Navigation   │    (4-Layer Stacked Virtualized Viewport)│ Contextual   │
│ Sidebar      │                                          │ Properties   │
│ (Thumbnails, │                                          │ Panel        │
│ Bookmarks,   │                                          │ (Typography, │
│ Outlines)    │                                          │ Colors, etc.)│
│              │                                          │              │
├──────────────┴──────────────────────────────────────────┴──────────────┤
│ Status Bar (Page indicator, Zoom slider, Fit controls, Save status)     │
└────────────────────────────────────────────────────────────────────────┘
```

### DEDICATED PDF COMPATIBILITY LAYER (`src-tauri/src/pdf/compatibility/`)
PDF documents contain diverse structures (Linearized / Fast Web View, Incremental updates, Object streams, XFA dynamic forms, Optional Content Groups / layers, Encrypted streams). A document may render fine in PDF.js but break when modified by structural engines.

The backend inspects every opened document and generates an authoritative **Compatibility Report**:

```typescript
export interface PdfCompatibilityReport {
  supported: string[];
  partiallySupported: string[];
  unsupported: string[];
  requiresSpecialHandling: string[];
  safeToModify: boolean;
  warnings: string[];
}
```

The frontend uses this report in tandem with `PdfCapabilities` to gate actions:

```typescript
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
  certificationLevel: "None" | "NoChangesAllowed" | "FormFillingAllowed" | "AnnotationsAllowed";
  isEncrypted: boolean;
  requiresPassword: boolean;
  requiresRasterFallback: boolean;
  unsupportedFeatures: string[];
}
```

---

### A. TOP TITLE BAR
- Application logo and name.
- Active document filename with dirty/saved indicator (`• Edited`).
- Global Undo / Redo controls with tooltips indicating action names.
- Document tab bar (supporting multiple concurrently open documents).
- Digital signature & certification badge (showing signature status and permitted modifications).
- Theme switcher (Dark / Light / System).
- Settings and Window controls (minimize, maximize, close) integrated seamlessly with Tauri window styling.

### B. MAIN ACTION TOOLBAR
A horizontal toolbar organized into logical toolsets:
- **File:** Open, Save, Save As, Export.
- **View:** Fit Width, Fit Page, Actual Size, Zoom In/Out, Rotate View.
- **Organize:** Reorder, Rotate, Delete, Extract, Insert, Split, Merge.
- **Annotate:** Highlight, Underline, Strikethrough, Sticky Note, Freehand Draw, Shapes (Rectangle, Circle, Arrow, Line).
- **Edit Content:** Add Text (with Font Picker), Add Image, Edit Text Box.
- **Redaction:** Mark for Redaction, Apply Redactions (with Verification Report).
- **Sign & Fill:** Draw Signature, Type Signature, Upload Signature, Form Fields Fill, Certificate Status.
- **Protect:** Password Protection (AES-256), Permission Restrictions, Document Sanitization.

### C. LEFT NAVIGATION SIDEBAR
A collapsible, resizable panel with tabs:
1. **Page Thumbnails:** Miniature previews with SortableJS reordering, multi-page selection, and context menus.
2. **Document Outline / TOC:** Interactive tree view of document bookmarks and headings.
3. **Bookmarks:** User-defined bookmarks for rapid navigation.
4. **Attachments:** List and export embedded PDF file attachments.
5. **Search Results:** Deep document search with page numbers and context snippets.

### D. CENTRAL DOCUMENT VIEWER (4-LAYER VIRTUALIZED VIEWPORT)
To avoid duplicating functionality already built into PDF.js while maintaining full editing control, each rendered page uses a **4-layer stacked coordinate system**:

```
┌────────────────────────────────────────────────────────┐
│ Layer 4: Custom Editor Overlay (Vue / SVG / Canvas)    │ ← New annotations, active text boxes, selection & transform handles
├────────────────────────────────────────────────────────┤
│ Layer 3: PDF.js Annotation & Form Layer (HTML DOM)     │ ← Existing PDF annotations, AcroForms, hyperlinks
├────────────────────────────────────────────────────────┤
│ Layer 2: PDF.js Text Layer (HTML DOM transparent spans)│ ← Native text selection, cursor, search hit highlights
├────────────────────────────────────────────────────────┤
│ Layer 1: PDF.js Canvas Layer (HTML5 <canvas>)          │ ← Base rasterized PDF page bitmap
└────────────────────────────────────────────────────────┘
```

#### Prevention of Double-Rendering
- **Existing vs. Active Annotations:** Existing PDF annotations are rendered cleanly by PDF.js in **Layer 3**.
- When an existing annotation is clicked or selected for modification, it is temporarily suppressed/hidden in Layer 3 and represented in **Layer 4** with live transform handles and styling controls.
- Brand-new annotations live in Layer 4 until committed and compiled on document save.

#### Correct Coordinate System & High-DPI Formula
Device Pixel Ratio (DPR) applies exclusively to the backing resolution of the HTML5 `<canvas>`, **never** to CSS layout coordinates:
$$\text{CSS}_{\text{px}} = \text{Viewport}(\text{PDF}_{\text{pt}}, \text{Zoom}, \text{Rotation}, \text{Offsets})$$
$$\text{Canvas}_{\text{px}} = \text{CSS}_{\text{px}} \times \text{DPR}$$

- **PDF Coordinate Space:** Points ($1\text{ pt} = \frac{1}{72}\text{ inch}$), origin $(0, 0)$ at bottom-left, Y ascending.
- **Web Coordinate Space:** CSS Pixels, origin $(0, 0)$ at top-left, Y descending.
- **Transform Normalization:** Accounts for page rotation ($0^\circ, 90^\circ, 180^\circ, 270^\circ$), `CropBox` vs. `MediaBox` offsets, and viewport margins.
- `coordinateConverter.ts` is one of the most thoroughly unit-tested modules in the application.

#### Viewport Virtualization & Memory Management
- **Sliding Virtualization Window:** Render canvas and text layers for visible pages plus 1 lookahead page before and after the viewport.
- **Placeholder Divs:** Off-screen pages are represented by lightweight placeholder `<div>` containers maintaining the exact aspect ratio and computed pixel height.
- **Task Cancellation:** Actively invoke `renderTask.cancel()` on running PDF.js rendering tasks when zooming or scrolling quickly.
- **Resource Disposal:** Fully release `<canvas>` contexts and revoke object URLs when pages leave the virtualization window.

### E. RIGHT CONTEXTUAL PROPERTIES PANEL
Dynamically adapts based on the active selection:
- **Text Selection / Box:** Font family, font size, fill color, weight (Bold/Italic), line spacing, alignment, opacity.
- **Shape / Annotation Selection:** Stroke color, fill color, stroke width, opacity, dash style, start/end arrowheads.
- **Image Selection:** Dimensions ($W \times H$), aspect ratio lock, rotation angle, opacity, replace image button.
- **Page Selection:** Page dimensions (Letter, A4, Custom), orientation, rotation angle, crop box data.

---

## 4. CORE PDF FEATURES

### FEATURE 1: HIGH-PERFORMANCE PDF VIEWING
- Instant opening of local PDF files via Tauri streaming protocol.
- Rendering modes: Single Page, Continuous Vertical Scrolling, Two-Page Spread.
- Zoom controls: Fit-to-Width, Fit-to-Page, Actual Size (100%), custom percentage (10% to 500%), and smooth `Ctrl/Cmd + Wheel` zoom.
- High-precision text selection and clipboard copying from the text layer.
- Real-time search with debounced indexing, count indicator (`Match X of Y`), and highlighted match rectangles.
- Resilient recovery and friendly error dialogs for damaged or non-standard PDFs.

### FEATURE 2: ORGANIZE PAGES
- Multi-page drag-and-drop reordering with live preview.
- Page rotation (90° Clockwise, 90° Counter-Clockwise, 180°).
- Delete selected page(s) with confirmation and undo support.
- Duplicate page(s).
- Extract selected page(s) into a new standalone PDF.
- Insert pages from blank templates or another existing PDF file.
- Merge multiple PDF documents in user-specified order.
- Split PDF by page ranges, fixed page count, or bookmarks.
- Automatically update and prune the PDF Outline (`/Outlines`) and named destinations when pages are reordered or removed.

### FEATURE 3: ANNOTATIONS & DRAWING
- Dedicated interactive overlay supporting:
  - Text highlights, underlines, squiggles, and strikethroughs linked to the text layer.
  - Sticky notes with author name, timestamp, and threaded comments.
  - Freehand drawing (pencil/pen) with customizable stroke width, smoothing, and color.
  - Vector shapes: Rectangle, Ellipse, Arrow, Line with editable vertex handles.
- Non-destructive client-side editing: edit, resize, change color, or delete annotations at any time.
- Standard-compliant persistence: Annotations are compiled into native PDF annotation dictionaries (`/Highlight`, `/Underline`, `/Ink`, `/Square`, `/Circle`, `/Line`, `/Text`) with appearance streams (`/AP`) so they are visible and editable in Adobe Acrobat, Apple Preview, and web browsers.

### FEATURE 4: TEXT INSERTION & FONT EMBEDDING
- Draggable, resizable rich text boxes with full typography styling.
- Complete system font picker with fallback resolution.
- Font subsetting and embedding in the generated PDF so text appears identically on all computers.
- Unicode support, CJK glyph fallbacks, and BiDi / RTL text handling.
- Graceful notification if a selected font prohibits embedding via licensing metadata.

### FEATURE 5: TRUE REDACTION & MULTI-VECTOR VERIFICATION
*A white rectangle over text is NOT redaction.* Nor is simple binary string searching sufficient verification, as text in PDFs can be split across operators, encoded via custom CMaps, or compressed in Flate streams.
True redaction is an independent, security-sensitive module that must:
1. **Mark for Redaction:** Allow user to visually mark text spans, rectangular areas, or search patterns with preview redaction boxes.
2. **Deep Content Removal:**
   - Permanently delete underlying glyphs and content stream operators (`Tj`, `TJ`).
   - Clip or burn raster pixels for intersecting images so no hidden image layers survive.
   - Remove intersecting vector graphics and paths.
3. **Metadata & OCR Scrubbing:** Strip matching text from the document text index, search cache, OCR layers, bookmarks, and metadata.
4. **Independent Multi-Vector Verification Engine:**
   - Run text extraction verification (equivalent to `pdftotext`).
   - Run embedded image extraction verification (equivalent to `pdfimages`).
   - Inspect PDF object streams for orphaned glyph runs or dangling XRef objects.
   - Run OCR inspection over rasterized regions to ensure no visual residual leaks.
   - Generate a signed **Redaction Verification Report** confirming zero extractable remnants before writing the final document.

### FEATURE 6: IMAGE EDITING
- Insert images from common formats (PNG, JPEG, WebP, SVG).
- Canvas transform gizmo: move, scale with aspect-ratio lock, rotate.
- Image controls: opacity, duplicate, bring forward / send backward, delete.
- Compile inserted images as standard PDF Form XObjects with appropriate color space (`/DeviceRGB`) and DCTDecode/FlateDecode streams.

### FEATURE 7: DIGITAL SIGNATURE & CERTIFICATION ARCHITECTURE
Modifying a signed PDF may invalidate its cryptographic signature. Rather than a naive warning, the editor introduces a complete signature inspection engine:
1. **Signature Detection & Verification:**
   - Detect digital signatures (`/Sig` fields / PAdES / PKCS#7).
   - Check cryptographic signature validity across byte ranges.
   - Inspect certificate chains and expiration status.
2. **Certification Policy Inspection (DocMDP):**
   - Check certification restriction levels:
     - `P = 1`: No changes permitted (any change invalidates signature).
     - `P = 2`: Form filling and subsequent signing permitted.
     - `P = 3`: Annotations, form filling, and signing permitted.
3. **Modification Impact Analysis:**
   - Explicitly inform the user whether an operation is permitted under the document's certification policy or if it will break existing signatures.
   - **Never promise signature preservation** when modifications invalidate cryptographic byte ranges.

### FEATURE 8: FORMS (AcroForms)
- Automatic detection of standard AcroForm interactive fields via PDF.js.
- Interactive support for:
  - Single-line and multi-line Text Fields.
  - Checkboxes.
  - Radio button groups.
  - Dropdown select and combo boxes.
- Fill form values interactively in the viewer.
- Save and serialize filled form values back into `/V` (Value) and generate `/AP` (Appearance Streams) via `pdfium-render` / Rust engine.
- Reset form action to revert to default values.

### FEATURE 9: DOCUMENT SECURITY & SANITIZATION
- **Modern Encryption:** Standard AES-256 encryption with User and Owner passwords and permission flags. (Do not implement obsolete RC4).
- **Memory Protection:** Use Rust's `zeroize` crate to securely scrub plaintext password buffers from memory immediately after use.
- **Permissions Handling:** Clearly inform the user that PDF permission flags are standard document restrictions, not absolute cryptographic boundaries.
- **JavaScript Isolation:** Disable untrusted embedded PDF JavaScript execution by default.
- **Resource Limits:** Enforce strict decompression ratios and object parsing limits to prevent zip-bomb or decompression-bomb denial of service.
- **Document Sanitization:** Dedicated tested operation to strip metadata, document history, private annotations, thumbnails, and hidden attachments.

---

## 5. ADDITIONAL UTILITIES & TOOLS

- **PDF Compression & Optimization:** Presets (High Quality, Standard, Small Size) utilizing stream re-compression (Flate), unused object purging, and image downsampling.
- **Watermarking:** Add text or image watermarks with custom rotation, opacity, position (Under/Over content), and page range targeting via PDFium.
- **Page Numbering / Header & Footer:** Insert dynamic page numbers (`Page X of Y`, Bates numbering) with customizable margins, font, and alignment.
- **Metadata Editor:** View and edit Document Title, Author, Subject, Keywords, Creator.
- **Export Formats:** Export pages as PNG, JPEG, or extract raw images embedded in the document.
- **OCR Engine Integration Interface:** Modular interface for Tesseract or native OS OCR to convert scanned image pages into searchable text.

---

## 6. APPLICATION HOME SCREEN

A clean, productive welcome hub when no document is active:
- **Recent Files List:** Recent document cards showing filename, path, last opened time, file size, page count, and cached thumbnail.
- **Quick Action Cards:** "Open PDF", "Merge PDFs", "Split PDF", "Compress PDF", "Images to PDF".
- **Drag-and-Drop Dropzone:** Full-window drop target to open PDF files immediately.
- **Recent Document Management:** Pin favorites, clear recent list, remove missing files.

---

## 7. THREE-TIER TRANSACTION ARCHITECTURE & PLATFORM-SPECIFIC DURABILITY

A file transaction, a PDF serialization transaction, and a logical editing transaction are distinct concerns. The architecture separates them into **Three Dedicated Transaction Tiers**:

```
┌────────────────────────────────────────────────────────┐
│ Tier 1: DocumentTransaction (Frontend / Pinia)         │
│         Manages logical editing operations in memory   │
├────────────────────────────────────────────────────────┤
│ Tier 2: PdfWriteTransaction (Rust Engine)              │
│         Compiles AST delta into verified PDF bytes     │
├────────────────────────────────────────────────────────┤
│ Tier 3: AtomicFileTransaction (OS Filesystem Service)  │
│         Durable, crash-safe atomic disk replacement    │
└────────────────────────────────────────────────────────┘
```

### Tier 1: Logical `DocumentTransaction`
- Batches multiple user edits (e.g., drag-moving multiple annotations or bulk page operations) into a single atomic undo/redo unit.
- Guarantees that in-memory state never remains partially applied.

### Tier 2: Rust `PdfWriteTransaction`
- Validates the intermediate PDF structure before any filesystem operations occur.
- Compiles object dictionaries, writes cross-reference tables, and validates xref offsets.
- If serialization fails, rolls back memory state cleanly and leaves the source file untouched.

### Tier 3: `AtomicFileTransaction` & Platform Durability
*Atomic replacement guarantees are platform-dependent and must not be described as unconditional until verified on each OS:*
- **Windows Implementation:**
  - Create `.tmp` file in the same directory/volume.
  - Flush buffers and call `FlushFileBuffers` (`fsync`).
  - Perform atomic replacement via `ReplaceFileW` / `MoveFileExW` with `MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH`.
- **macOS / Linux Implementation:**
  - Create `.tmp` file on the same mount point.
  - Call `fsync()` on file descriptor.
  - Perform atomic replacement via `rename()`.
  - Call `fsync()` on the parent directory file descriptor to guarantee directory entry persistence.
- **External Modification Watcher:** Actively watch open document files; if an external application alters the file, notify the user and block accidental overwriting.

---

## 8. STATE ARCHITECTURE: DISCRIMINATED OPERATIONS & DOCUMENT MODEL

The application structures document state into **Three Strict Layers**:
1. **Immutable Baseline:** The original source PDF file.
2. **Materialized Document State:** In-memory Pinia store reflecting current page order, active annotations, inserted elements, and form data.
3. **Serializable Operation Log:** Strictly typed, discriminated union records.

### Strictly Typed Discriminated Operations
```typescript
export type DocumentOperation =
  | { id: string; type: "add_annotation"; documentId: string; documentRevision: number; payload: AddAnnotationPayload; inversePayload: DeleteAnnotationPayload; timestamp: number }
  | { id: string; type: "delete_annotation"; documentId: string; documentRevision: number; payload: DeleteAnnotationPayload; inversePayload: AddAnnotationPayload; timestamp: number }
  | { id: string; type: "insert_object"; documentId: string; documentRevision: number; payload: InsertObjectPayload; inversePayload: DeleteObjectPayload; timestamp: number }
  | { id: string; type: "transform_object"; documentId: string; documentRevision: number; payload: TransformObjectPayload; inversePayload: TransformObjectPayload; timestamp: number }
  | { id: string; type: "reorder_pages"; documentId: string; documentRevision: number; payload: ReorderPagesPayload; inversePayload: ReorderPagesPayload; timestamp: number }
  | { id: string; type: "rotate_page"; documentId: string; documentRevision: number; payload: RotatePagePayload; inversePayload: RotatePagePayload; timestamp: number }
  | { id: string; type: "delete_page"; documentId: string; documentRevision: number; payload: DeletePagePayload; inversePayload: RestorePagePayload; timestamp: number }
  | { id: string; type: "update_form_value"; documentId: string; documentRevision: number; payload: UpdateFormPayload; inversePayload: UpdateFormPayload; timestamp: number }
  | { id: string; type: "mark_redaction"; documentId: string; documentRevision: number; payload: MarkRedactionPayload; inversePayload: UnmarkRedactionPayload; timestamp: number }
  | { id: string; type: "apply_redactions"; documentId: string; documentRevision: number; payload: ApplyRedactionsPayload; timestamp: number };
```

### State Recovery & Reliability
- **Document Revision Number:** Every committed operation increments `documentRevision`.
- **Checkpoint Snapshots:** Save a lightweight JSON state snapshot to disk every 10 operations or 30 seconds.
- **Zero-Latency Undo/Redo:** Applying `inversePayload` updates the in-memory Materialized State immediately without disk I/O.

---

## 9. UNDO AND REDO COMMAND DISPATCHER

The frontend maintains an executable `CommandDispatcher` that consumes `DocumentOperation` records:
- Executable commands update the Materialized State in Pinia.
- The corresponding `DocumentOperation` is pushed onto the undo stack.
- Redo pops from the redo stack and reapplies the operation.
- Maximum history depth: 50 operations.
- Operations store lightweight geometry and property deltas, never duplicating full PDF buffers.

---

## 10. KEYBOARD SHORTCUTS MATRIX

| Shortcut (Win / Linux) | Shortcut (macOS) | Action |
| :--- | :--- | :--- |
| `Ctrl + O` | `Cmd + O` | Open PDF File |
| `Ctrl + S` | `Cmd + S` | Save Document |
| `Ctrl + Shift + S` | `Cmd + Shift + S` | Save As... |
| `Ctrl + W` | `Cmd + W` | Close Active Document Tab |
| `Ctrl + Z` | `Cmd + Z` | Undo |
| `Ctrl + Shift + Z` / `Ctrl + Y` | `Cmd + Shift + Z` | Redo |
| `Ctrl + F` | `Cmd + F` | Open In-Document Search |
| `Ctrl + P` | `Cmd + P` | Print Document |
| `Ctrl + +` / `Ctrl + =` | `Cmd + +` | Zoom In |
| `Ctrl + -` | `Cmd + -` | Zoom Out |
| `Ctrl + 0` | `Cmd + 0` | Fit to Page |
| `Ctrl + 1` | `Cmd + 1` | Actual Size (100%) |
| `Escape` | `Escape` | Cancel current tool / Deselect object |
| `Delete` / `Backspace` | `Delete` / `Backspace` | Delete selected annotation, shape, or page |
| `Arrow Keys` | `Arrow Keys` | Nudge selected object by 1pt (`Shift` + Arrow for 10pt) |

---

## 11. MEASURED PERFORMANCE BENCHMARKS & HARDWARE TARGETS

Performance targets must be treated as **engineering benchmarks to measure against standardized test suites**, rather than unconditional blanket claims:

| Benchmark Test Scenario | Metric Goal | Hardware Target |
| :--- | :--- | :--- |
| **Standard Text Document (100 pages, text/vector)** | Cold start < 1.5s; 60 FPS scrolling; Memory < 250MB | Modern Quad-Core CPU, 8GB RAM |
| **Complex Multi-Page Document (500 pages, text/vector)** | 60 FPS scrolling with virtualization; Memory < 400MB | Modern Quad-Core CPU, 8GB RAM |
| **Heavy Graphic/Scanned Document (100 pages, 300 DPI images)** | Viewport render < 150ms; Memory bounded < 600MB | Modern Quad-Core CPU, 8GB RAM |
| **Idle Memory Consumption** | Baseline application idle < 180MB | Any platform |
| **Fast Zoom / Scroll Thrash** | Active render task cancellation; zero UI thread freezing | Any platform |

---

## 12. RUST BACKEND ARCHITECTURE

Organize the `src-tauri` workspace following modern Tauri 2 best practices:

```
src-tauri/
├── Cargo.toml
├── capabilities/
│   └── default.json               # Tauri 2 security permissions & capabilities
├── src/
│   ├── main.rs                    # Thin binary entrypoint calling app_lib::run()
│   ├── lib.rs                     # Tauri builder, plugin registrations, protocol setup
│   ├── commands/                  # IPC Command Handlers
│   │   ├── mod.rs
│   │   ├── document.rs            # open_document, save_document, get_capabilities, get_compatibility
│   │   ├── pages.rs               # reorder_pages, rotate_pages, delete_pages, extract_pages
│   │   ├── annotations.rs         # sync_annotations, flatten_annotations
│   │   ├── content.rs             # insert_image, insert_text_box
│   │   ├── redaction.rs           # apply_true_redaction, verify_redaction
│   │   ├── forms.rs               # export_form_data, apply_form_values
│   │   ├── signatures.rs          # inspect_signatures, check_certification_policy
│   │   ├── security.rs            # verify_password, set_encryption, sanitize
│   │   └── tools.rs               # merge_pdfs, split_pdf, compress_pdf
│   ├── pdf/                       # Core PDF Processing Engines
│   │   ├── mod.rs                 # Unified PdfEngine Trait definition
│   │   ├── engine_facade.rs       # Single entrypoint routing tasks to optimal crate
│   │   ├── compatibility/         # Dedicated PDF Compatibility & Detection Subsystem
│   │   │   ├── mod.rs
│   │   │   ├── feature_detector.rs      # Linearized, XFA, OCG, Object Streams detector
│   │   │   ├── unsupported_features.rs  # Known limitations mapper
│   │   │   ├── document_repair.rs       # Xref table & structural repair
│   │   │   ├── structure_validator.rs   # ISO 32000 structural syntax checker
│   │   │   └── compatibility_report.rs  # Compatibility report generator
│   │   ├── transactions/          # Transaction Management
│   │   │   ├── mod.rs
│   │   │   ├── pdf_writer_tx.rs   # Tier 2: Serialization & validation transaction
│   │   │   └── atomic_file_tx.rs  # Tier 3: OS-specific atomic replace & fsync
│   │   ├── signatures/            # Digital Signatures & Certification
│   │   │   ├── mod.rs
│   │   │   ├── detector.rs        # /Sig & ByteRange analyzer
│   │   │   └── doc_mdp.rs         # DocMDP certification permission evaluator
│   │   ├── redaction/             # True Redaction & Verification
│   │   │   ├── mod.rs
│   │   │   ├── redactor.rs        # Glyph, path, and raster pixel scrub engine
│   │   │   └── verifier.rs        # Independent multi-vector verification engine
│   │   ├── pdfium_engine.rs       # High-fidelity inspection, text extraction, forms
│   │   ├── lopdf_adapter.rs       # Low-level structural tree & cross-reference edits
│   │   ├── writer_generator.rs    # Synthetic PDF generation via pdf-writer
│   │   ├── optimizer.rs           # PDF stream compression and cleanup
│   │   └── fonts/                 # Font Management Subsystem
│   │       ├── mod.rs
│   │       ├── discovery.rs       # System font discovery (Win/Mac/Linux)
│   │       ├── subsetter.rs       # OpenType/TrueType glyph subsetting & embedding
│   │       └── bidi.rs            # BiDi and complex script resolution
│   ├── services/
│   │   ├── mod.rs
│   │   ├── streaming_protocol.rs  # Custom asset streaming protocol handler
│   │   ├── watcher.rs             # External file modification watcher
│   │   └── security_guard.rs      # Resource decompression limits & zeroize memory
│   └── models/
│       ├── mod.rs
│       ├── operations.rs          # Discriminated DocumentOperation structs (Serde)
│       ├── capabilities.rs        # PdfCapabilities struct
│       ├── compatibility.rs       # PdfCompatibilityReport struct
│       ├── signatures.rs          # SignatureInfo & DocMdpPolicy structs
│       ├── redaction.rs           # RedactionVerificationReport struct
│       ├── state.rs               # Materialized document state models
│       ├── annotation.rs
│       └── error.rs               # Strongly-typed Rust error enum with Serde
```

---

## 13. VUE FRONTEND ARCHITECTURE

```
src/
├── assets/                        # CSS, fonts, SVG icons
│   └── main.css                   # Tailwind configuration and theme variables
├── components/
│   ├── layout/
│   │   ├── AppHeader.vue          # Top Title Bar, Window controls, Tab bar, Signature badge
│   │   ├── MainToolbar.vue        # Segmented action toolbar (bound to capabilities)
│   │   ├── LeftSidebar.vue        # Navigation sidebar container
│   │   ├── RightSidebar.vue       # Contextual properties inspector
│   │   └── StatusBar.vue          # Zoom slider, page indicator, status text
│   ├── viewer/
│   │   ├── PdfViewer.vue          # Virtualized page container & scroll controller
│   │   ├── PdfPage.vue            # Individual page container (manages 4 layers)
│   │   ├── PageCanvasLayer.vue    # Layer 1: PDF.js rendered canvas
│   │   ├── PageTextLayer.vue      # Layer 2: Transparent text selection layer
│   │   ├── PageFormLayer.vue      # Layer 3: AcroForm interactive layer
│   │   ├── PageEditorOverlay.vue  # Layer 4: SVG/Canvas interactive annotation layer
│   │   └── SearchOverlay.vue      # Visual search match rectangles
│   ├── thumbnails/
│   │   ├── ThumbnailPanel.vue     # Sortable thumbnail list
│   │   └── ThumbnailItem.vue      # Lazy-rendered thumbnail card with badge
│   ├── tools/
│   │   ├── AnnotationToolbar.vue  # Drawing and shape selection
│   │   ├── RedactionToolbar.vue   # Redaction marking & execute controls
│   │   ├── TextEditToolbar.vue    # Typography, font picker, alignment
│   │   ├── FontPicker.vue         # System font family selector with previews
│   │   └── SignatureModal.vue     # Signature creation modal (Draw/Type/Upload)
│   ├── properties/
│   │   ├── TextProperties.vue
│   │   ├── ShapeProperties.vue
│   │   ├── ImageProperties.vue
│   │   └── PageProperties.vue
│   └── dialogs/
│       ├── PasswordDialog.vue     # Password prompt for encrypted documents
│       ├── SignatureWarning.vue   # Warning & DocMDP impact dialog for signed docs
│       ├── CompatibilityModal.vue # Explanatory dialog for partially-supported PDFs
│       ├── RedactionReportModal.vue # Verification report modal before final redaction save
│       ├── MergeDialog.vue        # Multi-file reorderable merge tool
│       ├── SplitDialog.vue        # Range-based split tool
│       └── CompressDialog.vue     # Compression presets and estimate modal
├── composables/
│   ├── usePdfDocument.ts          # Document loading & PDF.js lifecycle
│   ├── useVirtualScroll.ts        # Virtualization viewport calculation
│   ├── useAnnotationOverlay.ts    # Mouse/touch interaction for shapes & drawing
│   ├── useTransformGizmo.ts       # Drag, resize, rotate handles logic
│   ├── useKeyboardShortcuts.ts    # Global shortcut dispatcher
│   └── useOperations.ts           # Operation log and history dispatcher
├── stores/
│   ├── appStore.ts                # Theme, active tab, global UI state
│   ├── documentStore.ts           # Open documents list, active doc metadata
│   ├── capabilityStore.ts         # Reactive PdfCapabilities for tool gating
│   ├── compatibilityStore.ts      # Reactive PdfCompatibilityReport
│   ├── operationStore.ts          # Materialized document state & operation log
│   ├── viewerStore.ts             # Zoom, fit mode, scroll position, search query
│   └── historyStore.ts            # Undo / Redo stacks
├── services/
│   ├── tauriIpc.ts                # Typed wrappers around invoke()
│   ├── pdfWorker.ts               # Web worker setup for PDF.js
│   ├── fontManager.ts             # Frontend system font resolver
│   └── coordinateConverter.ts     # Rigorously-tested Screen <-> PDF User Space math
├── types/
│   ├── pdf.ts                     # TypeScript interfaces matching Rust models
│   ├── capabilities.ts            # PdfCapabilities interface
│   ├── compatibility.ts           # PdfCompatibilityReport interface
│   └── operations.ts              # Discriminated DocumentOperation union types
└── views/
    ├── HomeView.vue               # Welcome screen & recent documents
    └── EditorView.vue             # Main PDF editing workspace
```

---

## 14. ERROR HANDLING & SECURITY SAFEGUARDS

- **Password Memory Scrubbing:** Passwords collected via frontend inputs are zeroed immediately in Rust memory using `zeroize`.
- **Resource & Decompression Limits:** Enforce maximum object depths, stream decompression multipliers, and memory allocations in Rust to avoid zip-bomb DoS attacks.
- **JavaScript Isolation:** PDF JavaScript execution is strictly disabled by default.
- **Fail-Safe Atomic Saves:** Write all modifications to temporary files (`.tmp`), verify checksum and file headers, then perform an atomic rename.
- **Corrupted Document Recovery:** Detect broken xref tables and leverage PDFium's repair loader where possible; present clear diagnostic feedback to the user.

---

## 15. DEDICATED PDF COMPATIBILITY CAPABILITY MATRIX & VERIFICATION

A PDF that looks correct inside the application is not necessarily a valid, standard-compliant PDF. Each editing operation must be verified independently across the five major PDF engines:

| Feature / Operation | Required Verification Method | Target Engines |
| :--- | :--- | :--- |
| **Page Reordering & Split/Merge** | Verify page content order, page counts, named destinations, and outline/bookmark pointers without dangling references. | Adobe Acrobat, Foxit, Chrome, Preview, Firefox |
| **Annotations (`/Annots`)** | Verify appearance streams (`/AP`), popup comment text, stroke color/widths, and external editability. | Adobe Acrobat, Apple Preview, Foxit |
| **Text Insertion & Fonts** | Verify glyph subsets, OpenType/TrueType embedding, Unicode mapping, and rendering without system font dependencies. | Adobe Acrobat, Chrome, Firefox, Preview |
| **Image Insertion** | Verify alpha transparency, color space (`/DeviceRGB`), downsampling quality, and Form XObject integrity. | Adobe Acrobat, Chrome, Preview |
| **Form Filling (AcroForms)** | Verify field values (`/V`) and updated appearance streams (`/AP`); fields remain editable in external viewers. | Adobe Acrobat, Foxit, Chrome |
| **True Redactions** | Verified via independent multi-vector verification engine (text extraction, image extraction, OCR sweep) with signed `RedactionVerificationReport`. | CLI Audit, Adobe Acrobat, Foxit |
| **Document Encryption** | Verify standard AES-256 prompt and permission flag enforcement across all external readers. | Adobe Acrobat, Foxit, Chrome, Preview |
| **Digital Signature Warning** | Verify DocMDP certification permission evaluation and warning dialogs. | Internal Test Suite |

---

## 16. REORDERED PHASED DEVELOPMENT WORKFLOW

The roadmap establishes **save-and-reopen pipeline integrity, compatibility detection, and document persistence first** before building complex visual editing tools:

### PHASE 1: DESKTOP FOUNDATION & APPLICATION SHELL
- Set up Vue 3, Vite, TypeScript, Tailwind CSS, shadcn-vue, and Tauri 2.
- Configure Tauri capabilities, native windowing, file dialogs, and native drag-and-drop.
- Build the core application shell with dark/light theme switching.
- Implement the custom streaming binary protocol (`pdf-stream://`) for zero-copy file loading.
- Initialize PDF.js with its dedicated web worker.

### PHASE 2: 4-LAYER PDF VIEWING ENGINE & COORDINATES
- Build `PdfViewer.vue` with dynamic viewport virtualization (sliding window + aspect-ratio placeholders).
- Implement the 4-layer page stack: Canvas Layer, Text Layer, Form Layer, and Editor Overlay.
- Prevent double-rendering by properly managing existing vs. actively edited annotations.
- Implement and unit-test `coordinateConverter.ts` accounting for High-DPI DPR separation, page rotations, and MediaBox/CropBox offsets.
- Verify smooth 60 FPS scrolling on a standardized 100-page test PDF.

### PHASE 3: COMPATIBILITY LAYER, TRANSACTIONS & PERSISTENCE PIPELINE
- Implement the dedicated PDF Compatibility Layer (`src-tauri/src/pdf/compatibility/`) to detect linearized files, XFA forms, object streams, and produce `PdfCompatibilityReport`.
- Implement the 3-Tier Transaction Architecture (`DocumentTransaction`, `PdfWriteTransaction`, `AtomicFileTransaction` with platform-specific `fsync` and replace semantics).
- Implement structural page operations using `lopdf`: `reorder_pages`, `rotate_pages`, `delete_pages`, `duplicate_pages`.
- Build the **Save, Reopen, and Validation loop**: verify that saved documents immediately reopen cleanly in PDF.js and PDFium without syntax errors.

### PHASE 4: EDITING STATE, OPERATION LOG & HISTORY
- Build the Materialized Document State and discriminated `DocumentOperation` serializable log in Pinia.
- Implement the `PdfCapabilities` inspector in Rust and reactive `capabilityStore.ts` in Vue to gate tools.
- Implement digital signature detection and DocMDP certification permission evaluation.
- Implement zero-latency client-side Undo/Redo command dispatcher.
- Implement automatic checkpoint snapshots and crash recovery validation.

### PHASE 5: CORE EDITING TOOLS & FONT SUBSYSTEM
- Implement the Font Management Subsystem (`src-tauri/src/pdf/fonts/` and `fontManager.ts`): system font discovery, OpenType parsing, and font subset embedding.
- Build `PageEditorOverlay.vue` with vector drawing capabilities:
  - Text highlights, underlines, and strikethroughs tied to the text layer.
  - Sticky notes with comment threads.
  - Freehand pencil/pen tool with smooth curves.
  - Geometric shapes (Rectangle, Circle, Line, Arrow) with transform handles.
- Implement rich text box insertion with system font selection and embedding.
- Implement image insertion, transform gizmo, and Form XObject generation.
- Build Signature Tool: Draw, Type, and Upload image signatures with local preset caching.
- Implement AcroForm interactivity: fill text fields, checkboxes, radios, dropdowns, and serialize `/V` values and appearance streams on save via PDFium.

### PHASE 6: ADVANCED DOCUMENT OPERATIONS & TRUE REDACTION
- Implement True Redaction: visual marking, glyph stripping, raster image clipping, and metadata scrubbing.
- Implement the Multi-Vector Redaction Verification Engine and `RedactionVerificationReport`.
- Implement modern AES-256 password protection and permission flags with `zeroize` memory scrubbing.
- Implement PDF compression presets with estimated vs. actual file size display.
- Implement Watermarking (via PDFium) and dynamic page numbering.
- Implement Metadata viewing, editing, and one-click sanitization.
- Implement OCR engine integration interface.

### PHASE 7: COMPATIBILITY, RELEASE & PACKAGING
- Run the dedicated PDF Compatibility & Interoperability Test Suite across Adobe Acrobat, Foxit, Chrome, Firefox, and Preview.
- Audit performance against the hardware benchmark scenarios (text-heavy vs scanned PDFs).
- Refine UI micro-interactions, tooltips, dialog transitions, and focus rings.
- Memory leak profiling: ensure Webview canvas contexts and Rust buffers are cleanly reclaimed.
- Package native installers (.msi / .exe for Windows, .dmg for macOS, .AppImage / .deb for Linux) via Tauri 2.

---

## 17. IMPORTANT DEVELOPMENT RULES

1. **Capability-Based Delegation:** Never assume an engine can perform an arbitrary PDF edit without verifying against the Engine Capability Registry.
2. **Compatibility Pre-Check:** Always inspect documents using the Compatibility Layer before allowing structural modifications.
3. **Transaction Integrity:** Never write directly to the open file. Every modification must pass through the 3-Tier Transaction Architecture (`DocumentTransaction` $\rightarrow$ `PdfWriteTransaction` $\rightarrow$ `AtomicFileTransaction`).
4. **Certification Policy Respect:** Check DocMDP permission levels before allowing modifications on digitally signed documents; inform users when changes will invalidate existing signatures.
5. **Verified Redaction:** Never claim redaction succeeded without generating a verified `RedactionVerificationReport` proving zero extractable remnants across text, raster, and OCR vectors.
6. **Font Embedding Mandatory:** Never insert text without embedding font glyph subsets or verifying standard base-14 font compliance.
7. **Standards Compliance:** Every saved PDF must open without errors or repair warnings in Adobe Acrobat Reader and Apple Preview.

---

## 18. FINAL EXPECTED RESULT

A commercial-grade, responsive desktop PDF editor delivering:
- A clean, modern UI on par with Figma and Linear.
- Smooth, responsive scrolling across complex documents via virtualized canvas recycling.
- Intuitive drag-and-drop page organization.
- Standard-compliant PDF annotations compatible with Adobe Acrobat and Preview.
- True cryptographic and content redaction with multi-vector verification reports.
- Rich text box insertion with full system font discovery and subset embedding.
- Digital signature awareness and DocMDP certification policy compliance.
- Reliable AcroForm filling and saving.
- Real-time client-side Undo/Redo backed by a discriminated Document Operation Model.
- Rock-solid persistence via a 3-Tier Transaction System with platform-verified atomic durability.
- Full interoperability verified across Adobe Acrobat, Chrome, Firefox, Foxit, and Apple Preview.
