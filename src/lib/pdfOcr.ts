import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/**
 * Turns a PDF into plain text for the request/return-form parsers in
 * pdfExtraction.ts. Two paths:
 *
 *  1. Text layer (fast, no dependency load beyond pdfjs). Works for anything
 *     typed/fillable — most digital forms.
 *  2. OCR fallback (slow, loads tesseract.js on demand). Kicks in only when a
 *     page has NO embedded text at all — i.e. it's a scanned or photographed
 *     form, which is common for these hand-filled key agreements. OCR on
 *     handwriting is inherently unreliable (cursive names, handwritten key
 *     stamps); the caller's review-before-apply step is what actually catches
 *     mistakes, not this function.
 *
 * Both pdfjs-dist and tesseract.js are dynamically imported so neither weighs
 * down the main bundle — same reasoning as the lazy ExcelJS load.
 */

let pdfjsModule: typeof import("pdfjs-dist") | null = null;
async function loadPdfjs() {
  if (!pdfjsModule) {
    pdfjsModule = await import("pdfjs-dist");
    pdfjsModule.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  }
  return pdfjsModule;
}

let tesseractModule: typeof import("tesseract.js") | null = null;
async function loadTesseract() {
  if (!tesseractModule) tesseractModule = await import("tesseract.js");
  return tesseractModule;
}

export type PdfProgress = { page: number; totalPages: number; status: string };

/**
 * @param onProgress called only while OCR is running (the text-layer path is
 *   fast enough not to need it).
 */
export async function extractTextFromPdf(
  file: File,
  onProgress?: (p: PdfProgress) => void,
): Promise<{ text: string; usedOcr: boolean }> {
  const pdfjsLib = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  // wasmUrl points at pdfjs's image codecs (jbig2.wasm, openjpeg.wasm, ...),
  // needed to decode scanned pages — pdfjs defaults to a bare "wasm" relative
  // path that doesn't resolve here, so these are copied into public/ and
  // served at a stable, unhashed URL (see public/pdfjs-wasm/).
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, wasmUrl: "/pdfjs-wasm/" }).promise;

  // Pass 1: pull the real text layer, page by page.
  const pageTexts: string[] = [];
  let totalItems = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    totalItems += content.items.length;
    pageTexts.push(
      content.items.map((item: any) => (item?.str ?? "").trim()).filter(Boolean).join("\n"),
    );
  }

  // A typed/fillable PDF has real text items; a scan or photo has none. Some
  // scanners embed a stray item or two (e.g. a page-number stamp), so this
  // treats "basically empty" the same as "empty" rather than requiring exactly 0.
  if (totalItems > 3) {
    return { text: pageTexts.join("\n\n"), usedOcr: false };
  }

  // Pass 2: OCR fallback. Render each page to a canvas and read it with
  // tesseract.js, reusing one worker across pages.
  // Declared before createWorker() — its logger fires during worker init
  // (loading core/lang data), before the loop below ever runs, so this must
  // already be initialized when the closure first reads it.
  let currentPage = 1;

  const Tesseract = await loadTesseract();
  const worker = await Tesseract.createWorker("eng", undefined, {
    logger: (m) => {
      if (onProgress && m.status) {
        onProgress({ page: currentPage, totalPages: pdf.numPages, status: `${m.status} ${Math.round((m.progress ?? 0) * 100)}%` });
      }
    },
  });

  const ocrTexts: string[] = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      currentPage = i;
      onProgress?.({ page: i, totalPages: pdf.numPages, status: "rendering page" });
      const page = await pdf.getPage(i);
      // Scale up for better OCR accuracy on typical letter-size scans.
      const viewport = page.getViewport({ scale: 3 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      const { data } = await worker.recognize(canvas);
      ocrTexts.push(data.text ?? "");
    }
  } finally {
    await worker.terminate();
  }

  return { text: ocrTexts.join("\n\n"), usedOcr: true };
}
