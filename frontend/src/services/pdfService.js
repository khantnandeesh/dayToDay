import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts, PDFName } from 'pdf-lib';
import api from '../config/api';

// Initialize PDF.js worker with exact matching version
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

/**
 * Loads and parses a PDF from an ArrayBuffer or File
 */
export async function parsePdfDocument(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('PDF file buffer is empty or corrupted.');
  }

  // Deep clone the incoming buffer so that the PDF.js Web Worker never
  // detaches the main thread's copy of rawBytes during transfer!
  const srcBytes = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
  
  // Untouched, persistent copy for editing & export reconstruction
  const preservedRawBytes = new Uint8Array(srcBytes.byteLength);
  preservedRawBytes.set(srcBytes);

  // Dedicated worker copy
  const workerBytes = new Uint8Array(srcBytes.byteLength);
  workerBytes.set(srcBytes);

  const loadingTask = pdfjsLib.getDocument({
    data: workerBytes,
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pagesData = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent({ includeMarkedContent: true });

    const rawItems = [];
    let idCount = 0;

    for (const item of textContent.items) {
      if (!item.str || item.str.trim() === '') continue;

      const tx = item.transform[4];
      const ty = item.transform[5];
      const fontSize = Math.hypot(item.transform[0], item.transform[1]) || 12;
      const width = item.width || (item.str.length * fontSize * 0.55);
      const height = item.height || fontSize;

      rawItems.push({
        id: `p${pageNum}-raw-${idCount++}`,
        str: item.str,
        pdfX: tx,
        pdfY: ty,
        pdfWidth: width,
        pdfHeight: height,
        domLeft: tx,
        domTop: viewport.height - ty - height,
        fontSize: Math.round(fontSize * 10) / 10,
        fontName: item.fontName || 'Helvetica',
        dir: item.dir || 'ltr',
        transform: item.transform,
      });
    }

    // Group adjacent single-word fragments into coherent lines
    const textBlocks = groupTextItems(rawItems, viewport.height);

    pagesData.push({
      pageNumber: pageNum,
      pageIndex: pageNum - 1,
      width: viewport.width,
      height: viewport.height,
      items: textBlocks,
      pdfPage: page,
    });
  }

  return {
    pdfDoc,
    numPages,
    pages: pagesData,
    rawBytes: preservedRawBytes,
  };
}

/**
 * Groups adjacent text tokens into intuitive editable text lines/blocks
 */
function groupTextItems(items, pageHeight) {
  if (items.length === 0) return [];

  // Sort by Y descending (top to bottom in PDF space), then X ascending
  const sorted = [...items].sort((a, b) => {
    const yDiff = Math.abs(a.pdfY - b.pdfY);
    if (yDiff <= 3.5) {
      return a.pdfX - b.pdfX;
    }
    return b.pdfY - a.pdfY;
  });

  const blocks = [];
  let cur = null;

  for (const item of sorted) {
    if (!cur) {
      cur = {
        id: item.id,
        originalText: item.str,
        text: item.str,
        pdfX: item.pdfX,
        pdfY: item.pdfY,
        width: item.pdfWidth,
        height: item.pdfHeight,
        fontSize: item.fontSize,
        fontName: item.fontName,
        fontFamily: detectFontFamily(item.fontName),
        isBold: item.fontName.toLowerCase().includes('bold'),
        isItalic: item.fontName.toLowerCase().includes('italic') || item.fontName.toLowerCase().includes('oblique'),
        color: { r: 0.1, g: 0.1, b: 0.1 },
        subItems: [item],
      };
      continue;
    }

    const sameBaseline = Math.abs(item.pdfY - cur.pdfY) <= 3.5;
    const prevRight = cur.pdfX + cur.width;
    const spacing = item.pdfX - prevRight;
    const sameSize = Math.abs(item.fontSize - cur.fontSize) <= 2.5;

    if (sameBaseline && sameSize && spacing >= -6 && spacing <= (cur.fontSize * 1.8)) {
      const spaceChar = spacing > 1.2 ? ' ' : '';
      cur.originalText = cur.originalText + spaceChar + item.str;
      cur.text = cur.originalText;
      cur.width = (item.pdfX + item.pdfWidth) - cur.pdfX;
      cur.height = Math.max(cur.height, item.pdfHeight);
      cur.subItems.push(item);
    } else {
      blocks.push(cur);
      cur = {
        id: item.id,
        originalText: item.str,
        text: item.str,
        pdfX: item.pdfX,
        pdfY: item.pdfY,
        width: item.pdfWidth,
        height: item.pdfHeight,
        fontSize: item.fontSize,
        fontName: item.fontName,
        fontFamily: detectFontFamily(item.fontName),
        isBold: item.fontName.toLowerCase().includes('bold'),
        isItalic: item.fontName.toLowerCase().includes('italic') || item.fontName.toLowerCase().includes('oblique'),
        color: { r: 0.1, g: 0.1, b: 0.1 },
        subItems: [item],
      };
    }
  }

  if (cur) {
    blocks.push(cur);
  }

  return blocks.map((b, i) => ({
    ...b,
    id: `tb-${i}-${Math.round(b.pdfX)}-${Math.round(b.pdfY)}`,
    domLeft: b.pdfX,
    domTop: pageHeight - b.pdfY - b.height,
  }));
}

