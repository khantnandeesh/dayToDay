import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Search, Plus, Filter, Lock, ExternalLink,
    Copy, Trash2, Edit2, CreditCard, Globe,
    Wifi, HardDrive, FileText, LayoutGrid, Star,
    MoreVertical, Eye, Monitor, Film, Gamepad,
    ShoppingCart, Briefcase, Mail, Key, Settings, Shield
} from 'lucide-react';
import { useVault } from '../../context/VaultContext';
import VaultItemEditor from './VaultItemEditor';
import VaultItemDetails from './VaultItemDetails';
import VaultTemplateCreator from './VaultTemplateCreator';

const ICON_MAP = {
    monitor: Monitor,
    film: Film,
    gamepad: Gamepad,
    cart: ShoppingCart,
    briefcase: Briefcase,
    mail: Mail,
    key: Key,
    globe: Globe,
    bank: CreditCard,
    wifi: Wifi,
    note: FileText,
    wallet: HardDrive
};

const DEFAULT_CATEGORIES = [
    { id: 'all', label: 'All Items', icon: LayoutGrid },
    { id: 'website', label: 'Logins', icon: Globe },
    { id: 'bank', label: 'Finance', icon: CreditCard },
    { id: 'wifi', label: 'Wi-Fi', icon: Wifi },
    { id: 'note', label: 'Notes', icon: FileText },
    { id: 'wallet', label: 'Crypto', icon: HardDrive },
];

