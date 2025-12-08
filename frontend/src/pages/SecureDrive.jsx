import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import {
    HardDrive, Folder, FileText, Image as ImageIcon, Film,
    MoreVertical, Download, Trash2, Plus, ArrowLeft, Search, Loader, Cloud, Share2, RotateCcw, Edit2, X, XCircle
} from 'lucide-react';
import api from '../config/api';
import UploadProgress from '../components/drive/UploadProgress';
import FilePreview from '../components/drive/FilePreview';
import axios from 'axios';

const SecureDrive = () => {
    const [currentFolder, setCurrentFolder] = useState(null); // null = root
    const [folderStack, setFolderStack] = useState([{ id: null, name: 'My Drive' }]);

    // Data State
    const [files, setFiles] = useState([]);
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(true);

    // Cache State for specialized speed
    const [contentCache, setContentCache] = useState({});

    // Upload Manager State
    const [uploads, setUploads] = useState([]);
    const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(true);

    // Usage stats
    const [usage, setUsage] = useState(0);
    const [totalQuota, setTotalQuota] = useState(5368709120); // 5GB

    const [viewTrash, setViewTrash] = useState(false);
    const [preview, setPreview] = useState(null);
    const [previewCache, setPreviewCache] = useState({});

    useEffect(() => {
        fetchContent();
    }, [currentFolder, viewTrash]);

    const fetchContent = async (forceRefresh = false) => {
        const cacheKey = `${viewTrash ? 'trash' : 'folder'}-${currentFolder || 'root'}`;

        // 1. Try Cache (Fast Path)
        if (!forceRefresh && contentCache[cacheKey]) {
            const cached = contentCache[cacheKey];
            setFiles(cached.files);
            setFolders(cached.folders);
            // Don't overwrite usage stats from cache to keep it fresh-ish, or do?
            // Better to keep UI snappy.
            setLoading(false);
            return;
        }

        // 2. Fetch API (Slow Path)
        setLoading(true);
        try {
            const params = { trash: viewTrash };
            if (!viewTrash) {
                params.folderId = currentFolder || 'root';
            }
            const res = await api.get('/drive/content', { params });

            setFiles(res.data.files);
            setFolders(res.data.folders);

            if (res.data.usage !== undefined) setUsage(res.data.usage);
            if (res.data.total) setTotalQuota(res.data.total);

            // 3. Update Cache
            setContentCache(prev => ({
                ...prev,
                [cacheKey]: { files: res.data.files, folders: res.data.folders }
            }));

        } catch (error) {
            console.error("Error fetching drive content", error);
        } finally {
            setLoading(false);
        }
    };

    // Helper to invalidate cache on mutations
    const invalidateAndRefresh = () => {
        setContentCache({}); // Clear entire cache to ensure consistency
        fetchContent(true);
    };

    const handleFolderClick = (folder) => {
        setFolderStack([...folderStack, folder]);
        setCurrentFolder(folder.id); // Optimized navigation will now hit cache if available
    };

    const handleBreadcrumbClick = (index) => {
        const newStack = folderStack.slice(0, index + 1);
        setFolderStack(newStack);
        setCurrentFolder(newStack[newStack.length - 1].id);
    };

    const handleCreateFolder = async () => {
        const name = prompt("Enter folder name:");
        if (!name) return;
        try {
            await api.post('/drive/folder', { name, parentId: currentFolder });
            invalidateAndRefresh();
        } catch (error) {
            alert("Failed to create folder");
        }
    };

    const updateUpload = (id, updates) => {
        setUploads(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    };

    const formatSpeed = (bytesPerSec) => {
        if (bytesPerSec === 0) return '0 KB/s';
        const k = 1024;
        const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
        return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const processUpload = async (uploadItem) => {
        const { id, file, name, targetFolderId } = uploadItem;
        updateUpload(id, { status: 'uploading' });

        let lastLoaded = 0;
        let lastTime = Date.now();

        try {
            // 1. Get Presigned URL
            const { data: { url, key } } = await api.post('/drive/upload-url', {
                name,
                size: file.size,
                mimeType: file.type || 'application/octet-stream',
                folderId: targetFolderId
            });

            // 2. Upload to R2
            const uploadInstance = axios.create();
            delete uploadInstance.defaults.headers.common['Authorization'];

            await uploadInstance.put(url, file, {
                headers: { 'Content-Type': file.type || 'application/octet-stream' },
                onUploadProgress: (progressEvent) => {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    const now = Date.now();
                    const timeDiff = (now - lastTime) / 1000;

                    if (timeDiff >= 0.5) {
                        const loadedDiff = progressEvent.loaded - lastLoaded;
                        const speedBytes = loadedDiff / timeDiff;
                        const speed = formatSpeed(speedBytes);

                        lastLoaded = progressEvent.loaded;
                        lastTime = now;
                        updateUpload(id, { progress: percent, speed });
                    } else {
                        updateUpload(id, { progress: percent });
                    }
                }
            });

            // 3. Finalize
            await api.post('/drive/finalize', {
                name,
                size: file.size,
                mimeType: file.type || 'application/octet-stream',
                key,
                folderId: targetFolderId
            });

            updateUpload(id, { status: 'completed', progress: 100, speed: 'Complete' });

            // Invalidate cache globaly to reflect storage usage and file list changes
            setContentCache({});

            // Only force visual refresh if we are strictly watching the target folder
            if (targetFolderId === currentFolder) {
                fetchContent(true);
            }

        } catch (error) {
            console.error("Upload failed", error);
            updateUpload(id, { status: 'error', speed: 'Failed' });
        }
    };

    const [isDragging, setIsDragging] = useState(false);

    // ... (previous helper fns) ...

    const processFiles = (files) => {
        if (files.length === 0) return;

        const newItems = files.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            name: file.name,
            progress: 0,
            status: 'queued',
            speed: 'Preparing...',
            targetFolderId: currentFolder
        }));

        setUploads(prev => [...newItems, ...prev]);
        setIsUploadPanelOpen(true);
        newItems.forEach(item => processUpload(item));
    };

    const handleFileUpload = (event) => {
        const fileList = Array.from(event.target.files);
        processFiles(fileList);
        event.target.value = null;
    };

    // Drag & Drop Handlers
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        processFiles(files);
    };

    const handleDelete = async (id, type) => {
        if (!confirm("Are you sure you want to delete this item?")) return;
        try {
            await api.post('/drive/delete', { id, type });
            invalidateAndRefresh();
        } catch (error) {
            alert("Failed to delete");
        }
    };

    const handleDownload = async (file) => {
        try {
            const res = await api.get(`/drive/file/${file._id}/url?download=true`);
            // Create invisible link to trigger download
            const link = document.createElement('a');
            link.href = res.data.url;
            link.setAttribute('download', file.name); // Hint to browser
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            alert("Failed to get download URL");
        }
    };

    const handleShare = async (id) => {
        try {
            const res = await api.post('/drive/share', { id });
            await navigator.clipboard.writeText(res.data.shareUrl);
            alert("Public link copied to clipboard!\n" + res.data.shareUrl);
        } catch (error) {
            alert("Share failed");
        }
    };

    const handleRestore = async (id, type) => {
        try {
            await api.post('/drive/restore', { id, type });
            invalidateAndRefresh();
        } catch (error) {
            alert("Restore failed");
        }
    };

    const handleRename = async (id, type, currentName) => {
        const newName = prompt("Rename item:", currentName);
        if (!newName || newName === currentName) return;

        try {
            await api.post('/drive/rename', { id, type, name: newName });
            invalidateAndRefresh();
        } catch (error) {
            alert("Rename failed");
        }
    };

    const handleDeletePermanent = async (id, type) => {
        if (!confirm("This will permanently delete the item. Are you sure?")) return;
        try {
            await api.post('/drive/delete-permanent', { id, type });
            invalidateAndRefresh();
        } catch (error) {
            alert("Permanent deletion failed");
        }
    };

    const handleRevokeShare = async (id) => {
        if (!confirm("Revoke public access? The link will verify work.")) return;
        try {
            await api.post('/drive/revoke-share', { id });
            alert("Access revoked");
            invalidateAndRefresh();
        } catch (error) {
            alert("Failed to revoke access");
        }
    };

    const handlePreview = async (file) => {
        // 1. Check Cache
        const cached = previewCache[file._id];
        if (cached && cached.expiresAt > Date.now()) {
            setPreview({ file, url: cached.url, loading: false });
            return;
        }

        // Show loading immediately
        setPreview({ file, loading: true });

        // 2. Fetch if stale/missing
        try {
            const res = await api.get(`/drive/file/${file._id}/url`);
            const url = res.data.url;

            // Cache for 55 minutes (backend expires in 60m)
            setPreviewCache(prev => ({
                ...prev,
                [file._id]: { url, expiresAt: Date.now() + 55 * 60 * 1000 }
            }));

            setPreview({ file, url, loading: false });
        } catch (error) {
            console.error(error);
            alert("Failed to load preview");
            setPreview(null);
        }
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileIcon = (mime) => {
        if (mime.includes('image')) return <ImageIcon className="w-8 h-8 text-purple-500" />;
        if (mime.includes('video')) return <Film className="w-8 h-8 text-rose-500" />;
        return <FileText className="w-8 h-8 text-blue-500" />;
    };

    return (
        <div
            className="min-h-screen bg-slate-50 font-sans relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <Navbar />

            {/* Drag Overlay */}
            {isDragging && !viewTrash && (
                <div className="fixed inset-0 z-50 bg-blue-500/10 backdrop-blur-sm border-4 border-blue-500 border-dashed m-4 rounded-3xl flex flex-col items-center justify-center animate-fade-in pointer-events-none">
                    <Cloud className="w-24 h-24 text-blue-600 mb-4 animate-bounce" />
                    <h2 className="text-3xl font-bold text-blue-700">Drop files to upload</h2>
                    <p className="text-blue-600 mt-2">to {folderStack[folderStack.length - 1].name}</p>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-4 py-8 md:px-8 pb-32">

                {/* Header Stats */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <HardDrive className="w-6 h-6" /> {viewTrash ? 'Trash' : 'Secure Drive'}
                        </h1>
                        <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                            <Cloud className="w-4 h-4" />
                            {formatSize(usage)} used of {formatSize(totalQuota)}
                        </div>
                        {/* Progress Bar */}
                        <div className="w-48 h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                            <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${(usage / totalQuota) * 100}%` }}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { setViewTrash(!viewTrash); setCurrentFolder(null); }}
                            className={`p-2 rounded-lg transition ${viewTrash ? 'bg-red-100 text-red-600' : 'text-slate-500 hover:bg-slate-100'}`}
                            title={viewTrash ? "Exit Trash" : "View Trash"}
                        >
                            {viewTrash ? <ArrowLeft className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                        </button>

                        {!viewTrash && (
                            <>
                                <button
                                    onClick={handleCreateFolder}
                                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition flex items-center gap-2"
                                >
                                    <Folder className="w-4 h-4" /> New Folder
                                </button>
                                <label className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition cursor-pointer flex items-center gap-2">
                                    <Plus className="w-4 h-4" />
                                    Upload File
                                    <input
                                        type="file"
                                        multiple
                                        className="hidden"
                                        onChange={handleFileUpload}
                                    />
                                </label>
                            </>
                        )}
                    </div>
                </div>

                {/* Breadcrumbs (only if not trash) */}
                {!viewTrash && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-6 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                        {folderStack.map((folder, idx) => (
                            <div key={idx} className="flex items-center whitespace-nowrap">
                                <button
                                    onClick={() => handleBreadcrumbClick(idx)}
                                    className={`hover:text-blue-600 font-medium transition ${idx === folderStack.length - 1 ? 'text-slate-900 font-bold' : ''}`}
                                >
                                    {folder.name}
                                </button>
                                {idx < folderStack.length - 1 && <span className="mx-2 text-slate-400">/</span>}
                            </div>
                        ))}
                    </div>
                )}

                {/* Content Area */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[60vh] relative p-6">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                    ) : (files.length === 0 && folders.length === 0) ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                                <Plus className="w-8 h-8 opacity-20" />
                            </div>
                            <p>{viewTrash ? 'Trash is empty' : 'This folder is empty'}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {/* Folders */}
                            {folders.map(folder => (
                                <div
                                    key={folder._id}
                                    onDoubleClick={() => !viewTrash && handleFolderClick({ id: folder._id, name: folder.name })}
                                    className={`group p-4 h-48 bg-slate-50 border border-transparent rounded-xl transition-all flex flex-col items-center justify-center text-center relative ${!viewTrash ? 'hover:bg-blue-50 hover:border-blue-200 cursor-pointer' : 'cursor-default opacity-80'}`}
                                >
                                    <Folder className="w-16 h-16 text-slate-400 group-hover:text-blue-500 mb-3 transition-colors" />
                                    <span className="text-sm font-medium text-slate-700 truncate w-full px-2">{folder.name}</span>

                                    {viewTrash ? (
                                        <div className="absolute top-2 right-2 flex gap-1 group-hover:opacity-100 transition-all">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRestore(folder._id, 'folder'); }}
                                                className="p-1.5 text-slate-400 hover:text-green-500 hover:bg-green-50 rounded-lg"
                                                title="Restore"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeletePermanent(folder._id, 'folder'); }}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                                title="Delete Forever"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRename(folder._id, 'folder', folder.name); }}
                                                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"
                                                title="Rename"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(folder._id, 'folder'); }}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                                title="Move to Trash"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Files */}
                            {files.map(file => (
                                <div
                                    key={file._id}
                                    onDoubleClick={() => handlePreview(file)}
                                    className="group p-4 bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md rounded-xl cursor-default transition-all flex flex-col items-center text-center relative select-none"
                                >
                                    <div className="mb-3 transform group-hover:scale-105 transition-transform w-full flex justify-center">
                                        {file.thumbUrl ? (
                                            <img
                                                src={file.thumbUrl}
                                                className="w-full h-32 object-cover rounded-lg shadow-sm"
                                                alt={file.name}
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="w-full h-32 flex items-center justify-center bg-slate-50 rounded-lg">
                                                {getFileIcon(file.mimeType)}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-sm font-medium text-slate-700 truncate w-full mb-1">{file.name}</span>
                                    <span className="text-[10px] text-slate-400">{formatSize(file.size)}</span>

                                    <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all bg-white/90 rounded-lg p-1 shadow-sm">
                                        {viewTrash ? (
                                            <>
                                                <button
                                                    onClick={() => handleRestore(file._id, 'file')}
                                                    className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-md"
                                                    title="Restore"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePermanent(file._id, 'file')}
                                                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                                                    title="Delete Forever"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleDownload(file)}
                                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                                                    title="Download/Preview"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                </button>

                                                <button
                                                    onClick={() => handleShare(file._id)}
                                                    className={`p-1.5 rounded-md ${file.isPublic ? 'text-green-600 bg-green-50' : 'text-slate-500 hover:text-green-600 hover:bg-green-50'}`}
                                                    title={file.isPublic ? "Copy Public Link" : "Share Public Link"}
                                                >
                                                    <Share2 className="w-3.5 h-3.5" />
                                                </button>

                                                {file.isPublic && (
                                                    <button
                                                        onClick={() => handleRevokeShare(file._id)}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"
                                                        title="Revoke Public Access"
                                                    >
                                                        <XCircle className="w-3.5 h-3.5" />
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => handleRename(file._id, 'file', file.name)}
                                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                                                    title="Rename"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(file._id, 'file')}
                                                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Upload Progress Panel */}
            <UploadProgress
                uploads={uploads}
                onClose={() => setUploads([])}
            />

            {/* File Preview Modal */}
            {preview && (
                <FilePreview
                    file={preview.file}
                    url={preview.url}
                    loading={preview.loading}
                    onClose={() => setPreview(null)}
                />
            )}
        </div>
    );
};

export default SecureDrive;
