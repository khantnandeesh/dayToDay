import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, CheckCircle, AlertCircle, File, Minimize2, Maximize2 } from 'lucide-react';

const UploadProgress = ({ uploads, onClose }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    // Calculate summary stats
    const totalFiles = uploads.length;
    const completed = uploads.filter(u => u.status === 'completed').length;
    const uploading = uploads.filter(u => u.status === 'uploading').length;
    const progressSum = uploads.reduce((acc, curr) => acc + curr.progress, 0);
    const overallProgress = totalFiles > 0 ? progressSum / totalFiles : 0;

    // Radius for circular progress
    const radius = 10;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (overallProgress / 100) * circumference;

    if (uploads.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 w-96 bg-white rounded-t-xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden font-sans transition-all duration-300 ease-in-out">
            {/* Header */}
            <div
                className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">
                        {completed === totalFiles ? "Uploads complete" : `Uploading ${uploading} item${uploading !== 1 ? 's' : ''}`}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onClose(); }}>
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* List (Expanded) */}
            {isExpanded && (
                <div className="bg-white max-h-80 overflow-y-auto">
                    {uploads.map((upload) => (
                        <div key={upload.id} className="p-3 border-b border-slate-100 flex items-center gap-3 hover:bg-slate-50 transition">
                            {/* File Icon */}
                            <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                                <File className="w-4 h-4 text-slate-500" />
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-0.5">
                                    <p className="text-sm font-medium text-slate-700 truncate max-w-[150px]" title={upload.name}>
                                        {upload.name}
                                    </p>
                                    <span className="text-[10px] text-slate-400">
                                        {upload.status === 'completed' ? 'Done' :
                                            upload.status === 'error' ? 'Failed' :
                                                `${upload.speed || '0 KB/s'}`}
                                    </span>
                                </div>
                                {/* Progress Bar Line */}
                                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-300 ${upload.status === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}
                                        style={{ width: `${upload.progress}%` }}
                                    />
                                </div>
                            </div>

                            {/* Status Icon / Circle */}
                            <div className="flex-shrink-0">
                                {upload.status === 'completed' ? (
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                ) : upload.status === 'error' ? (
                                    <AlertCircle className="w-5 h-5 text-red-500" />
                                ) : (
                                    // Mini Circular Progress
                                    <div className="relative w-5 h-5 flex items-center justify-center">
                                        <svg className="transform -rotate-90 w-5 h-5">
                                            <circle
                                                cx="10"
                                                cy="10"
                                                r="8"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                fill="transparent"
                                                className="text-slate-200"
                                            />
                                            <circle
                                                cx="10"
                                                cy="10"
                                                r="8"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                fill="transparent"
                                                strokeDasharray={2 * Math.PI * 8}
                                                strokeDashoffset={(2 * Math.PI * 8) - ((upload.progress / 100) * (2 * Math.PI * 8))}
                                                className="text-blue-500 transition-all duration-300"
                                            />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default UploadProgress;
