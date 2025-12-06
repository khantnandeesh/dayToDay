import { X, Download, FileText, Image as ImageIcon, Film, Loader } from 'lucide-react';

const FilePreview = ({ file, url, onClose, loading }) => {
    if (!file) return null;

    const { mimeType, name } = file;

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex flex-col items-center gap-4">
                    <Loader className="w-12 h-12 text-white animate-spin" />
                    <p className="text-white/80 font-medium">Loading preview...</p>
                </div>
            );
        }

        if (!url) return null;

        if (mimeType.startsWith('image/')) {
            return (
                <img
                    src={url}
                    alt={name}
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                />
            );
        }

        if (mimeType.startsWith('video/')) {
            return (
                <video
                    controls
                    autoPlay
                    className="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
                >
                    <source src={url} type={mimeType} />
                    Your browser does not support the video tag.
                </video>
            );
        }

        if (mimeType === 'application/pdf') {
            return (
                <iframe
                    src={`${url}#toolbar=0`}
                    className="w-full h-[80vh] bg-white rounded-lg shadow-2xl"
                    title="PDF Preview"
                />
            );
        }

        if (mimeType.startsWith('text/')) {
            return (
                <div className="bg-white p-6 rounded-lg shadow-2xl max-w-4xl w-full h-[80vh] overflow-auto">
                    <iframe src={url} className="w-full h-full border-none" sandbox />
                </div>
            );
        }

        // Fallback
        return (
            <div className="bg-white p-8 rounded-xl shadow-2xl flex flex-col items-center text-center max-w-md">
                <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mb-6">
                    <FileText className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">No Preview Available</h3>
                <p className="text-slate-500 mb-6">
                    This file type ({mimeType}) cannot be previewed directly in the browser.
                </p>
                <a
                    href={url}
                    download={name}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition flex items-center gap-2"
                >
                    <Download className="w-5 h-5" /> Download File
                </a>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fadeIn">
            {/* Toolbar */}
            <div className="absolute top-4 right-4 flex items-center gap-4 z-50">
                <a
                    href={url}
                    download
                    className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition"
                    title="Download"
                >
                    <Download className="w-6 h-6" />
                </a>
                <button
                    onClick={onClose}
                    className="p-2 bg-white/10 hover:bg-red-500/80 text-white rounded-full transition"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Header / Title */}
            <div className="absolute top-4 left-4 text-white z-50 max-w-[80vw]">
                <h2 className="text-lg font-medium truncate flex items-center gap-2">
                    {mimeType.startsWith('image/') ? <ImageIcon className="w-4 h-4" /> :
                        mimeType.startsWith('video/') ? <Film className="w-4 h-4" /> :
                            <FileText className="w-4 h-4" />}
                    {name}
                </h2>
            </div>

            {/* Content Area */}
            <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
                <div className="pointer-events-auto">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default FilePreview;
