import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import vaultRoutes from './routes/vaultRoutes.js';
import driveRoutes from './routes/driveRoutes.js';
import AllowedOrigin from './models/AllowedOrigin.js'; // Added for dynamic CORS

import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';

dotenv.config(); // Load env vars early

const app = express();

// Security Middleware
app.use(helmet());
app.use(mongoSanitize());
app.use(xss());

// Body Parsers (Moved up for Admin Panel)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// --- CORS Admin Interface (SSR) ---
// Placed BEFORE CORS middleware to bypass checks
app.get('/cors-admin', async (req, res) => {
    try {
        const origins = await AllowedOrigin.find({});
        const currentEnv = process.env.FRONTEND_URL || 'Not Set';
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>CORS Manager - DayToDay</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-100 min-h-screen p-8 font-sans">
            <div class="max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
                <div class="bg-slate-900 p-6 text-white flex justify-between items-center">
                    <h1 class="text-2xl font-bold">🛡️ CORS Manager</h1>
                    <span class="text-xs bg-slate-700 px-2 py-1 rounded">Admin Panel</span>
                </div>
                
                <div class="p-6 space-y-6">
                    <div class="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                        <div class="text-xs font-bold text-blue-600 uppercase mb-1">Environment Variable (Static)</div>
                        <code class="text-blue-900 font-mono">${currentEnv}</code>
                    </div>

                    <div>
                        <h2 class="text-lg font-bold text-slate-800 mb-3">Allowed Dynamic Origins</h2>
                        <div class="space-y-2">
                            ${origins.length === 0 ? '<p class="text-slate-400 italic">No dynamic origins added yet.</p>' : ''}
                            ${origins.map(o => `
                                <div class="flex items-center justify-between bg-slate-50 p-3 rounded border border-slate-200">
                                    <div class="font-mono text-sm text-slate-700">${o.url}</div>
                                    <form action="/cors-admin/delete" method="POST" onsubmit="return confirm('Remove this origin?');">
                                        <input type="hidden" name="id" value="${o._id}">
                                        <button type="submit" class="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-1 1-1h6c0 0 1 0 1 1v2"/></svg>
                                        </button>
                                    </form>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <form action="/cors-admin/add" method="POST" class="mt-6 border-t pt-6">
                        <label class="block text-sm font-medium text-slate-700 mb-2">Add New Origin</label>
                        <div class="flex gap-2">
                            <input type="url" name="url" placeholder="https://example.com" required 
                                class="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                            <button type="submit" class="bg-slate-900 text-white px-6 py-2 rounded-lg hover:bg-slate-800 transition font-medium">
                                Add
                            </button>
                        </div>
                        <p class="text-xs text-slate-400 mt-2">Must include protocol (https://)</p>
                    </form>
                </div>
            </div>
        </body>
        </html>
        `;
        res.send(html);
    } catch (error) {
        res.status(500).send("Error loading admin: " + error.message);
    }
});

app.post('/cors-admin/add', async (req, res) => {
    try {
        let { url } = req.body;
        if (url.endsWith('/')) url = url.slice(0, -1);
        await AllowedOrigin.create({ url });
        res.redirect('/cors-admin');
    } catch (error) {
        res.status(400).send("Failed to add origin: " + error.message);
    }
});

app.post('/cors-admin/delete', async (req, res) => {
    try {
        await AllowedOrigin.findByIdAndDelete(req.body.id);
        res.redirect('/cors-admin');
    } catch (error) {
        res.status(400).send("Failed to delete");
    }
});

// Dynamic CORS Configuration
const getAllowedOrigins = async () => {
    const dbOrigins = await AllowedOrigin.find({});
    const urls = dbOrigins.map(o => o.url);
    if (process.env.FRONTEND_URL) urls.push(process.env.FRONTEND_URL);
    return [...new Set(urls)]; 
};

const corsOptions = {
    origin: async function (origin, callback) {
        if (!origin) return callback(null, true);
        try {
            const allowedOrigins = await getAllowedOrigins();
            if (allowedOrigins.indexOf(origin) !== -1) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        } catch (err) {
            callback(err);
        }
    },
    credentials: true,
};

// Apply CORS to remaining routes (API)
app.use(cors(corsOptions));

connectDB();
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/drive', driveRoutes);

// Health check
app.get('/health', async(req, res) => {
  
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server error',
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on ${process.env.BACKEND_URL}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});
