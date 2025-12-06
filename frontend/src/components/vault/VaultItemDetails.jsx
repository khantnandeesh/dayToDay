import { useState } from 'react';
import { X, Copy, Eye, EyeOff, Edit2, CreditCard, Globe, Wifi, HardDrive, FileText } from 'lucide-react';

const VaultItemDetails = ({ item, onClose, onEdit }) => {
    const [visibleFields, setVisibleFields] = useState({});
    const [copiedField, setCopiedField] = useState(null);

    const toggleVisibility = (idx) => {
        setVisibleFields(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    const handleCopy = (text, idx) => {
        navigator.clipboard.writeText(text);
        setCopiedField(idx);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const getIconForType = (type) => {
        switch (type) {
            case 'bank': return <CreditCard className="w-8 h-8" />;
            case 'wifi': return <Wifi className="w-8 h-8" />;
            case 'note': return <FileText className="w-8 h-8" />;
            case 'wallet': return <HardDrive className="w-8 h-8" />;
            default: return <Globe className="w-8 h-8" />;
        }
    };

    if (!item) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden">
                <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-700">
                            {getIconForType(item.type)}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">{item.title}</h2>
                            <p className="text-sm text-slate-500 capitalize">{item.type}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                    {/* Notes */}
                    {item.notes && (
                        <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl text-sm text-yellow-800">
                            <strong>Note:</strong> {item.notes}
                        </div>
                    )}

                    {/* Fields */}
                    <div className="space-y-4">
                        {item.fields?.map((field, idx) => (
                            <div key={idx} className="group">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                                    {field.label}
                                </label>
                                <div className="relative flex items-center">
                                    <div className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium font-mono">
                                        {field.type === 'password' && !visibleFields[idx] ? '••••••••••••' : field.value}
                                    </div>

                                    <div className="absolute right-2 flex items-center gap-1">
                                        {field.type === 'password' && (
                                            <button
                                                onClick={() => toggleVisibility(idx)}
                                                className="p-1.5 text-slate-400 hover:text-slate-800 transition-colors"
                                                title={visibleFields[idx] ? "Hide" : "Show"}
                                            >
                                                {visibleFields[idx] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleCopy(field.value, idx)}
                                            className="p-1.5 text-slate-400 hover:text-slate-800 transition-colors"
                                            title="Copy"
                                        >
                                            {copiedField === idx ? <span className="text-green-500 font-bold text-xs px-1">✓</span> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Tags */}
                    {item.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                            {item.tags.map(tag => (
                                <span key={tag} className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors">
                        Close
                    </button>
                    <button
                        onClick={() => { onClose(); onEdit(item); }}
                        className="px-5 py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2"
                    >
                        <Edit2 className="w-4 h-4" />
                        Edit Item
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VaultItemDetails;
