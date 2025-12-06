import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import DriveFile from '../models/DriveFile.js';
import DriveFolder from '../models/DriveFolder.js';
import crypto from 'crypto';

const r2 = new S3Client({
  region: process.env.R2_REGION || 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET;
const QUOTA_LIMIT = 5 * 1024 * 1024 * 1024; // 5 GB

// --- HELPERS ---

// Calculate current usage
const getUserUsage = async (userId) => {
  const files = await DriveFile.find({ user: userId });
  return files.reduce((acc, file) => acc + file.size, 0);
};

// --- CONTROLLERS ---

// 1. Get Pre-signed Upload URL
export const getUploadUrl = async (req, res) => {
  try {
    const { name, size, mimeType, folderId } = req.body;
    const userId = req.user.id;

    // Check Quota
    const used = await getUserUsage(userId);
    if (used + size > QUOTA_LIMIT) {
      return res.status(403).json({ message: 'Storage quota exceeded (5GB limit)' });
    }

    // Generate unique Key: users/{userId}/{random}-{name}
    const random = crypto.randomBytes(8).toString('hex');
    const key = `users/${userId}/${random}-${name}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: mimeType,
      // ACL: 'private' // R2 doesn't fully support ACLs usually, but private is default
    });

    const url = await getSignedUrl(r2, command, { expiresIn: 3600 }); // 1 hour

    res.json({ url, key });
  } catch (error) {
    console.error('Presign error:', error);
    res.status(500).json({ message: 'Error generating upload URL' });
  }
};

// 2. Finalize Upload (Save Metadata)
export const saveFileMetadata = async (req, res) => {
  try {
    const { name, size, mimeType, key, folderId } = req.body;

    const file = new DriveFile({
      user: req.user.id,
      folder: folderId || null,
      name,
      size,
      mimeType,
      r2Key: key
    });

    await file.save();
    res.status(201).json(file);
  } catch (error) {
    console.error('Save meta error:', error);
    res.status(500).json({ message: 'Error saving file metadata' });
  }
};

// 3. List Files & Folders
export const getDriveContent = async (req, res) => {
  try {
    const { folderId, trash } = req.query; // null or 'root' for root
    const isTrash = trash === 'true';

    const filter = { 
        user: req.user.id, 
        isTrash: isTrash
    };
    
    // If not trash, filter by folder. If trash, show all deleted items (flat list).
    if (!isTrash) {
        filter.folder = (folderId && folderId !== 'root') ? folderId : null;
    }
    
    // For Folders parent filter
    const folderFilter = {
        user: req.user.id,
        isTrash: isTrash
    };
    if (!isTrash) {
        folderFilter.parent = (folderId && folderId !== 'root') ? folderId : null;
    }

    const fileDocs = await DriveFile.find(filter).sort({ createdAt: -1 });
    const folders = await DriveFolder.find(folderFilter).sort({ name: 1 });

    // Generate thumbnails for images
    const files = await Promise.all(fileDocs.map(async (doc) => {
        const file = doc.toObject();
        if (file.mimeType && file.mimeType.startsWith('image/')) {
            try {
                const command = new GetObjectCommand({ 
                    Bucket: BUCKET_NAME, 
                    Key: file.r2Key 
                });
                // Short expiry for thumbnails (30 mins)
                file.thumbUrl = await getSignedUrl(r2, command, { expiresIn: 1800 });
            } catch (err) {
                console.error("Thumb gen error", err);
            }
        }
        return file;
    }));

    const used = await getUserUsage(req.user.id);

    res.json({ files, folders, usage: used, total: QUOTA_LIMIT });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching drive content' });
  }
};

// 4. Create Folder
export const createFolder = async (req, res) => {
  try {
    const { name, parentId } = req.body;
    const folder = new DriveFolder({
      user: req.user.id,
      name,
      parent: parentId || null
    });
    await folder.save();
    res.status(201).json(folder);
  } catch (error) {
    res.status(500).json({ message: 'Error creating folder' });
  }
};

// 5. Get Download/Preview URL
export const getFileUrl = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { download } = req.query;

    const file = await DriveFile.findOne({ _id: fileId, user: req.user.id });
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    const disposition = download === 'true' ? 'attachment' : 'inline';

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: file.r2Key,
      ResponseContentDisposition: `${disposition}; filename="${file.name}"`
    });

    // Valid for 1 hour
    const url = await getSignedUrl(r2, command, { expiresIn: 3600 });
    res.json({ url });
  } catch (error) {
    res.status(500).json({ message: 'Error generating URL' });
  }
};

// 6. Delete Item (Move to Trash)
export const deleteItem = async (req, res) => {
  try {
    const { id, type } = req.body; // type: 'file' or 'folder'
    
    if (type === 'file') {
        await DriveFile.findOneAndUpdate({ _id: id, user: req.user.id }, { isTrash: true, trashDate: new Date() });
    } else {
        await DriveFolder.findOneAndUpdate({ _id: id, user: req.user.id }, { isTrash: true, trashDate: new Date() });
    }

    res.json({ message: 'Item moved to trash' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting item' });
  }
};

// 9. Restore Item
export const restoreItem = async (req, res) => {
  try {
    const { id, type } = req.body;
    if (type === 'file') {
        await DriveFile.findOneAndUpdate({ _id: id, user: req.user.id }, { isTrash: false, trashDate: null });
    } else {
        await DriveFolder.findOneAndUpdate({ _id: id, user: req.user.id }, { isTrash: false, trashDate: null });
    }
    res.json({ message: 'Item restored' });
  } catch (error) {
    res.status(500).json({ message: 'Error restoring item' });
  }
};

// 10. Rename Item
export const renameItem = async (req, res) => {
  try {
    const { id, type, name } = req.body;
    if (!name || name.trim() === '') return res.status(400).json({ message: 'Name is required' });

    if (type === 'file') {
        await DriveFile.findOneAndUpdate({ _id: id, user: req.user.id }, { name });
    } else {
        await DriveFolder.findOneAndUpdate({ _id: id, user: req.user.id }, { name });
    }
    res.json({ message: 'Item renamed' });
  } catch (error) {
    res.status(500).json({ message: 'Error renaming item' });
  }
};

// 7. Share Item (Generate Public Link)
export const shareItem = async (req, res) => {
  try {
    const { id } = req.body;
    const token = crypto.randomBytes(32).toString('hex');
    
    // Update file with share token
    const file = await DriveFile.findOneAndUpdate(
       { _id: id, user: req.user.id },
       { isPublic: true, shareToken: token, shareExpires: null }, // No expiry for now
       { new: true }
    );

    if (!file) return res.status(404).json({ message: 'File not found' });

    // Return the public access URL (e.g., /api/drive/public/:token or similar)
    // Actually, asking for "how public links work". 
    // Usually it points to a frontend route /share/:token which then calls backend.
    
    res.json({ token, shareUrl: `${process.env.FRONTEND_URL}/share/${token}` });
  } catch (error) {
    res.status(500).json({ message: 'Error sharing item' });
  }
};

// 8. Get Public File (No Auth)
export const getPublicFile = async (req, res) => {
  try {
    const { token } = req.params;
    const file = await DriveFile.findOne({ shareToken: token });

    if (!file) return res.status(404).json({ message: 'File not found or link expired' });

    // Generate Download URL (valid 1 hour)
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: file.r2Key,
      ResponseContentDisposition: `inline; filename="${file.name}"`
    });

    const url = await getSignedUrl(r2, command, { expiresIn: 3600 });
    
    res.json({
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
        url
    });
  } catch (error) {
    res.status(500).json({ message: 'Error accessing shared file' });
  }
};
