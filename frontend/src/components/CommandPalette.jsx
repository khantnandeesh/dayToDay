import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, LayoutDashboard, Shield, HardDrive, User, LogOut,
    Command, ArrowRight, FileText, Lock, Unlock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';

const CommandPalette = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const navigate = useNavigate();
    const { logout } = useAuth();
    const inputRef = useRef(null);
    const listRef = useRef(null);

    // Actions List
    const actions = [
        {
            id: 'dashboard',
            label: 'Go to Dashboard',
            icon: LayoutDashboard,
            type: 'navigation',
            path: '/dashboard',
            shortcut: 'G D'
        },
        {
            id: 'passwords',
            label: 'Password Manager',
            icon: Shield,
            type: 'navigation',
            path: '/passwords',
            shortcut: 'G P'
        },
        {
            id: 'drive',
            label: 'Secure Drive',
            icon: HardDrive,
            type: 'navigation',
            path: '/drive',
            shortcut: 'G S'
        },
        {
            id: 'profile',
            label: 'User Profile',
            icon: User,
            type: 'navigation',
            path: '/profile',
            shortcut: 'G U'
        },
        {
            id: 'security',
            label: 'Security Explained',
            icon: Lock,
            type: 'navigation',
            path: '/security',
        },
        {
            id: 'logout',
            label: 'Sign Out',
            icon: LogOut,
            type: 'action',
            action: async () => {
                try {
                    await api.post('/auth/logout');
                    logout();
                    navigate('/login');
                } catch {
                    logout();
                    navigate('/login');
                }
            },
            danger: true
        }
    ];

    const filteredActions = actions.filter(action =>
        action.label.toLowerCase().includes(query.toLowerCase())
    );

    // Reset selection when query changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    // Focus input on open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
            setQuery('');
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredActions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredActions.length) % filteredActions.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                executeAction(filteredActions[selectedIndex]);
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredActions, selectedIndex]);

    const executeAction = (action) => {
        if (!action) return;

        onClose();
        if (action.type === 'navigation') {
            navigate(action.path);
        } else if (action.type === 'action') {
            action.action();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden animate-slide-down border border-slate-200">

                {/* Search Header */}
                <div className="flex items-center px-4 py-3 border-b border-slate-100">
                    <Search className="w-5 h-5 text-slate-400 mr-3" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 text-lg bg-transparent border-none focus:ring-0 placeholder-slate-400 text-slate-800 outline-none h-8"
                        placeholder="Type a command or search..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <div className="hidden sm:flex items-center gap-1">
                        <kbd className="px-2 py-1 text-xs font-semibold text-slate-500 bg-slate-100 rounded border border-slate-200">ESC</kbd>
                    </div>
                </div>

                {/* Results */}
                <div className="max-h-[60vh] overflow-y-auto p-2" ref={listRef}>
                    {filteredActions.length === 0 ? (
                        <div className="py-8 text-center text-slate-500">
                            No commands found.
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredActions.map((action, index) => (
                                <button
                                    key={action.id}
                                    onClick={() => executeAction(action)}
                                    className={`
                                        w-full flex items-center justify-between px-3 py-3 rounded-lg transition-all group
                                        ${index === selectedIndex ? 'bg-slate-100 scale-[0.99]' : 'hover:bg-slate-50'}
                                    `}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`
                                            p-2 rounded-lg 
                                            ${index === selectedIndex ? 'bg-white shadow-sm' : 'bg-slate-100'} 
                                            ${action.danger ? 'text-red-600' : 'text-slate-600'}
                                        `}>
                                            <action.icon className="w-5 h-5" />
                                        </div>
                                        <div className="text-left">
                                            <div className={`font-medium ${action.danger ? 'text-red-600' : 'text-slate-700'}`}>
                                                {action.label}
                                            </div>
                                            {action.desc && (
                                                <div className="text-xs text-slate-400">{action.desc}</div>
                                            )}
                                        </div>
                                    </div>

                                    {action.shortcut && (
                                        <div className="text-xs font-mono text-slate-400 flex items-center gap-1">
                                            {action.shortcut.split(' ').map(k => (
                                                <kbd key={k} className="px-1.5 py-0.5 bg-slate-200 rounded min-w-[1.2rem] text-center">{k}</kbd>
                                            ))}
                                        </div>
                                    )}

                                    {index === selectedIndex && (
                                        <ArrowRight className="w-4 h-4 text-slate-400 opacity-50" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
                    <div className="flex gap-4">
                        <span><strong className="font-medium text-slate-500">↑↓</strong> to navigate</span>
                        <span><strong className="font-medium text-slate-500">enter</strong> to select</span>
                    </div>
                    <div>
                        CompleteDayToDay
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
