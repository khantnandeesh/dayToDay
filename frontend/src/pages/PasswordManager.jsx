import { useVault, VaultProvider } from '../context/VaultContext';
import SetupVault from '../components/vault/SetupVault';
import UnlockVault from '../components/vault/UnlockVault';
import VaultDashboard from '../components/vault/VaultDashboard';
import Navbar from '../components/Navbar';

const PasswordManagerContent = () => {
    const { isInitialized, isLocked, loading } = useVault();

    // Initial loading state while checking status
    if (isInitialized === null) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isInitialized) return <SetupVault />;
    if (isLocked) return <UnlockVault />;

    return <VaultDashboard />;
};

const PasswordManager = () => {
    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <div className="max-w-7xl mx-auto p-4 md:p-8">
                <VaultProvider>
                    <PasswordManagerContent />
                </VaultProvider>
            </div>
        </div>
    );
};

export default PasswordManager;
