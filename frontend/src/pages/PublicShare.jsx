import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Download, FileText, Image as ImageIcon, Film, Loader, Shield } from 'lucide-react';
import api from '../config/api';

const PublicShare = () => {
    const { token } = useParams();
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchFile = async () => {
            try {
                const res = await api.get(`/drive/public/${token}`);
                setFile(res.data);
            } catch (err) {
                setError("Link invalid or expired");
            } finally {
                setLoading(false);
            }
        };
        fetchFile();
    }, [token]);

    const handleDownload = () => {
        if (file?.url) window.location.href = file.url;
    };

    const formatSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileIcon = (mime) => {
        if (!mime) return <FileText className="w-16 h-16 text-slate-400" />;
        if (mime.includes('image')) return <ImageIcon className="w-16 h-16 text-purple-500" />;
        if (mime.includes('video')) return <Film className="w-16 h-16 text-rose-500" />;
        return <FileText className="w-16 h-16 text-blue-500" />;
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <Loader className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h1>
                <p className="text-slate-500">{error}</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-1/2 bg-slate-900 z-0"></div>

            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl relative z-10 overflow-hidden">
                <div className="p-8 text-center border-b border-slate-100">
                    <div className="w-24 h-24 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                        {getFileIcon(file.mimeType)}
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2 break-all">{file.name}</h1>
                    <p className="text-slate-500 font-medium">{formatSize(file.size)}</p>
                </div>

                <div className="p-8 bg-slate-50">
                    <button
                        onClick={handleDownload}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-600/30 transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                        <Download className="w-6 h-6" />
                        Download File
                    </button>
                    <p className="text-center text-xs text-slate-400 mt-6 flex items-center justify-center gap-1">
                        <Shield className="w-3 h-3" /> Securely shared via DayToDay Drive
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PublicShare;
