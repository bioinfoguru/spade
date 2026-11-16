/**
 * Appends one or more PDF files to an existing PDF document.
 * The base document is modified in place so its metadata/forms are preserved.
 */
export async function mergePdfBytes(
  baseBytes: Uint8Array,
  additionalFiles: readonly Uint8Array[]
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');

  if (additionalFiles.length === 0) {
    throw new Error('No PDF files to merge');
  }

  const merged = await PDFDocument.load(baseBytes);

  for (const bytes of additionalFiles) {
    const source = await PDFDocument.load(bytes);
    const pageIndices = source.getPageIndices();
    if (pageIndices.length === 0) continue;

    const copiedPages = await merged.copyPages(source, pageIndices);
    for (const page of copiedPages) {
      merged.addPage(page);
    }
  }

  return await merged.save();
}
