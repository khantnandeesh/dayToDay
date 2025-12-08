import { useState } from 'react';
import { X, Plus, Trash2, Save, Monitor, Film, Gamepad, ShoppingCart, Briefcase, Mail, Key } from 'lucide-react';
import { useVault } from '../../context/VaultContext';

const ICONS = [
    { id: 'monitor', icon: Monitor },
    { id: 'film', icon: Film },
    { id: 'gamepad', icon: Gamepad },
    { id: 'cart', icon: ShoppingCart },
    { id: 'briefcase', icon: Briefcase },
    { id: 'mail', icon: Mail },
    { id: 'key', icon: Key }
];

const FIELD_TYPES = [
    { value: 'text', label: 'Text' },
    { value: 'password', label: 'Password' },
    { value: 'email', label: 'Email' },
    { value: 'url', label: 'URL' },
    { value: 'textarea', label: 'Long Text' },
    { value: 'date', label: 'Date' }
];

const VaultTemplateCreator = ({ isOpen, onClose }) => {
    const { createTemplate } = useVault();
    const [label, setLabel] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('monitor');
    const [fields, setFields] = useState([{ label: 'Username', type: 'text' }, { label: 'Password', type: 'password' }]);
    const [loading, setLoading] = useState(false);

    const addField = () => {
        setFields([...fields, { label: 'New Field', type: 'text' }]);
    };

    const removeField = (index) => {
        setFields(fields.filter((_, i) => i !== index));
    };

    const updateField = (index, key, value) => {
        const newFields = [...fields];
        newFields[index][key] = value;
        setFields(newFields);
    };

    const handleSubmit = async () => {
        if (!label.trim()) return alert('Please enter a category name');

        setLoading(true);
        const id = label.toLowerCase().replace(/[^a-z0-9]/g, '-');

        const success = await createTemplate({
            id,
            label,
            icon: selectedIcon,
            fields
        });

        setLoading(false);
        if (success) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900">New Category Template</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Category Name</label>
                        <input
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                            placeholder="e.g. Streaming Services"
                            autoFocus
                        />
                    </div>

                    {/* Icon */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Icon</label>
                        <div className="flex flex-wrap gap-2">
                            {ICONS.map(({ id, icon: Icon }) => (
                                <button
                                    key={id}
                                    onClick={() => setSelectedIcon(id)}
                                    className={`p-3 rounded-xl border transition-all ${selectedIcon === id
                                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                                >
                                    <Icon className="w-5 h-5" />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Fields */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-slate-700">Default Fields</label>
                            <button onClick={addField} className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Add Field
                            </button>
                        </div>
                        <div className="space-y-2">
                            {fields.map((field, index) => (
                                <div key={index} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={field.label}
                                        onChange={(e) => updateField(index, 'label', e.target.value)}
                                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                        placeholder="Label"
                                    />
                                    <select
                                        value={field.type}
                                        onChange={(e) => updateField(index, 'type', e.target.value)}
                                        className="w-24 px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                    >
                                        {FIELD_TYPES.map(ft => (
                                            <option key={ft.value} value={ft.value}>{ft.label}</option>
                                        ))}
                                    </select>
                                    <button onClick={() => removeField(index)} className="p-2 text-slate-400 hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2"
                    >
                        {loading ? 'Saving...' : (
                            <>
                                <Save className="w-4 h-4" />
                                Create Template
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VaultTemplateCreator;
