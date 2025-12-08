import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Save, RefreshCw, Copy, Check } from 'lucide-react';
import { useVault } from '../../context/VaultContext';

const TEMPLATES = {
    website: {
        label: 'Website Login',
        fields: [
            { label: 'Website URL', value: '', type: 'url' },
            { label: 'Username/Email', value: '', type: 'text' },
            { label: 'Password', value: '', type: 'password' },
        ]
    },
    bank: {
        label: 'Bank Account',
        fields: [
            { label: 'Bank Name', value: '', type: 'text' },
            { label: 'Account Number', value: '', type: 'text' },
            { label: 'IFSC/Routing', value: '', type: 'text' },
            { label: 'Password', value: '', type: 'password' },
        ]
    },
    wifi: {
        label: 'Wi-Fi',
        fields: [
            { label: 'Network Name (SSID)', value: '', type: 'text' },
            { label: 'Password', value: '', type: 'password' },
            { label: 'Security Type', value: 'WPA2', type: 'text' },
        ]
    },
    wallet: {
        label: 'Crypto Wallet',
        fields: [
            { label: 'Wallet Name', value: '', type: 'text' },
            { label: 'Seed Phrase', value: '', type: 'textarea' },
            { label: 'Private Key', value: '', type: 'password' },
        ]
    },
    note: {
        label: 'Secure Note',
        fields: [
            { label: 'Content', value: '', type: 'textarea' },
        ]
    }
};

const FIELD_TYPES = [
    { value: 'text', label: 'Text' },
    { value: 'password', label: 'Password' },
    { value: 'email', label: 'Email' },
    { value: 'url', label: 'URL' },
    { value: 'textarea', label: 'Long Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' }
];

const VaultItemEditor = ({ isOpen, onClose, initialData, onSave }) => {
    const { customTemplates } = useVault();
    const [title, setTitle] = useState('');
    const [type, setType] = useState('website');
    const [fields, setFields] = useState([]);
    const [tags, setTags] = useState([]);
    const [notes, setNotes] = useState('');
    const [tagInput, setTagInput] = useState('');

    const allTemplates = useMemo(() => {
        const custom = (customTemplates || []).reduce((acc, t) => {
            acc[t.id] = t;
            return acc;
        }, {});
        return { ...TEMPLATES, ...custom };
    }, [customTemplates]);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Edit mode
                setTitle(initialData.title);
                setType(initialData.type);
                setFields(initialData.fields || []);
                setTags(initialData.tags || []);
                setNotes(initialData.notes || []);
            } else {
                // New mode
                resetForm('website');
            }
        }
    }, [isOpen, initialData]);

    const resetForm = (newType) => {
        setTitle('');
        setType(newType);
        // Ensure values are initialized even for custom templates
        const newFields = (allTemplates[newType]?.fields || []).map(f => ({
            label: f.label,
            type: f.type,
            value: f.value || ''
        }));
        setFields(newFields);
        setTags([]);
        setNotes('');
    };

    const handleTypeChange = (newType) => {
        if (initialData) return; // Can't change type when editing (simplification)
        setType(newType);
        // Preserve title but reset fields
        const newFields = (allTemplates[newType]?.fields || []).map(f => ({
            label: f.label,
            type: f.type,
            value: f.value || ''
        }));
        setFields(newFields);
    };

    const updateField = (index, key, value) => {
        const newFields = [...fields];
        newFields[index][key] = value;
        setFields(newFields);
    };

    const addField = () => {
        setFields([...fields, { label: 'New Field', value: '', type: 'text' }]);
    };

    const removeField = (index) => {
        setFields(fields.filter((_, i) => i !== index));
    };

    const generatePassword = (index) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
        let pass = '';
        for (let i = 0; i < 16; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        updateField(index, 'value', pass);
    };

    const handleAddTag = (e) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!tags.includes(tagInput.trim())) {
                setTags([...tags, tagInput.trim()]);
            }
            setTagInput('');
        }
    };

    const handleRemoveTag = (tagToRemove) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    const handleSave = () => {
        if (!title.trim()) {
            alert('Title is required');
            return;
        }
        onSave({
            id: initialData?.id,
            type,
            title,
            fields,
            tags,
            notes
        });
        onClose();
    };

    if (!isOpen) return null;


    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900">
                        {initialData ? 'Edit Item' : 'New Item'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                            <select
                                value={type}
                                onChange={(e) => handleTypeChange(e.target.value)}
                                disabled={!!initialData}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                            >
                                {Object.entries(allTemplates).map(([key, tpl]) => (
                                    <option key={key} value={key}>{tpl.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                                placeholder="e.g. My Main Bank"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Dynamic Fields */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-900">Fields</h3>
                        </div>

                        {fields.map((field, index) => (
                            <div key={index} className="flex flex-col gap-2 p-4 bg-slate-50 rounded-xl border border-slate-100 group">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    {field.label}
                                </span>

                                <div className="relative">
                                    {field.type === 'textarea' ? (
                                        <textarea
                                            value={field.value}
                                            onChange={(e) => updateField(index, 'value', e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm"
                                            rows={3}
                                        />
                                    ) : (
                                        <input
                                            type={field.type === 'password' ? 'text' : field.type}
                                            value={field.value}
                                            onChange={(e) => updateField(index, 'value', e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm"
                                        />
                                    )}

                                    {field.type === 'password' && (
                                        <button
                                            onClick={() => generatePassword(index)}
                                            className="absolute right-2 top-1.5 p-1 text-xs font-medium text-slate-500 hover:text-slate-900 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
                                            title="Generate Strong Password"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tags</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {tags.map(tag => (
                                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                                    {tag}
                                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                                </span>
                            ))}
                        </div>
                        <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={handleAddTag}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm"
                            placeholder="Add tags (press Enter)"
                        />
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2">
                        <Save className="w-4 h-4" />
                        Save Item
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VaultItemEditor;
