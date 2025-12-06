import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, User, Shield, LayoutDashboard, HardDrive } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

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

    return (
        <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
                {/* Logo / Brand */}
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold">
                        D
                    </div>
                    <span className="font-bold text-slate-900 text-lg hidden md:block">DayToDay</span>
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-2 md:gap-4">
                    <Link
                        to="/dashboard"
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                            ${isActive('/dashboard')
                                ? 'bg-slate-100 text-slate-900'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        <span className="hidden md:block">Dashboard</span>
                    </Link>

                    <Link
                        to="/passwords"
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                            ${isActive('/passwords')
                                ? 'bg-slate-100 text-slate-900'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                    >
                        <Shield className="w-4 h-4" />
                        <span className="hidden md:block">Passwords</span>
                    </Link>

                    <Link
                        to="/drive"
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                            ${isActive('/drive')
                                ? 'bg-slate-100 text-slate-900'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                    >
                        <HardDrive className="w-4 h-4" />
                        <span className="hidden md:block">Secure Drive</span>
                    </Link>

                    <Link
                        to="/profile"
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                            ${isActive('/profile')
                                ? 'bg-slate-100 text-slate-900'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                    >
                        <User className="w-4 h-4" />
                        <span className="hidden md:block">Profile</span>
                    </Link>

                    <div className="h-6 w-px bg-slate-200 mx-2"></div>

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden md:block">Sign Out</span>
                    </button>

                    {/* User Avatar (Mini) */}
                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold border border-slate-200 ml-2">
                        {user?.name?.charAt(0).toUpperCase()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Navbar;
