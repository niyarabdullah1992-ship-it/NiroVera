import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Same-origin worker from the installed pdfjs-dist. A CDN worker was failing
// getDocument on blob: uploads (valid PDFs showed as "convert to PDF").
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default pdfjsLib;
export { pdfjsLib };