const VaultDashboard = () => {
    const { items, lockVault, createItem, updateItem, deleteItem, loading, customTemplates } = useVault();
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');

    // Modals
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [detailsItem, setDetailsItem] = useState(null);
    const [isTemplateCreatorOpen, setIsTemplateCreatorOpen] = useState(false);

    const [copiedField, setCopiedField] = useState(null);

    // Merge categories
    const allCategories = useMemo(() => {
        const custom = (customTemplates || []).map(t => ({
            id: t.id,
            label: t.label,
            icon: ICON_MAP[t.icon] || LayoutGrid // Fallback
        }));
        return [...DEFAULT_CATEGORIES, ...custom];
    }, [customTemplates]);

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchesCategory = category === 'all' || item.type === category;
            const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) ||
                item.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
            return matchesCategory && matchesSearch;
        });
    }, [items, category, search]);

    const handleCopy = (text, fieldId) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleSaveItem = async (data) => {
        if (data.id) {
            await updateItem(data.id, data);
        } else {
            await createItem(data);
        }
    };

    const handleDelete = async (id) => {
        if (confirm('Are you sure you want to delete this item?')) {
            await deleteItem(id);
        }
    };

    const getIconForType = (type) => {
        // Check custom templates first
        const custom = customTemplates?.find(t => t.id === type);
        if (custom) {
            const Icon = ICON_MAP[custom.icon] || LayoutGrid;
            return <Icon className="w-5 h-5" />;
        }

        switch (type) {
            case 'bank': return <CreditCard className="w-5 h-5" />;
            case 'wifi': return <Wifi className="w-5 h-5" />;
            case 'note': return <FileText className="w-5 h-5" />;
            case 'wallet': return <HardDrive className="w-5 h-5" />;
            default: return <Globe className="w-5 h-5" />;
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-auto md:h-[85vh] bg-white rounded-2xl shadow-xl border border-slate-200 md:overflow-hidden animate-fade-in relative">
            {/* Sidebar (Desktop) */}
            <div className="hidden md:flex w-64 bg-slate-50 border-r border-slate-200 flex-col">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-slate-800">My Vault</span>
                    <button
                        onClick={lockVault}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Lock Vault"
                    >
                        <Lock className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-2 space-y-1 overflow-y-auto flex-1">
                    {allCategories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setCategory(cat.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                                ${category === cat.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <cat.icon className="w-4 h-4" />
                            {cat.label}
                        </button>
                    ))}

                    <div className="pt-2 mt-2 border-t border-slate-200 px-2">
                        <button
                            onClick={() => setIsTemplateCreatorOpen(true)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors mb-4"
                        >
                            <Plus className="w-3 h-3" />
                            New Category
                        </button>

                        <Link to="/security" className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-100">
                            <Shield className="w-4 h-4 shrink-0" />
                            <span className="leading-tight">Why your data is safe?</span>
                        </Link>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200">
                    <button
                        onClick={() => { setEditingItem(null); setIsEditorOpen(true); }}
                        className="w-full py-2 bg-slate-900 text-white rounded-lg font-medium shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Item
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 relative">

                {/* Mobile Header */}
                <div className="md:hidden p-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
                    <span className="font-bold text-slate-800 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-slate-900" />
                        My Vault
                    </span>
                    <button
                        onClick={lockVault}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Lock Vault"
                    >
                        <Lock className="w-5 h-5" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-4 border-b border-slate-200 flex items-center gap-4 bg-white shrink-0">
                    <div className="relative flex-1 max-w-full md:max-w-md">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search vault..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none text-sm"
                        />
                    </div>
                </div>

                {/* Mobile Categories Scroll */}
                <div className="md:hidden px-4 pb-3 flex items-center gap-2 overflow-x-auto shrink-0 bg-white border-b border-slate-100 scrollbar-hide">
                    {allCategories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setCategory(cat.id)}
                            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all
                                ${category === cat.id ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}
                        >
                            {cat.label}
                        </button>
                    ))}
                    <button
                        onClick={() => setIsTemplateCreatorOpen(true)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-slate-300 text-slate-500 whitespace-nowrap"
                    >
                        + New
                    </button>
                </div>

                {/* Items List */}
                <div className="md:flex-1 md:overflow-y-auto p-4 space-y-4 bg-slate-50/50 min-h-[500px] md:min-h-0">
                    {filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 md:py-0 md:h-full text-slate-400">
                            <Filter className="w-12 h-12 mb-4 opacity-20" />
                            <p>No items found in {category === 'all' ? 'vault' : category}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {filteredItems.map(item => (
                                <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-50 rounded-lg text-slate-600">
                                                {getIconForType(item.type)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 line-clamp-1">{item.title}</h3>
                                                <span className="text-xs text-slate-500 capitalize">{item.type}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setDetailsItem(item)}
                                                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg"
                                                title="View Details"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Quick Fields (First 3 non-password) */}
                                    <div className="space-y-2">
                                        {item.fields?.slice(0, 3).map((field, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-sm group/field">
                                                <span className="text-slate-500 text-xs font-medium uppercase truncate max-w-[80px]">{field.label}</span>
                                                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                                                    <span className="truncate text-slate-700 font-mono bg-slate-50 px-1.5 rounded">
                                                        {field.type === 'password' ? '••••••••' : field.value}
                                                    </span>
                                                    {field.type !== 'password' && (
                                                        <button
                                                            onClick={() => handleCopy(field.value, `${item.id}-${idx}`)}
                                                            className="text-slate-300 hover:text-slate-600 opacity-0 group-hover/field:opacity-100 transition-opacity"
                                                            title="Copy"
                                                        >
                                                            {copiedField === `${item.id}-${idx}` ?
                                                                <span className="text-green-500 text-xs">✓</span> :
                                                                <Copy className="w-3.5 h-3.5" />
                                                            }
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Tags */}
                                    {item.tags && item.tags.length > 0 && (
                                        <div className="mt-4 pt-3 border-t border-slate-50 flex flex-wrap gap-2">
                                            {item.tags.map(tag => (
                                                <span key={tag} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Mobile FAB */}
                <button
                    onClick={() => { setEditingItem(null); setIsEditorOpen(true); }}
                    className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg shadow-slate-900/30 flex items-center justify-center z-40 hover:bg-slate-800 active:scale-95 transition-all"
                >
                    <Plus className="w-6 h-6" />
                </button>
            </div>

            {/* Modals */}
            <VaultItemEditor
                isOpen={isEditorOpen}
                onClose={() => { setIsEditorOpen(false); setEditingItem(null); }}
                initialData={editingItem}
                onSave={handleSaveItem}
            />

            <VaultItemDetails
                item={detailsItem}
                onClose={() => setDetailsItem(null)}
                onEdit={(item) => {
                    setDetailsItem(null);
                    setEditingItem(item); // Opens editor with item data
                    setIsEditorOpen(true);
                }}
            />

            <VaultTemplateCreator
                isOpen={isTemplateCreatorOpen}
                onClose={() => setIsTemplateCreatorOpen(false)}
            />
        </div>
    );
};

export default VaultDashboard;
