import { createContext, useContext, useState, useEffect } from 'react';
import api from '../config/api';
import { deriveKey, encryptSync, decryptSync, generateSalt, generateIV } from '../utils/crypto';

const VaultContext = createContext();

export const useVault = () => {
    const context = useContext(VaultContext);
    if (!context) {
        throw new Error('useVault must be used within a VaultProvider');
    }
    return context;
};

export const VaultProvider = ({ children }) => {
    const [isInitialized, setIsInitialized] = useState(null); // null = unknown
    const [isLocked, setIsLocked] = useState(true);
    const [items, setItems] = useState([]);
    const [customTemplates, setCustomTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [masterKey, setMasterKey] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        checkVaultStatus();
    }, []);

    const checkVaultStatus = async () => {
        try {
            const response = await api.get('/vault/status');
            setIsInitialized(response.data.isInitialized);
        } catch (err) {
            console.error('Vault status check failed', err);
        } finally {
            setLoading(false);
        }
    };

    // Initialize Vault (First time setup)
    const initializeVault = async (password) => {
        setLoading(true);
        setError('');
        try {
            const salt = generateSalt();
            const key = await deriveKey(password, salt);

            // Create verifier token
            const verifierData = await encryptSync({ status: 'valid' }, key);

            await api.post('/vault/init', {
                salt,
                verifier: verifierData.encryptedData,
                verifierIv: verifierData.iv
            });

            setMasterKey(key);
            setIsInitialized(true);
            setIsLocked(false);
            setItems([]);
            return true;
        } catch (err) {
            console.error('Init vault error:', err);
            setError(err.response?.data?.message || 'Failed to initialize vault');
            return false;
        } finally {
            setLoading(false);
        }
    };

    // Unlock Vault
    const unlockVault = async (password) => {
        setLoading(true);
        setError('');
        try {
            // 1. Fetch encrypted data (salt + verifier + items)
            const response = await api.get('/vault/sync');
            const { salt, verifier, verifierIv, items: encryptedItems, customTemplates: syncedTemplates } = response.data;

            if (syncedTemplates) setCustomTemplates(syncedTemplates);

            // 2. Derive key
            const key = await deriveKey(password, salt);

            // 3. Verify key by decrypting verifier
            try {
                const verification = await decryptSync(verifier, verifierIv, key);
                if (verification.status !== 'valid') throw new Error('Invalid key');
            } catch (decErr) {
                // Decryption failed = Wrong password
                setError('Invalid Master Password');
                setLoading(false);
                return false;
            }

            // 4. Decrypt all items
            const decryptedItems = [];
            for (const item of encryptedItems) {
                try {
                    const data = await decryptSync(item.encryptedData, item.iv, key);
                    decryptedItems.push({
                        ...item,
                        ...data, // Spread the dynamic fields (title, fields, etc.)
                        id: item.id, // Ensure ID is preserved
                    });
                } catch (e) {
                    console.error('Failed to decrypt item', item.id, e);
                    // Skip corrupt items or show error placeholder
                    decryptedItems.push({ ...item, title: '[Decryption Error]', fields: [] });
                }
            }

            setMasterKey(key);
            setItems(decryptedItems);
            setIsLocked(false);
            return true;

        } catch (err) {
            console.error('Unlock error:', err);
            if (!error) setError(err.response?.data?.message || 'Failed to unlock vault');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const lockVault = () => {
        setMasterKey(null);
        setItems([]);
        setIsLocked(true);
    };

    const createItem = async (itemData) => {
        // itemData: { type, title, fields: [...], isFavorite, tags }
        if (!masterKey) return;
        setLoading(true);
        try {
            // Segregate plaintext metadata from encrypted blob content
            // We only expose 'type' and 'isFavorite' in plaintext to server if needed
            // But we chose to store encrypted blob.
            // Our VaultItem model expects: type, encryptedData, iv, isFavorite.

            const payloadToEncrypt = {
                title: itemData.title,
                fields: itemData.fields,
                tags: itemData.tags,
                notes: itemData.notes
            };

            const { encryptedData, iv } = await encryptSync(payloadToEncrypt, masterKey);

            const response = await api.post('/vault/items', {
                type: itemData.type,
                encryptedData,
                iv,
                isFavorite: itemData.isFavorite
            });

            const newItem = {
                ...response.data.item,
                ...payloadToEncrypt
            };

            setItems([newItem, ...items]);
            return true;

        } catch (err) {
            console.error('Create item error:', err);
            setError('Failed to save item');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const updateItem = async (id, itemData) => {
        if (!masterKey) return;
        setLoading(true);
        try {
            const payloadToEncrypt = {
                title: itemData.title,
                fields: itemData.fields,
                tags: itemData.tags,
                notes: itemData.notes
            };

            const { encryptedData, iv } = await encryptSync(payloadToEncrypt, masterKey);

            const response = await api.post('/vault/items', {
                id,
                type: itemData.type, // type change allowed
                encryptedData,
                iv,
                isFavorite: itemData.isFavorite
            });

            const updatedItem = {
                ...response.data.item,
                ...payloadToEncrypt
            };

            setItems(items.map(item => item.id === id ? updatedItem : item));
            return true;
        } catch (err) {
            console.error('Update item error', err);
            setError('Failed to update item');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const deleteItem = async (id) => {
        if (!masterKey) return;
        setLoading(true);
        try {
            await api.delete(`/vault/items/${id}`);
            setItems(items.filter(i => i.id !== id));
            return true;
        } catch (err) {
            console.error('Delete item error', err);
            setError('Failed to delete item');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const createTemplate = async (templateData) => {
        // templateData: { id, label, icon, fields }
        setLoading(true);
        try {
            const response = await api.post('/vault/templates', templateData);
            setCustomTemplates(response.data.customTemplates);
            return true;
        } catch (err) {
            console.error('Create template error', err);
            setError('Failed to create template');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const value = {
        isInitialized,
        isLocked,
        items,
        loading,
        error,
        initializeVault,
        unlockVault,
        lockVault,
        createItem,
        updateItem,
        deleteItem,
        customTemplates,
        createTemplate
    };

    return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
};