function detectFontFamily(name = '') {
  const n = (name || '').toLowerCase();
  if (n.includes('times') || n.includes('serif') || n.includes('roman') || n.includes('georgia')) {
    return 'TimesRoman';
  }
  if (n.includes('courier') || n.includes('mono') || n.includes('consolas')) {
    return 'Courier';
  }
  return 'Helvetica';
}

/**
 * Samples pixel background color behind a text block from the rendered canvas
 */
export function sampleCanvasColor(canvas, x, y, width, height, scale = 1.0) {
  if (!canvas) return { r: 1, g: 1, b: 1 };
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { r: 1, g: 1, b: 1 };

    // Sample pixels slightly outside the perimeter (above and below the text)
    const sampleY = Math.max(0, Math.round((y - 3) * scale));
    const sampleX = Math.max(0, Math.round((x + width / 2) * scale));

    const pixel = ctx.getImageData(sampleX, sampleY, 1, 1).data;
    return {
      r: pixel[0] / 255,
      g: pixel[1] / 255,
      b: pixel[2] / 255,
    };
  } catch {
    return { r: 1, g: 1, b: 1 };
  }
}

/**
 * Fetches sample invoice PDF from backend
 */
export async function fetchSamplePdf(type = 'invoice') {
  const res = await api.get(`/pdf/sample/${type}?format=json`);
  if (!res.data || !res.data.pdfBase64) {
    throw new Error('Failed to load sample PDF');
  }

  const base64 = res.data.pdfBase64.replace(/^data:application\/pdf;base64,/, '');
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return {
    bytes: bytes.buffer,
    filename: res.data.filename || `sample-${type}.pdf`,
  };
}

/**
 * Exports modified PDF:
 * 1. Performs high-speed in-browser vector reconstruction using pdf-lib with full font embedding
 * 2. If browser reconstruction encounters any issue, falls back seamlessly to the backend /api/pdf/edit API
 */
