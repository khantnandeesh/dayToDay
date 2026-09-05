import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, Download, HardDrive, Undo2, Redo2, Plus, Trash2, ZoomIn, ZoomOut,
  ChevronLeft, ChevronRight, FileText, Check, RotateCcw, Move, Type, Sparkles,
  Maximize2, AlertCircle, Eye, Edit3, Palette, Bold, Italic, Loader2
} from 'lucide-react';
import {
  parsePdfDocument,
  fetchSamplePdf,
  exportModifiedPdf,
  savePdfToSecureDrive,
  sampleCanvasColor
} from '../../services/pdfService';

const FONT_OPTIONS = [
  { id: 'Helvetica', label: 'Helvetica (Sans-serif)', style: 'font-sans' },
  { id: 'TimesRoman', label: 'Times Roman (Serif)', style: 'font-serif' },
  { id: 'Courier', label: 'Courier (Monospace)', style: 'font-mono' }
];

const COLOR_PRESETS = [
  '#000000', '#1e293b', '#475569', '#1e3a8a', '#0284c7',
  '#059669', '#b91c1c', '#7c3aed', '#d97706', '#4b5563'
];

export default function PdfEditor({ initialPdfUrl = null, initialFilename = null, onSavedToDrive = null }) {
  // Document State
  const [pdfData, setPdfData] = useState(null); // { pdfDoc, numPages, pages, rawBytes }
  const [filename, setFilename] = useState(initialFilename || 'Document.pdf');
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.25);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Editor Mode: 'select' (edit text) | 'add' (insert new text) | 'preview' (clean view)
  const [mode, setMode] = useState('select');

  // Page Edits State:
  // Map of pageIndex -> Array of edit items:
  // { id, originalId, type: 'edit'|'delete'|'new', originalText, text, pdfX, pdfY, width, height, fontSize, fontFamily, isBold, isItalic, color, backgroundColor }
  const [pageEdits, setPageEdits] = useState({});

  // Active / Selected text item
  const [activeItemId, setActiveItemId] = useState(null);

  // History for Undo / Redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Left sidebar toggle
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Dragging state for moving text boxes
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0, initialLeft: 0, initialTop: 0 });

  // DOM Refs
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-dismiss success notification
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Load initial sample or provided PDF on mount
  useEffect(() => {
    if (initialPdfUrl) {
      loadPdfFromUrl(initialPdfUrl, initialFilename || 'Document.pdf');
    } else {
      loadSampleInvoice();
    }
  }, [initialPdfUrl]);

  // Push state to Undo/Redo history
  const pushHistory = (newEdits) => {
    const trimmed = history.slice(0, historyIndex + 1);
    setHistory([...trimmed, newEdits]);
    setHistoryIndex(trimmed.length);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setPageEdits(prev);
    } else if (historyIndex === 0) {
      setHistoryIndex(-1);
      setPageEdits({});
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setPageEdits(next);
    }
  };

  // --------------------------------------------------------------------------
  // Document Loading Handlers
  // --------------------------------------------------------------------------
  const loadPdfFromBuffer = async (buffer, name) => {
    try {
      setLoading(true);
      setError(null);
      setLoadingStatus('Parsing document content streams...');

      const srcBytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      const cleanCopy = new Uint8Array(srcBytes.byteLength);
      cleanCopy.set(srcBytes);

      const parsed = await parsePdfDocument(cleanCopy);
      setPdfData(parsed);
      setFilename(name);
      setCurrentPage(1);
      setPageEdits({});
      setHistory([]);
      setHistoryIndex(-1);
      setActiveItemId(null);
      setLoading(false);
    } catch (err) {
      console.error('Failed to parse PDF:', err);
      setError('Could not parse PDF: ' + err.message);
      setLoading(false);
    }
  };

  const loadPdfFromUrl = async (url, name) => {
    try {
      setLoading(true);
      setError(null);
      setLoadingStatus('Fetching PDF document...');

      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      await loadPdfFromBuffer(buffer, name);
    } catch (err) {
      console.error('Failed to load PDF from URL:', err);
      setError('Failed to download PDF: ' + err.message);
      setLoading(false);
    }
  };

  const loadSampleInvoice = async () => {
    try {
      setLoading(true);
      setError(null);
      setLoadingStatus('Generating interactive sample invoice...');

      const sample = await fetchSamplePdf('invoice');
      await loadPdfFromBuffer(sample.bytes, sample.filename);
      setSuccessMessage('Loaded interactive sample invoice! Click any text to edit.');
    } catch (err) {
      console.error('Sample load error:', err);
      setError('Failed to load sample invoice: ' + err.message);
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setError('Please select a valid PDF file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        await loadPdfFromBuffer(event.target.result, file.name);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.pdf'))) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          await loadPdfFromBuffer(event.target.result, file.name);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // --------------------------------------------------------------------------
  // Canvas Rendering (PDF.js Page Rendering)
  // --------------------------------------------------------------------------
  const renderCurrentPage = useCallback(async () => {
    if (!pdfData || !canvasRef.current) return;

    const pageObj = pdfData.pages[currentPage - 1];
    if (!pageObj || !pageObj.pdfPage) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const viewport = pageObj.pdfPage.getViewport({ scale });

    // Support Retina / High-DPI screens
    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = Math.floor(viewport.width) + 'px';
    canvas.style.height = Math.floor(viewport.height) + 'px';

    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

    const renderContext = {
      canvasContext: ctx,
      transform,
      viewport,
    };

    try {
      await pageObj.pdfPage.render(renderContext).promise;
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('Page render error:', err);
      }
    }
  }, [pdfData, currentPage, scale]);

  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  // --------------------------------------------------------------------------
  // Text Editing Logic
  // --------------------------------------------------------------------------
  const currentPageData = pdfData?.pages[currentPage - 1] || null;
  const currentEdits = pageEdits[currentPage - 1] || [];

  // Merged items list: original parsed items + user modifications
  const displayedItems = React.useMemo(() => {
    if (!currentPageData) return [];

    const editsMap = new Map();
    const newItems = [];

    currentEdits.forEach((edit) => {
      if (edit.type === 'new') {
        newItems.push(edit);
      } else {
        editsMap.set(edit.originalId, edit);
      }
    });

    const list = currentPageData.items.map((original) => {
      const override = editsMap.get(original.id);
      if (override) {
        return {
          ...original,
          ...override,
          isModified: override.type === 'edit',
          isDeleted: override.type === 'delete',
        };
      }
      return {
        ...original,
        isModified: false,
        isDeleted: false,
      };
    });

    return [...list, ...newItems];
  }, [currentPageData, currentEdits]);

  // Active Item Helper
  const activeItem = displayedItems.find((i) => i.id === activeItemId) || null;

  const updateItemEdit = (itemId, updates) => {
    const pageIdx = currentPage - 1;
    const existingEdits = pageEdits[pageIdx] || [];
    const item = displayedItems.find((i) => i.id === itemId);
    if (!item) return;

    let updatedEdits;
    const isNew = item.type === 'new';

    if (isNew) {
      updatedEdits = existingEdits.map((e) => (e.id === itemId ? { ...e, ...updates } : e));
    } else {
      const editIndex = existingEdits.findIndex((e) => e.originalId === itemId);
      const baseEdit = {
        id: `edit-${itemId}`,
        originalId: itemId,
        type: 'edit',
        originalText: item.originalText,
        text: item.text,
        originalX: item.pdfX,
        originalY: item.pdfY,
        pdfX: item.pdfX,
        pdfY: item.pdfY,
        originalWidth: item.width,
        originalHeight: item.height,
        width: item.width,
        height: item.height,
        fontSize: item.fontSize,
        fontFamily: item.fontFamily || 'Helvetica',
        isBold: item.isBold || false,
        isItalic: item.isItalic || false,
        color: item.color || { r: 0.1, g: 0.1, b: 0.1 },
        backgroundColor: item.backgroundColor || sampleBackgroundForItem(item),
      };

      if (editIndex >= 0) {
        updatedEdits = [...existingEdits];
        updatedEdits[editIndex] = { ...updatedEdits[editIndex], ...updates };
      } else {
        updatedEdits = [...existingEdits, { ...baseEdit, ...updates }];
      }
    }

    const newPageEdits = { ...pageEdits, [pageIdx]: updatedEdits };
    setPageEdits(newPageEdits);
    pushHistory(newPageEdits);
  };

  const sampleBackgroundForItem = (item) => {
    if (!canvasRef.current) return { r: 1, g: 1, b: 1 };
    return sampleCanvasColor(
      canvasRef.current,
      item.domLeft,
      item.domTop,
      item.width,
      item.height,
      scale
    );
  };

  const handleDeleteItem = (itemId) => {
    const pageIdx = currentPage - 1;
    const existingEdits = pageEdits[pageIdx] || [];
    const item = displayedItems.find((i) => i.id === itemId);
    if (!item) return;

    let updatedEdits;
    if (item.type === 'new') {
      updatedEdits = existingEdits.filter((e) => e.id !== itemId);
    } else {
      const editIndex = existingEdits.findIndex((e) => e.originalId === itemId);
      const deleteRecord = {
        id: `del-${itemId}`,
        originalId: itemId,
        type: 'delete',
        originalText: item.originalText,
        originalX: item.pdfX,
        originalY: item.pdfY,
        originalWidth: item.width,
        originalHeight: item.height,
        backgroundColor: sampleBackgroundForItem(item),
      };

      if (editIndex >= 0) {
        updatedEdits = [...existingEdits];
        updatedEdits[editIndex] = deleteRecord;
      } else {
        updatedEdits = [...existingEdits, deleteRecord];
      }
    }

    const newPageEdits = { ...pageEdits, [pageIdx]: updatedEdits };
    setPageEdits(newPageEdits);
    pushHistory(newPageEdits);
    setActiveItemId(null);
  };

  const handleResetItem = (itemId) => {
    const pageIdx = currentPage - 1;
    const existingEdits = pageEdits[pageIdx] || [];
    const updatedEdits = existingEdits.filter((e) => e.originalId !== itemId && e.id !== itemId);
    const newPageEdits = { ...pageEdits, [pageIdx]: updatedEdits };
    setPageEdits(newPageEdits);
    pushHistory(newPageEdits);
  };

  // Add brand new text at specified click location
  const handleCanvasClickToAdd = (e) => {
    if (mode !== 'add' || !currentPageData) return;

    const rect = textLayerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = (e.clientX - rect.left) / scale;
    const clickY = (e.clientY - rect.top) / scale;

    const pageHeight = currentPageData.height;
    const pdfY = pageHeight - clickY - 14;

    const newId = `new-text-${Date.now()}`;
    const newEdit = {
      id: newId,
      type: 'new',
      text: 'New Text',
      originalText: '',
      pdfX: clickX,
      pdfY: Math.max(10, pdfY),
      domLeft: clickX,
      domTop: clickY,
      width: 100,
      height: 16,
      fontSize: 14,
      fontFamily: 'Helvetica',
      isBold: false,
      isItalic: false,
      color: { r: 0.1, g: 0.1, b: 0.1 },
    };

    const pageIdx = currentPage - 1;
    const existingEdits = pageEdits[pageIdx] || [];
    const updatedEdits = [...existingEdits, newEdit];
    const newPageEdits = { ...pageEdits, [pageIdx]: updatedEdits };

    setPageEdits(newPageEdits);
    pushHistory(newPageEdits);
    setActiveItemId(newId);
    setMode('select');
  };

  // --------------------------------------------------------------------------
  // Drag to Move Text Box
  // --------------------------------------------------------------------------
  const startDrag = (e, item) => {
    e.stopPropagation();
    setIsDragging(true);
    setActiveItemId(item.id);

    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      initialPdfX: item.pdfX,
      initialPdfY: item.pdfY,
      initialDomLeft: item.domLeft,
      initialDomTop: item.domTop,
    };

    const handleMouseMove = (moveEvent) => {
      const deltaX = (moveEvent.clientX - dragStartPos.current.x) / scale;
      const deltaY = (moveEvent.clientY - dragStartPos.current.y) / scale;

      const newDomLeft = dragStartPos.current.initialDomLeft + deltaX;
      const newDomTop = dragStartPos.current.initialDomTop + deltaY;
      const newPdfX = dragStartPos.current.initialPdfX + deltaX;
      const newPdfY = dragStartPos.current.initialPdfY - deltaY;

      updateItemEdit(item.id, {
        domLeft: Math.round(newDomLeft),
        domTop: Math.round(newDomTop),
        pdfX: Math.round(newPdfX),
        pdfY: Math.round(newPdfY),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // --------------------------------------------------------------------------
  // Export & Save to Drive
  // --------------------------------------------------------------------------
  const prepareExportPayload = () => {
    const pagesPayload = [];

    Object.entries(pageEdits).forEach(([pageIdxStr, editsList]) => {
      const pageIdx = Number(pageIdxStr);
      const operations = [];

      editsList.forEach((edit) => {
        if (edit.type === 'delete') {
          operations.push({
            type: 'delete',
            originalId: edit.originalId,
            originalText: edit.originalText,
            originalX: edit.originalX,
            originalY: edit.originalY,
            originalWidth: edit.originalWidth,
            originalHeight: edit.originalHeight,
            backgroundColor: edit.backgroundColor || { r: 1, g: 1, b: 1 },
          });
        } else if (edit.type === 'edit') {
          operations.push({
            type: 'replace',
            originalId: edit.originalId,
            originalText: edit.originalText,
            originalX: edit.originalX,
            originalY: edit.originalY,
            originalWidth: edit.originalWidth,
            originalHeight: edit.originalHeight,
            newText: edit.text,
            newX: edit.pdfX,
            newY: edit.pdfY,
            fontSize: edit.fontSize,
            fontFamily: edit.fontFamily || 'Helvetica',
            isBold: edit.isBold || false,
            isItalic: edit.isItalic || false,
            color: edit.color || { r: 0, g: 0, b: 0 },
            backgroundColor: edit.backgroundColor || { r: 1, g: 1, b: 1 },
          });
        } else if (edit.type === 'new') {
          operations.push({
            type: 'insert',
            newText: edit.text,
            newX: edit.pdfX,
            newY: edit.pdfY,
            fontSize: edit.fontSize,
            fontFamily: edit.fontFamily || 'Helvetica',
            isBold: edit.isBold || false,
            isItalic: edit.isItalic || false,
            color: edit.color || { r: 0, g: 0, b: 0 },
          });
        }
      });

      if (operations.length > 0) {
        pagesPayload.push({
          pageIndex: pageIdx,
          operations,
        });
      }
    });

    return { pages: pagesPayload };
  };

  const handleDownload = async () => {
    if (!pdfData?.rawBytes) return;

    try {
      setIsExporting(true);
      setError(null);

      const payload = prepareExportPayload();
      const outputFilename = filename.replace(/\.pdf$/i, '') + '_edited.pdf';
      const modifiedBytes = await exportModifiedPdf(pdfData.rawBytes, payload, outputFilename);

      // Download file to client browser
      const blob = new Blob([modifiedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = outputFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setIsExporting(false);
      setSuccessMessage(`Document "${outputFilename}" saved & downloaded successfully!`);
    } catch (err) {
      console.error('Download error:', err);
      setError('Export failed: ' + err.message);
      setIsExporting(false);
    }
  };

  const handleSaveToDrive = async () => {
    if (!pdfData?.rawBytes) return;

    try {
      setIsExporting(true);
      setError(null);

      const payload = prepareExportPayload();
      const outputFilename = filename.replace(/\.pdf$/i, '') + '_edited.pdf';
      const modifiedBytes = await exportModifiedPdf(pdfData.rawBytes, payload, outputFilename);

      const result = await savePdfToSecureDrive(modifiedBytes, outputFilename);
      setIsExporting(false);
      setSuccessMessage(`Document "${outputFilename}" saved directly to your Secure Drive!`);
      if (onSavedToDrive) onSavedToDrive(result);
    } catch (err) {
      console.error('Save to drive error:', err);
      setError('Failed to save to Secure Drive: ' + err.message);
      setIsExporting(false);
    }
  };

  // Count total edits across document
  const totalEditsCount = Object.values(pageEdits).reduce(
    (acc, edits) => acc + edits.length,
    0
  );

  return (
    <div id="pdf-editor-container" className="flex flex-col h-screen bg-slate-900 text-slate-100 select-none overflow-hidden font-sans">
      {/* ------------------------------------------------------------------- */}
      {/* TOP HEADER & ACTION BAR                                             */}
      {/* ------------------------------------------------------------------- */}
      <header className="h-14 bg-slate-950 border-b border-slate-800 px-4 flex items-center justify-between gap-3 shrink-0 z-30">
        {/* Left: Brand & File Info */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center text-white font-bold shadow-md shadow-cyan-900/30">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm tracking-tight hidden sm:inline">
                Sejda PDF Editor
              </span>
              <span className="text-xs bg-cyan-950 text-cyan-400 border border-cyan-800/80 px-2 py-0.5 rounded font-mono">
                In-Place Reconstructor
              </span>
            </div>
            <div className="text-xs text-slate-400 truncate max-w-[180px] sm:max-w-xs font-mono">
              {filename}
            </div>
          </div>
        </div>

        {/* Center: Formatting & Tool Modes */}
        <div className="flex items-center gap-2">
          {/* Tool Mode Pill */}
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setMode('select')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                mode === 'select'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Select and edit existing text in the PDF"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Text</span>
            </button>

            <button
              onClick={() => setMode('add')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                mode === 'add'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Click anywhere to insert new text"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Text</span>
            </button>

            <button
              onClick={() => setMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                mode === 'preview'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Preview document without editing outlines"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </button>
          </div>

          {/* History Undo / Redo */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
            <button
              onClick={handleUndo}
              disabled={historyIndex < 0}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Upload, Sample, and Export */}
        <div className="flex items-center gap-2">
          {/* Try Sample Button */}
          <button
            onClick={loadSampleInvoice}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition"
            title="Load sample invoice to test editing John Doe -> Jane Doe"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Sample Invoice</span>
          </button>

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition"
            title="Upload any existing PDF from your computer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload PDF</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Save & Download Button */}
          <div className="flex items-center">
            <button
              onClick={handleDownload}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-950/50 disabled:opacity-50 transition"
              title="Reconstruct & Download modified PDF"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Export PDF</span>
            </button>

            <button
              onClick={handleSaveToDrive}
              disabled={isExporting}
              className="p-2 ml-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs transition"
              title="Save directly to DayToDay Secure Drive"
            >
              <HardDrive className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------- */}
      {/* SECONDARY TOOLBAR: FORMATTING & PAGE NAVIGATION                     */}
      {/* ------------------------------------------------------------------- */}
      <div className="h-12 bg-slate-950/90 border-b border-slate-800/80 px-4 flex items-center justify-between gap-4 shrink-0 text-xs">
        {/* Left: Pagination */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-1.5 rounded-lg border transition ${
              sidebarOpen
                ? 'bg-slate-800 text-cyan-400 border-slate-700'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Toggle Thumbnails Sidebar"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-slate-300">
              Page {currentPage} of {pdfData?.numPages || 1}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(pdfData?.numPages || 1, p + 1))}
              disabled={currentPage >= (pdfData?.numPages || 1)}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {totalEditsCount > 0 && (
            <span className="text-xs bg-amber-950/80 text-amber-300 border border-amber-800/60 px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1">
              <Check className="w-3 h-3 text-amber-400" />
              {totalEditsCount} {totalEditsCount === 1 ? 'edit' : 'edits'} staged
            </span>
          )}
        </div>

        {/* Center: Contextual Text Formatting Toolbar (Active when item is focused) */}
        {activeItem ? (
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 px-3 py-1 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-1">
            <span className="text-slate-400 text-[11px] font-mono uppercase tracking-wider flex items-center gap-1">
              <Type className="w-3 h-3 text-cyan-400" /> Edit Text
            </span>

            <div className="h-4 w-px bg-slate-700 mx-1" />

            {/* Font Family Selector */}
            <select
              value={activeItem.fontFamily || 'Helvetica'}
              onChange={(e) => updateItemEdit(activeItem.id, { fontFamily: e.target.value })}
              className="bg-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1 border border-slate-700 outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>

            {/* Font Size Controls */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg">
              <button
                onClick={() =>
                  updateItemEdit(activeItem.id, {
                    fontSize: Math.max(6, Math.round((activeItem.fontSize || 12) - 1)),
                  })
                }
                className="px-2 py-1 text-slate-400 hover:text-white"
                title="Decrease font size"
              >
                -
              </button>
              <span className="px-1.5 font-mono text-xs text-slate-200">
                {Math.round(activeItem.fontSize || 12)}pt
              </span>
              <button
                onClick={() =>
                  updateItemEdit(activeItem.id, {
                    fontSize: Math.min(72, Math.round((activeItem.fontSize || 12) + 1)),
                  })
                }
                className="px-2 py-1 text-slate-400 hover:text-white"
                title="Increase font size"
              >
                +
              </button>
            </div>

            {/* Style Toggles: Bold & Italic */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5">
              <button
                onClick={() => updateItemEdit(activeItem.id, { isBold: !activeItem.isBold })}
                className={`p-1 rounded ${
                  activeItem.isBold ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Toggle Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => updateItemEdit(activeItem.id, { isItalic: !activeItem.isItalic })}
                className={`p-1 rounded ${
                  activeItem.isItalic ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Toggle Italic"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Color Presets */}
            <div className="flex items-center gap-1">
              {COLOR_PRESETS.slice(0, 5).map((hex) => (
                <button
                  key={hex}
                  onClick={() => {
                    const r = parseInt(hex.slice(1, 3), 16) / 255;
                    const g = parseInt(hex.slice(3, 5), 16) / 255;
                    const b = parseInt(hex.slice(5, 7), 16) / 255;
                    updateItemEdit(activeItem.id, { color: { r, g, b } });
                  }}
                  className="w-4 h-4 rounded-full border border-slate-600 hover:scale-110 transition"
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
            </div>

            <div className="h-4 w-px bg-slate-700 mx-1" />

            {/* Delete button */}
            <button
              onClick={() => handleDeleteItem(activeItem.id)}
              className="p-1.5 text-red-400 hover:bg-red-950/50 hover:text-red-300 rounded-lg transition"
              title="Delete this text element"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {/* Revert button (if modified) */}
            {activeItem.isModified && (
              <button
                onClick={() => handleResetItem(activeItem.id)}
                className="p-1.5 text-amber-400 hover:bg-amber-950/50 rounded-lg transition"
                title="Reset to original text"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="text-slate-400 text-xs hidden md:flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Hover and click any existing text in the document to edit in-place</span>
          </div>
        )}

        {/* Right: Zoom Controls */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}
            className="p-1 text-slate-400 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="px-2 font-mono text-slate-300 text-xs">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
            className="p-1 text-slate-400 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* NOTIFICATIONS / ALERTS                                              */}
      {/* ------------------------------------------------------------------- */}
      {error && (
        <div className="bg-red-950/90 border-b border-red-800 text-red-200 px-4 py-2 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-950/90 border-b border-emerald-800 text-emerald-200 px-4 py-2 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MAIN WORKSPACE: SIDEBAR + CANVAS VIEWPORT                           */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex flex-1 overflow-hidden relative" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
        {/* Thumbnails Sidebar */}
        {sidebarOpen && pdfData && (
          <aside className="w-56 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <span>Pages ({pdfData.numPages})</span>
              <span className="text-[10px] text-cyan-400 font-mono">Thumbnails</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {Array.from({ length: pdfData.numPages }).map((_, idx) => {
                const pageNum = idx + 1;
                const pageEditsCount = (pageEdits[idx] || []).length;
                return (
                  <div
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`cursor-pointer rounded-xl p-2 border transition ${
                      currentPage === pageNum
                        ? 'bg-cyan-950/50 border-cyan-500 shadow-md ring-1 ring-cyan-500'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="aspect-[1/1.414] bg-white rounded-lg flex items-center justify-center text-slate-800 shadow relative overflow-hidden">
                      <div className="p-2 text-[9px] text-slate-400 leading-tight select-none pointer-events-none w-full h-full flex flex-col justify-between">
                        <div className="h-2 w-12 bg-slate-300 rounded mb-1" />
                        <div className="space-y-1">
                          <div className="h-1.5 w-full bg-slate-200 rounded" />
                          <div className="h-1.5 w-3/4 bg-slate-200 rounded" />
                          <div className="h-1.5 w-5/6 bg-slate-200 rounded" />
                        </div>
                        <div className="h-2 w-16 bg-slate-200 rounded self-end" />
                      </div>

                      {pageEditsCount > 0 && (
                        <div className="absolute top-1 right-1 bg-amber-500 text-slate-950 text-[10px] font-bold px-1.5 rounded-full">
                          {pageEditsCount}
                        </div>
                      )}
                    </div>
                    <div className="text-center text-xs mt-1.5 font-mono text-slate-400">
                      Page {pageNum}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {/* Main PDF Stage / Viewport */}
        <main
          ref={containerRef}
          className="flex-1 overflow-auto bg-slate-900/90 relative p-8 flex justify-center items-start custom-scrollbar"
          onClick={() => {
            // Deselect on blank background click
            if (!isDragging) {
              setActiveItemId(null);
            }
          }}
        >
          {loading && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center z-40">
              <Loader2 className="w-10 h-10 text-cyan-500 animate-spin mb-3" />
              <div className="text-slate-200 text-sm font-medium">{loadingStatus}</div>
              <div className="text-slate-500 text-xs mt-1 font-mono">Processing PDF structure...</div>
            </div>
          )}

          {/* Interactive Document Stage */}
          <div
            className="relative shadow-2xl rounded-sm transition-all origin-top"
            style={{
              width: currentPageData ? currentPageData.width * scale : 'auto',
              height: currentPageData ? currentPageData.height * scale : 'auto',
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (mode === 'add') {
                handleCanvasClickToAdd(e);
              }
            }}
          >
            {/* 1. Underlying Base Canvas rendered by PDF.js */}
            <canvas
              ref={canvasRef}
              className="block rounded-sm bg-white shadow-2xl"
              style={{
                width: currentPageData ? currentPageData.width * scale : 'auto',
                height: currentPageData ? currentPageData.height * scale : 'auto',
              }}
            />

            {/* 2. Interactive Semantic Text Layer */}
            {currentPageData && (
              <div
                ref={textLayerRef}
                className="absolute inset-0 pointer-events-none"
                style={{
                  width: currentPageData.width * scale,
                  height: currentPageData.height * scale,
                }}
              >
                {displayedItems.map((item) => {
                  const isSelected = activeItemId === item.id;
                  const isDeleted = item.isDeleted;
                  const isModified = item.isModified || item.type === 'new';

                  const boxLeft = (item.domLeft || 0) * scale;
                  const boxTop = (item.domTop || 0) * scale;
                  const boxWidth = Math.max(30, (item.width || 40) * scale);
                  const boxHeight = Math.max(16, (item.height || 14) * scale);
                  const scaledFontSize = (item.fontSize || 12) * scale;

                  // Text color formatting
                  const c = item.color || { r: 0.1, g: 0.1, b: 0.1 };
                  const colorCss = `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`;

                  if (isDeleted && mode === 'preview') {
                    return null;
                  }

                  return (
                    <div
                      key={item.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (mode !== 'preview') {
                          setActiveItemId(item.id);
                        }
                      }}
                      className={`absolute pointer-events-auto transition-all ${
                        mode === 'preview'
                          ? ''
                          : isSelected
                          ? 'ring-2 ring-cyan-500 bg-white/95 rounded shadow-lg z-20'
                          : isModified
                          ? 'ring-1 ring-emerald-500 bg-white/90 hover:ring-2 rounded z-10'
                          : isDeleted
                          ? 'ring-1 ring-red-500/60 bg-red-100/80 rounded line-through opacity-60 z-10'
                          : 'hover:ring-1 hover:ring-cyan-500/80 hover:bg-cyan-500/10 cursor-pointer rounded'
                      }`}
                      style={{
                        left: boxLeft,
                        top: boxTop,
                        minWidth: boxWidth,
                        minHeight: boxHeight,
                      }}
                    >
                      {/* Active / Editable State */}
                      {isSelected && mode !== 'preview' ? (
                        <div className="relative group p-0.5">
                          {/* Floating Drag Handle */}
                          <div
                            onMouseDown={(e) => startDrag(e, item)}
                            className="absolute -top-7 left-0 bg-cyan-600 text-white text-[10px] font-mono px-2 py-0.5 rounded shadow cursor-grab active:cursor-grabbing flex items-center gap-1 z-30"
                            title="Drag to move text"
                          >
                            <Move className="w-3 h-3" />
                            <span>Move</span>
                          </div>

                          {/* Inline Editable Input */}
                          <input
                            type="text"
                            value={item.text}
                            onChange={(e) => updateItemEdit(item.id, { text: e.target.value })}
                            autoFocus
                            className="w-full bg-transparent border-none outline-none font-medium px-1 leading-none"
                            style={{
                              fontSize: `${scaledFontSize}px`,
                              fontFamily: item.fontFamily === 'TimesRoman' ? 'serif' : item.fontFamily === 'Courier' ? 'monospace' : 'sans-serif',
                              fontWeight: item.isBold ? 'bold' : 'normal',
                              fontStyle: item.isItalic ? 'italic' : 'normal',
                              color: colorCss,
                            }}
                          />
                        </div>
                      ) : isModified ? (
                        /* Modified Text Render Layer (Hides original raster beneath via white/sampled patch) */
                        <div
                          className="px-1 leading-none select-none flex items-center bg-white"
                          style={{
                            fontSize: `${scaledFontSize}px`,
                            fontFamily: item.fontFamily === 'TimesRoman' ? 'serif' : item.fontFamily === 'Courier' ? 'monospace' : 'sans-serif',
                            fontWeight: item.isBold ? 'bold' : 'normal',
                            fontStyle: item.isItalic ? 'italic' : 'normal',
                            color: colorCss,
                          }}
                        >
                          {item.text}
                        </div>
                      ) : isDeleted ? (
                        /* Deleted Text Marker */
                        <div
                          className="px-1 leading-none text-red-600 bg-white"
                          style={{ fontSize: `${scaledFontSize}px` }}
                        >
                          {item.text}
                        </div>
                      ) : (
                        /* Transparent Hover Hitbox over Original PDF Canvas */
                        <div
                          className="w-full h-full opacity-0 hover:opacity-100 flex items-center justify-end px-1"
                          title="Click to edit this text"
                        >
                          <Edit3 className="w-3 h-3 text-cyan-600 opacity-60" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
