import { PDFDocument, rgb, StandardFonts, PDFName } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import zlib from 'zlib';

/**
 * Normalizes font family names to StandardFonts supported by PDF-lib
 */
export function resolveStandardFont(fontFamily = '', isBold = false, isItalic = false) {
  const f = (fontFamily || '').toLowerCase();
  
  if (f.includes('courier') || f.includes('mono')) {
    if (isBold && isItalic) return StandardFonts.CourierBoldOblique;
    if (isBold) return StandardFonts.CourierBold;
    if (isItalic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  
  if (f.includes('times') || f.includes('serif') || f.includes('roman') || f.includes('georgia')) {
    if (isBold && isItalic) return StandardFonts.TimesRomanBoldItalic;
    if (isBold) return StandardFonts.TimesRomanBold;
    if (isItalic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }

  // Default Sans-Serif / Helvetica
  if (isBold && isItalic) return StandardFonts.HelveticaBoldOblique;
  if (isBold) return StandardFonts.HelveticaBold;
  if (isItalic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

/**
 * Parses an existing PDF using pdfjs-dist and extracts:
 * - Page dimensions & rotation
 * - Exact text runs with bounding boxes, font names, font sizes, baseline coordinates
 * - Text groups / paragraphs for intuitive block editing
 */
export async function parsePdf(pdfBuffer) {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
    disableFontFace: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;
  const pages = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent({ includeMarkedContent: true });

    const rawItems = [];
    let itemIdCounter = 0;

    for (const item of textContent.items) {
      if (!item.str || item.str.trim() === '') continue;

      // item.transform: [scaleX, skewY, skewX, scaleY, transX, transY]
      const tx = item.transform[4];
      const ty = item.transform[5]; // bottom-left origin in PDF coordinates
      const fontSize = Math.hypot(item.transform[0], item.transform[1]) || 12;
      const width = item.width || (item.str.length * fontSize * 0.5);
      const height = item.height || fontSize;

      // In PDF coordinate space:
      // (0, 0) is bottom-left. Y goes UP.
      // In DOM viewport coordinates (top-left origin):
      // domX = tx, domY = viewport.height - ty - height
      const domX = tx;
      const domY = viewport.height - ty;

      rawItems.push({
        id: `page-${pageNum}-item-${itemIdCounter++}`,
        str: item.str,
        pdfX: tx,
        pdfY: ty,
        pdfWidth: width,
        pdfHeight: height,
        domX,
        domY,
        fontSize: Math.round(fontSize * 10) / 10,
        fontName: item.fontName || 'Helvetica',
        dir: item.dir || 'ltr',
        transform: item.transform,
      });
    }

    // Smart grouping: Merge consecutive text runs that sit on the same baseline
    // and are separated by normal space, creating cohesive editable text blocks (like Sejda)
    const groupedBlocks = groupTextRuns(rawItems, viewport.height);

    pages.push({
      pageNumber: pageNum,
      pageIndex: pageNum - 1,
      width: viewport.width,
      height: viewport.height,
      items: groupedBlocks,
      rawItemsCount: rawItems.length,
    });
  }

  return {
    pageCount,
    pages,
  };
}

/**
 * Groups adjacent text tokens on the same line into natural sentences/phrases
 */
function groupTextRuns(items, pageHeight) {
  if (items.length === 0) return [];

  // Sort primarily by Y descending (top to bottom), then by X ascending (left to right)
  const sorted = [...items].sort((a, b) => {
    const yDiff = Math.abs(a.pdfY - b.pdfY);
    if (yDiff <= 3) {
      return a.pdfX - b.pdfX;
    }
    return b.pdfY - a.pdfY;
  });

  const groups = [];
  let currentGroup = null;

  for (const item of sorted) {
    if (!currentGroup) {
      currentGroup = {
        id: item.id,
        text: item.str,
        pdfX: item.pdfX,
        pdfY: item.pdfY,
        width: item.pdfWidth,
        height: item.pdfHeight,
        fontSize: item.fontSize,
        fontName: item.fontName,
        domX: item.domX,
        domY: item.domY,
        subItems: [item],
      };
      continue;
    }

    const sameLine = Math.abs(item.pdfY - currentGroup.pdfY) <= 3.5;
    const previousRight = currentGroup.pdfX + currentGroup.width;
    const distance = item.pdfX - previousRight;
    const sameFont = Math.abs(item.fontSize - currentGroup.fontSize) <= 2;

    // If within reasonable word spacing on the same line
    if (sameLine && sameFont && distance >= -5 && distance <= (item.fontSize * 1.8)) {
      const separator = distance > 1.5 ? ' ' : '';
      currentGroup.text = currentGroup.text + separator + item.str;
      currentGroup.width = (item.pdfX + item.pdfWidth) - currentGroup.pdfX;
      currentGroup.height = Math.max(currentGroup.height, item.pdfHeight);
      currentGroup.subItems.push(item);
    } else {
      groups.push(currentGroup);
      currentGroup = {
        id: item.id,
        text: item.str,
        pdfX: item.pdfX,
        pdfY: item.pdfY,
        width: item.pdfWidth,
        height: item.pdfHeight,
        fontSize: item.fontSize,
        fontName: item.fontName,
        domX: item.domX,
        domY: item.domY,
        subItems: [item],
      };
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  // Recalculate dom coordinates accurately
  return groups.map((g, idx) => ({
    ...g,
    id: `block-${idx}`,
    domTop: pageHeight - g.pdfY - g.height,
    domLeft: g.pdfX,
  }));
}

/**
 * Removes target text drawing operators from an uncompressed content stream string.
 * This physically removes the text from the PDF content stream.
 */
function expungeTextFromContentStream(streamStr, targets = []) {
  let modified = streamStr;

  for (const target of targets) {
    const text = (target.originalText || '').trim();
    if (!text) continue;

    // 1. Literal string matching: (text) Tj or '
    // Note: PDF literal strings escape parenthesis as \( and \)
    const escapedText = text.replace(/([()\\\/])/g, '\\$1');
    const literalPattern = new RegExp(`\\(\\s*${escapeRegExp(escapedText)}\\s*\\)\\s*(Tj|'|")`, 'g');
    modified = modified.replace(literalPattern, '() Tj');

    // Also try unescaped in case it has no special characters
    if (!text.includes('(') && !text.includes(')')) {
      const plainLiteral = new RegExp(`\\(\\s*${escapeRegExp(text)}\\s*\\)\\s*(Tj|'|")`, 'g');
      modified = modified.replace(plainLiteral, '() Tj');
    }

    // 2. Hex string matching: <HEX> Tj
    const hexFull = Buffer.from(text).toString('hex');
    const hexUpper = hexFull.toUpperCase();
    const hexLower = hexFull.toLowerCase();
    modified = modified.replaceAll(`<${hexUpper}> Tj`, '<> Tj');
    modified = modified.replaceAll(`<${hexLower}> Tj`, '<> Tj');

    // 3. TJ array operators: [(part1) kern (part2)] TJ
    // Split target into words/tokens and eliminate matching elements
    const words = text.split(/\s+/).filter(w => w.length > 0);
    for (const word of words) {
      if (word.length >= 2) {
        const wEscaped = escapeRegExp(word.replace(/([()\\\/])/g, '\\$1'));
        modified = modified.replace(new RegExp(`\\(\\s*${wEscaped}\\s*\\)`, 'g'), '()');

        const wHex = Buffer.from(word).toString('hex').toUpperCase();
        modified = modified.replaceAll(`<${wHex}>`, '<>');
        modified = modified.replaceAll(`<${wHex.toLowerCase()}>`, '<>');
      }
    }

    // 4. In case the text was drawn inside a specific text matrix [1 0 0 1 x y Tm]
    if (typeof target.originalX === 'number' && typeof target.originalY === 'number') {
      const rx = Math.round(target.originalX);
      const ry = Math.round(target.originalY);
      // Look for Tm with matching coordinates and neutralize text calls inside that block
      const tmRegex = new RegExp(`(\\b${rx}(?:\\.\\d+)?\\s+${ry}(?:\\.\\d+)?\\s+Tm[\\s\\S]*?)(?:\\([^)]*\\)|<[0-9a-fA-F]*>)\\s*(Tj|TJ)`, 'g');
      modified = modified.replace(tmRegex, '$1() Tj');
    }
  }

  return modified;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Reconstructs and edits a PDF:
 * 1. Decodes and strips original text operators from the content stream
 * 2. Applies background-matched vector patch to preserve underlying visuals cleanly
 * 3. Renders replacement text and new text with embedded standard fonts
 * 4. Outputs clean, valid PDF buffer compatible with all viewers
 */
export async function reconstructAndEditPdf(pdfBuffer, edits = {}) {
  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pages = doc.getPages();

  // Cache embedded fonts to avoid duplicate embeds
  const fontCache = new Map();

  const getFont = async (fontFamily, isBold, isItalic) => {
    const standardFontEnum = resolveStandardFont(fontFamily, isBold, isItalic);
    if (!fontCache.has(standardFontEnum)) {
      const embedded = await doc.embedFont(standardFontEnum);
      fontCache.set(standardFontEnum, embedded);
    }
    return fontCache.get(standardFontEnum);
  };

  const pagesEdits = edits.pages || [];

  for (const pageEdit of pagesEdits) {
    const pageIndex = pageEdit.pageIndex;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const operations = pageEdit.operations || [];
    if (operations.length === 0) continue;

    // -------------------------------------------------------------
    // Step 1: Content Stream Text Operator Removal (True Expunging)
    // -------------------------------------------------------------
    const targetsToRemoves = operations.filter(op => op.type === 'replace' || op.type === 'delete');

    if (targetsToRemoves.length > 0) {
      const contentsRef = page.node.Contents();
      if (contentsRef) {
        const contentsObj = doc.context.lookup(contentsRef);
        const streamArray = contentsObj.asArray ? contentsObj.asArray() : [contentsObj];

        for (const sRef of streamArray) {
          const stream = doc.context.lookup(sRef);
          if (!stream || !stream.getContents) continue;

          let decompressed;
          const rawBytes = stream.getContents();
          try {
            decompressed = zlib.inflateSync(Buffer.from(rawBytes));
          } catch {
            decompressed = Buffer.from(rawBytes);
          }

          let streamStr = new TextDecoder('latin1').decode(decompressed);
          const modifiedStreamStr = expungeTextFromContentStream(streamStr, targetsToRemoves);

          // Update the stream with expunged content
          const newStream = doc.context.flateStream(Buffer.from(modifiedStreamStr, 'latin1'));
          const newRef = doc.context.register(newStream);
          page.node.set(PDFName.of('Contents'), newRef);
        }
      }
    }

    // -------------------------------------------------------------
    // Step 2: Background Preservation & Visual Clean-up Patch
    // -------------------------------------------------------------
    // For every removed/replaced text item, render an underlying patch matching
    // the sampled background color so no anti-aliasing artifacts remain
    for (const op of targetsToRemoves) {
      if (op.originalX !== undefined && op.originalY !== undefined) {
        const bg = op.backgroundColor || { r: 1, g: 1, b: 1 };
        // If background is not explicitly marked as transparent
        if (bg.r !== undefined && bg.g !== undefined && bg.b !== undefined) {
          const padding = 1.5;
          const patchX = Math.max(0, (op.originalX || 0) - padding);
          const patchY = Math.max(0, (op.originalY || 0) - padding);
          const patchWidth = (op.originalWidth || 50) + padding * 2;
          const patchHeight = (op.originalHeight || 14) + padding * 2;

          page.drawRectangle({
            x: patchX,
            y: patchY,
            width: patchWidth,
            height: patchHeight,
            color: rgb(bg.r, bg.g, bg.b),
            opacity: 1.0,
          });
        }
      }
    }

    // -------------------------------------------------------------
    // Step 3: Replacement & New Text Rendering
    // -------------------------------------------------------------
    for (const op of operations) {
      if (op.type === 'replace' || op.type === 'insert') {
        const textToRender = (op.newText || '').trim();
        if (!textToRender) continue;

        const font = await getFont(op.fontFamily, op.isBold, op.isItalic);
        const fontSize = Math.max(6, Number(op.fontSize) || 12);
        
        const textColor = op.color || { r: 0, g: 0, b: 0 };
        const cR = typeof textColor.r === 'number' ? Math.min(1, Math.max(0, textColor.r)) : 0;
        const cG = typeof textColor.g === 'number' ? Math.min(1, Math.max(0, textColor.g)) : 0;
        const cB = typeof textColor.b === 'number' ? Math.min(1, Math.max(0, textColor.b)) : 0;

        const posX = op.newX !== undefined ? op.newX : (op.originalX || 50);
        const posY = op.newY !== undefined ? op.newY : (op.originalY || 100);

        // Handle multi-line text if user added line breaks
        const lines = textToRender.split('\n');
        const lineHeight = fontSize * 1.25;

        lines.forEach((line, lineIdx) => {
          if (line.length === 0) return;
          page.drawText(line, {
            x: posX,
            y: posY - (lineIdx * lineHeight),
            size: fontSize,
            font,
            color: rgb(cR, cG, cB),
          });
        });
      }
    }
  }

  const modifiedBytes = await doc.save();
  return Buffer.from(modifiedBytes);
}

/**
 * Creates a sample professional invoice PDF with selectable, realistic text
 * to allow testing Sejda-like editing immediately without uploading files.
 */
export async function createSamplePdf(type = 'invoice') {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // Standard A4 (points)
  const { width, height } = page.getSize();

  const regularFont = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // Background clean canvas
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.98, 0.99, 1.0),
  });

  // Top header banner
  page.drawRectangle({
    x: 40,
    y: height - 120,
    width: width - 80,
    height: 80,
    color: rgb(0.06, 0.11, 0.22),
  });

  page.drawText('DAYTODAY CORP', {
    x: 60,
    y: height - 75,
    size: 20,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  page.drawText('INVOICE / SERVICE AGREEMENT', {
    x: 60,
    y: height - 100,
    size: 11,
    font: regularFont,
    color: rgb(0.56, 0.76, 0.98),
  });

  page.drawText('#INV-2026-8941', {
    x: width - 190,
    y: height - 85,
    size: 14,
    font: boldFont,
    color: rgb(0.22, 0.74, 0.97),
  });

  // Customer & Meta Info Card
  page.drawRectangle({
    x: 40,
    y: height - 250,
    width: width - 80,
    height: 110,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.85, 0.90, 0.95),
    borderWidth: 1,
  });

  page.drawText('CLIENT INFORMATION', {
    x: 60,
    y: height - 165,
    size: 10,
    font: boldFont,
    color: rgb(0.4, 0.45, 0.55),
  });

  page.drawText('Name: John Doe', {
    x: 60,
    y: height - 190,
    size: 14,
    font: boldFont,
    color: rgb(0.1, 0.15, 0.25),
  });

  page.drawText('Title: Senior Software Engineer', {
    x: 60,
    y: height - 212,
    size: 12,
    font: regularFont,
    color: rgb(0.3, 0.35, 0.45),
  });

  page.drawText('Company: Acme Corporation Inc.', {
    x: 60,
    y: height - 232,
    size: 12,
    font: regularFont,
    color: rgb(0.3, 0.35, 0.45),
  });

  page.drawText('Date: September 5, 2026', {
    x: width - 230,
    y: height - 190,
    size: 12,
    font: regularFont,
    color: rgb(0.2, 0.25, 0.35),
  });

  page.drawText('Payment Terms: Net 30', {
    x: width - 230,
    y: height - 212,
    size: 12,
    font: regularFont,
    color: rgb(0.2, 0.25, 0.35),
  });

  page.drawText('Status: PENDING REVIEW', {
    x: width - 230,
    y: height - 232,
    size: 11,
    font: boldFont,
    color: rgb(0.85, 0.4, 0.1),
  });

  // Table Header
  page.drawRectangle({
    x: 40,
    y: height - 310,
    width: width - 80,
    height: 35,
    color: rgb(0.12, 0.18, 0.3),
  });

  page.drawText('DESCRIPTION', { x: 55, y: height - 295, size: 10, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('QTY', { x: 340, y: height - 295, size: 10, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('RATE', { x: 410, y: height - 295, size: 10, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('AMOUNT', { x: 485, y: height - 295, size: 10, font: boldFont, color: rgb(1, 1, 1) });

  // Line items
  const items = [
    { desc: 'Cloud Architecture & Security Audit', qty: '1', rate: '$4,500.00', amount: '$4,500.00' },
    { desc: 'Full-Stack Node.js & React Implementation', qty: '40 hrs', rate: '$120.00', amount: '$4,800.00' },
    { desc: '2FA Speakeasy Authentication System', qty: '1', rate: '$1,250.00', amount: '$1,250.00' },
    { desc: 'Dedicated Heroku Dyno Performance Tuning', qty: '1', rate: '$950.00', amount: '$950.00' },
  ];

  let currentY = height - 345;
  items.forEach((row, i) => {
    // Alternating background
    if (i % 2 === 1) {
      page.drawRectangle({
        x: 40,
        y: currentY - 8,
        width: width - 80,
        height: 28,
        color: rgb(0.95, 0.97, 1.0),
      });
    }

    page.drawText(row.desc, { x: 55, y: currentY, size: 11, font: regularFont, color: rgb(0.15, 0.2, 0.3) });
    page.drawText(row.qty, { x: 345, y: currentY, size: 11, font: regularFont, color: rgb(0.2, 0.25, 0.35) });
    page.drawText(row.rate, { x: 410, y: currentY, size: 11, font: regularFont, color: rgb(0.2, 0.25, 0.35) });
    page.drawText(row.amount, { x: 485, y: currentY, size: 11, font: boldFont, color: rgb(0.1, 0.15, 0.25) });

    currentY -= 32;
  });

  // Total Summary
  page.drawRectangle({
    x: width - 240,
    y: currentY - 60,
    width: 200,
    height: 50,
    color: rgb(0.93, 0.96, 1.0),
    borderColor: rgb(0.75, 0.85, 0.95),
    borderWidth: 1,
  });

  page.drawText('TOTAL BALANCE DUE:', {
    x: width - 225,
    y: currentY - 32,
    size: 10,
    font: boldFont,
    color: rgb(0.3, 0.4, 0.5),
  });

  page.drawText('$11,500.00', {
    x: width - 225,
    y: currentY - 50,
    size: 16,
    font: boldFont,
    color: rgb(0.05, 0.45, 0.75),
  });

  // Footer notes
  page.drawText('Notice: All modifications to this agreement require written authorization.', {
    x: 40,
    y: 80,
    size: 9,
    font: regularFont,
    color: rgb(0.5, 0.55, 0.65),
  });

  page.drawText('Generated by DayToDay Enterprise Suite · Sejda-Engine PDF Technology', {
    x: 40,
    y: 60,
    size: 9,
    font: regularFont,
    color: rgb(0.6, 0.65, 0.75),
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