export async function exportModifiedPdf(originalArrayBuffer, edits, filename = 'edited-document.pdf') {
  if (!originalArrayBuffer || originalArrayBuffer.byteLength === 0) {
    throw new Error('Original PDF buffer is empty or was not retained. Please reload the document.');
  }

  // Ensure an independent, untouched Uint8Array copy
  const src = originalArrayBuffer instanceof Uint8Array 
    ? originalArrayBuffer 
    : new Uint8Array(originalArrayBuffer);

  const cleanBytes = new Uint8Array(src.byteLength);
  cleanBytes.set(src);

  // 1. Prioritize fast, zero-latency client-side reconstruction
  try {
    const localResult = await clientSideReconstructPdf(cleanBytes, edits);
    if (localResult && localResult.byteLength > 0) {
      return localResult;
    }
  } catch (clientErr) {
    console.warn('In-browser reconstruction encountered an issue, trying backend API:', clientErr);
  }

  // 2. Fallback to Node.js backend reconstruction
  try {
    const formData = new FormData();
    const blob = new Blob([cleanBytes], { type: 'application/pdf' });
    formData.append('pdf', blob, filename);
    formData.append('edits', JSON.stringify(edits));
    formData.append('filename', filename);

    // Note: Do not set Content-Type manually so browser sets multipart boundary automatically
    const response = await api.post('/pdf/edit', formData, {
      responseType: 'blob',
      headers: {
        'Content-Type': undefined,
      },
    });

    const arrayBuffer = await response.data.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (backendErr) {
    console.error('Backend export fallback failed:', backendErr);
    throw new Error(backendErr.response?.data?.message || backendErr.message || 'PDF export failed');
  }
}

/**
 * Client-side PDF reconstruction using browser pdf-lib
 */
async function clientSideReconstructPdf(originalBytes, edits) {
  const bytes = originalBytes instanceof Uint8Array ? originalBytes : new Uint8Array(originalBytes);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = doc.getPages();

  const fontCache = new Map();
  const getFont = async (family, bold, italic) => {
    let fontEnum = StandardFonts.Helvetica;
    const f = (family || '').toLowerCase();
    if (f.includes('times') || f.includes('serif')) {
      fontEnum = bold && italic ? StandardFonts.TimesRomanBoldItalic : bold ? StandardFonts.TimesRomanBold : italic ? StandardFonts.TimesRomanItalic : StandardFonts.TimesRoman;
    } else if (f.includes('courier') || f.includes('mono')) {
      fontEnum = bold && italic ? StandardFonts.CourierBoldOblique : bold ? StandardFonts.CourierBold : italic ? StandardFonts.CourierOblique : StandardFonts.Courier;
    } else {
      fontEnum = bold && italic ? StandardFonts.HelveticaBoldOblique : bold ? StandardFonts.HelveticaBold : italic ? StandardFonts.HelveticaOblique : StandardFonts.Helvetica;
    }

    if (!fontCache.has(fontEnum)) {
      fontCache.set(fontEnum, await doc.embedFont(fontEnum));
    }
    return fontCache.get(fontEnum);
  };

  for (const pageEdit of (edits.pages || [])) {
    const page = pages[pageEdit.pageIndex];
    if (!page) continue;

    for (const op of (pageEdit.operations || [])) {
      // 1. Draw clean background patch over original text location
      if (op.type === 'replace' || op.type === 'delete') {
        const bg = op.backgroundColor || { r: 1, g: 1, b: 1 };
        const pad = 1.5;
        const origHeight = Math.max(10, Number(op.originalHeight) || 14);
        const origWidth = Math.max(20, Number(op.originalWidth) || 50);
        const origX = Number(op.originalX) || 0;
        const origY = Number(op.originalY) || 0;

        // Cover descenders that fall below the baseline
        const descenderPad = Math.min(4, Math.max(1.5, origHeight * 0.25));
        const patchY = Math.max(0, origY - descenderPad);
        const patchHeight = origHeight + descenderPad + pad;

        const r = typeof bg.r === 'number' ? Math.max(0, Math.min(1, bg.r)) : 1;
        const g = typeof bg.g === 'number' ? Math.max(0, Math.min(1, bg.g)) : 1;
        const b = typeof bg.b === 'number' ? Math.max(0, Math.min(1, bg.b)) : 1;

        page.drawRectangle({
          x: Math.max(0, origX - pad),
          y: patchY,
          width: origWidth + pad * 2,
          height: patchHeight,
          color: rgb(r, g, b),
        });
      }

      // 2. Render replacement or newly inserted text
      if (op.type === 'replace' || op.type === 'insert') {
        const text = (op.newText || '').trim();
        if (!text) continue;

        const font = await getFont(op.fontFamily, op.isBold, op.isItalic);
        const fontSize = Math.max(6, Number(op.fontSize) || 12);
        const col = op.color || { r: 0, g: 0, b: 0 };
        const x = op.newX !== undefined ? Number(op.newX) : (Number(op.originalX) || 0);
        const y = op.newY !== undefined ? Number(op.newY) : (Number(op.originalY) || 0);

        const cr = typeof col.r === 'number' ? Math.max(0, Math.min(1, col.r)) : 0;
        const cg = typeof col.g === 'number' ? Math.max(0, Math.min(1, col.g)) : 0;
        const cb = typeof col.b === 'number' ? Math.max(0, Math.min(1, col.b)) : 0;

        const lines = text.split('\n');
        lines.forEach((line, idx) => {
          if (!line) return;
          page.drawText(line, {
            x,
            y: y - (idx * fontSize * 1.25),
            size: fontSize,
            font,
            color: rgb(cr, cg, cb),
          });
        });
      }
    }
  }

  return await doc.save();
}

/**
 * Persists the modified PDF directly into the user's DayToDay Secure Drive
 */
export async function savePdfToSecureDrive(pdfUint8Array, filename) {
  const base64 = btoa(
    new Uint8Array(pdfUint8Array).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  const res = await api.post('/pdf/save-to-drive', {
    pdfBase64: `data:application/pdf;base64,${base64}`,
    filename,
  });

  return res.data;
}
