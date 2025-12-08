import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
    ZoomIn, ZoomOut, RotateCw, Download, Printer, Search,
    ChevronLeft, ChevronRight, Grid, X, Menu, Settings,
    Minimize, Maximize
} from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

const PDFViewer = ({ url, onClose, fileName = "Document.pdf" }) => {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [rotation, setRotation] = useState(0);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Search state (UI only for now)
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const containerRef = useRef(null);
    const contentRef = useRef(null);

    // Zoom presets
    const zoomLevels = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0];

    useEffect(() => {
        // Auto-fit width on load approx
        if (containerRef.current) {
            const width = containerRef.current.clientWidth;
            // setScale(width > 800 ? 1.0 : 0.6); // Simple heuristic
        }
    }, []);

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
        setLoading(false);
    };

    const onDocumentLoadError = (err) => {
        console.error("PDF Load Error:", err);
        setError(err);
        setLoading(false);
    };

    // Controls
    const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 5.0));
    const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.25));
    const rotate = () => setRotation(prev => (prev + 90) % 360);

    const changePage = (offset) => {
        setPageNumber(prev => Math.min(Math.max(prev + offset, 1), numPages || 1));
    };

    const handleWheel = (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            if (e.deltaY < 0) zoomIn();
            else zoomOut();
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // Print functionality
    const printPdf = () => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
    };

    return (
        <div
            ref={containerRef}
            className="flex flex-col h-full w-full bg-[#1a1a1a] text-white overflow-hidden relative"
            onWheel={handleWheel}
        >
            {/* 1. Top Toolbar (Adobe-like) */}
            <div className="flex items-center justify-between h-14 bg-[#2a2a2a] border-b border-gray-700 px-4 shadow-md z-20 select-none">
                {/* Left: Sidebar Toggle + Title */}
                <div className="flex items-center gap-4 w-1/4">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className={`p-2 rounded hover:bg-gray-700 transition ${sidebarOpen ? 'bg-gray-700' : ''}`}
                        title="Toggle Sidebar"
                    >
                        <Menu className="w-5 h-5 text-gray-300" />
                    </button>
                    <div className="truncate font-medium text-gray-200 text-sm" title={fileName}>
                        {fileName}
                    </div>
                </div>

                {/* Center: Pagination + Zoom */}
                <div className="flex items-center justify-center gap-2 flex-1">
                    {/* Pagination */}
                    <div className="flex items-center bg-[#1f1f1f] rounded-lg p-1 mr-4 border border-gray-700">
                        <button
                            onClick={() => changePage(-1)}
                            disabled={pageNumber <= 1}
                            className="p-1 hover:bg-gray-700 rounded disabled:opacity-30 transition"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="mx-3 text-sm font-mono text-gray-300">
                            {pageNumber} <span className="text-gray-500">/</span> {numPages || '--'}
                        </span>
                        <button
                            onClick={() => changePage(1)}
                            disabled={pageNumber >= (numPages || 1)}
                            className="p-1 hover:bg-gray-700 rounded disabled:opacity-30 transition"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Zoom */}
                    <div className="flex items-center bg-[#1f1f1f] rounded-lg p-1 border border-gray-700">
                        <button onClick={zoomOut} className="p-1 hover:bg-gray-700 rounded transition">
                            <ZoomOut className="w-4 h-4" />
                        </button>

                        <div className="relative group mx-2">
                            <span className="text-sm font-mono text-gray-300 cursor-pointer min-w-[3rem] text-center inline-block">
                                {Math.round(scale * 100)}%
                            </span>
                            {/* Dropdown on hover */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-24 bg-[#2a2a2a] border border-gray-700 rounded shadow-xl hidden group-hover:block py-1">
                                {zoomLevels.map(lvl => (
                                    <button
                                        key={lvl}
                                        onClick={() => setScale(lvl)}
                                        className="w-full text-left px-3 py-1 text-xs hover:bg-blue-600 text-gray-300"
                                    >
                                        {lvl * 100}%
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button onClick={zoomIn} className="p-1 hover:bg-gray-700 rounded transition">
                            <ZoomIn className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Right: Tools & Actions */}
                <div className="flex items-center justify-end gap-2 w-1/4">
                    <button onClick={rotate} className="p-2 hover:bg-gray-700 rounded transition text-gray-400 hover:text-white" title="Rotate">
                        <RotateCw className="w-5 h-5" />
                    </button>
                    <button onClick={() => setShowSearch(!showSearch)} className="p-2 hover:bg-gray-700 rounded transition text-gray-400 hover:text-white" title="Search">
                        <Search className="w-5 h-5" />
                    </button>
                    <div className="h-6 w-px bg-gray-600 mx-1"></div>
                    <button onClick={printPdf} className="p-2 hover:bg-gray-700 rounded transition text-gray-400 hover:text-white" title="Print">
                        <Printer className="w-5 h-5" />
                    </button>
                    <a href={url} download={fileName} className="p-2 hover:bg-gray-700 rounded transition text-gray-400 hover:text-white" title="Download">
                        <Download className="w-5 h-5" />
                    </a>
                    <button onClick={toggleFullscreen} className="p-2 hover:bg-gray-700 rounded transition text-gray-400 hover:text-white" title="Fullscreen">
                        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-red-600 rounded transition text-gray-400 hover:text-white bg-red-900/20 ml-2" title="Close">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Search Bar (Floating) */}
            {showSearch && (
                <div className="absolute top-16 right-4 z-30 bg-[#2a2a2a] p-2 rounded shadow-xl border border-gray-700 flex gap-2 animate-slide-down">
                    <input
                        type="text"
                        placeholder="Find in document..."
                        className="bg-[#1a1a1a] border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500 w-48"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                    <div className="flex text-gray-400 text-xs items-center px-1">
                        0/0
                    </div>
                </div>
            )}

            {/* Main Area & Document Context */}
            <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                className="flex flex-1 overflow-hidden relative w-full"
                loading={null}
                error={null}
            >

                {/* 2. Sidebar (Thumbnails) */}
                <div className={`
                    ${sidebarOpen ? 'w-64 border-r border-gray-700' : 'w-0'} 
                    bg-[#222] transition-all duration-300 flex flex-col overflow-hidden shrink-0
                `}>
                    <div className="p-4 border-b border-gray-700 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Thumbnails
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {numPages && Array.from(new Array(numPages), (el, index) => (
                            <div
                                key={`thumb_${index + 1}`}
                                onClick={() => setPageNumber(index + 1)}
                                className={`
                                    cursor-pointer rounded-lg p-2 transition group
                                    ${pageNumber === index + 1 ? 'bg-blue-600/20 ring-1 ring-blue-500' : 'hover:bg-white/5'}
                                `}
                            >
                                <div className="relative aspect-[1/1.4] bg-white rounded overflow-hidden opacity-80 group-hover:opacity-100 transition">
                                    <Page
                                        pageNumber={index + 1}
                                        width={200}
                                        renderTextLayer={false}
                                        renderAnnotationLayer={false}
                                        className="w-full h-full object-contain"
                                        loading={<div className="w-full h-full bg-gray-800 animate-pulse" />}
                                    />
                                </div>
                                <div className="text-center text-xs mt-2 text-gray-400 font-mono">
                                    {index + 1}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. Main Viewer */}
                <div
                    ref={contentRef}
                    className="flex-1 overflow-auto bg-[#1a1a1a] relative flex justify-center p-8 custom-scrollbar"
                >
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-gray-400 font-medium">Loading PDF...</span>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                            <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-xl text-center max-w-md">
                                <h3 className="text-red-400 font-bold mb-2">Failed to load PDF</h3>
                                <p className="text-red-200/70 text-sm mb-4">{error.message}</p>
                                <button onClick={onClose} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">
                                    Close Viewer
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="shadow-2xl relative">
                        <Page
                            pageNumber={pageNumber}
                            scale={scale}
                            rotate={rotation}
                            className="shadow-2xl"
                            loading={
                                <div
                                    style={{ width: 600 * scale, height: 800 * scale }}
                                    className="bg-white/5 animate-pulse rounded"
                                />
                            }
                            renderAnnotationLayer={true}
                            renderTextLayer={true}
                        />
                    </div>
                </div>
            </Document>
        </div>
    );
};

export default PDFViewer;
