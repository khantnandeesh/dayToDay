import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, User, Shield, LayoutDashboard, HardDrive, Search, Command } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import CommandPalette from './CommandPalette';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [showPalette, setShowPalette] = useState(false);

    const handleLogout = async () => {
        try {
            await api.post('/auth/logout');
            logout();
            navigate('/login');
        } catch (error) {
            console.error('Logout error:', error);
            logout();
            navigate('/login');
        }
    };

    const isActive = (path) => location.pathname === path;

    // Toggle Palette Shortcut
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setShowPalette(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <>
            <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
                    {/* Logo / Brand */}
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold">
                            D
                        </div>
                        <span className="font-bold text-slate-900 text-lg hidden md:block">DayToDay</span>
                    </div>

                    {/* Command Bar Trigger (Centered-ish) */}
                    <button
                        onClick={() => setShowPalette(true)}
                        className="hidden md:flex items-center gap-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-slate-500 transition-all text-sm w-64 group"
                    >
                        <Search className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                        <span className="flex-1 text-left">Quick Search...</span>
                        <div className="flex items-center gap-1 text-xs text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            <Command className="w-3 h-3" />
                            <span>K</span>
                        </div>
                    </button>

                    {/* Mobile Search Icon */}
                    <button
                        onClick={() => setShowPalette(true)}
                        className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                    >
                        <Search className="w-5 h-5" />
                    </button>

                    {/* Navigation */}
                    <div className="flex items-center gap-2 md:gap-4 shrink-0">
                        <Link
                            to="/dashboard"
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                                ${isActive('/dashboard')
                                    ? 'bg-slate-100 text-slate-900'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                            title="Dashboard"
                        >
                            <LayoutDashboard className="w-4 h-4" />
                            <span className="hidden lg:block">Dashboard</span>
                        </Link>

                        <Link
                            to="/passwords"
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                                ${isActive('/passwords')
                                    ? 'bg-slate-100 text-slate-900'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                            title="Passwords"
                        >
                            <Shield className="w-4 h-4" />
                            <span className="hidden lg:block">Passwords</span>
                        </Link>

                        <Link
                            to="/drive"
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                                ${isActive('/drive')
                                    ? 'bg-slate-100 text-slate-900'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                            title="Secure Drive"
                        >
                            <HardDrive className="w-4 h-4" />
                            <span className="hidden lg:block">Secure Drive</span>
                        </Link>

                        <Link
                            to="/profile"
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                                ${isActive('/profile')
                                    ? 'bg-slate-100 text-slate-900'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                            title="Profile"
                        >
                            <User className="w-4 h-4" />
                            <span className="hidden lg:block">Profile</span>
                        </Link>

                        <div className="h-6 w-px bg-slate-200 mx-2"></div>

                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                            title="Sign Out"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden lg:block">Sign Out</span>
                        </button>

                        {/* User Avatar (Mini) */}
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold border border-slate-200 ml-2">
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </div>
            </div>

            <CommandPalette isOpen={showPalette} onClose={() => setShowPalette(false)} />
        </>
    );
};

export default Navbar;
