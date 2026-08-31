# Authentication System with 2FA

A comprehensive authentication system built with Node.js, Express, React, and MongoDB featuring two-factor authentication, device tracking, and session management.

## Features

✨ **Core Features:**
- 🔐 Two-Factor Authentication (2FA) via Email
- 📱 Device Tracking & Management
- ⏰ Customizable Session Duration (1 hour to 30 days)
- 🔒 Secure Password Hashing with bcrypt
- 🎫 JWT-based Authentication
- 📧 Beautiful Email Templates
- 💻 Active Session Management
- 🚪 Logout from Specific Devices
- 🌐 Modern, Responsive UI

## Tech Stack

**Backend:**
- Node.js & Express
- MongoDB with Mongoose
- JWT for authentication
- Nodemailer for emails
- bcryptjs for password hashing
- UA Parser for device detection

**Frontend:**
- React 19
- React Router for navigation
- Axios for API calls
- TailwindCSS for styling
- Vite for build tooling

## Project Structure

```
CompleteDayToDay/
├── backend/
│   ├── config/
│   │   ├── db.js              # MongoDB connection
│   │   └── email.js           # Email service
│   ├── controllers/
│   │   └── authController.js  # Authentication logic
│   ├── middleware/
│   │   └── auth.js            # JWT verification
│   ├── models/
│   │   ├── User.js            # User model
│   │   └── Session.js         # Session model
│   ├── routes/
│   │   └── authRoutes.js      # API routes
│   ├── utils/
│   │   └── deviceParser.js    # Device info parser
│   ├── .env                   # Environment variables
│   ├── index.js               # Server entry point
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── ProtectedRoute.jsx
    │   ├── config/
    │   │   └── api.js         # Axios configuration
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── Verify2FA.jsx
    │   │   └── Dashboard.jsx
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── .env
    ├── vite.config.js
    └── package.json
```

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- MongoDB Atlas account or local MongoDB
- Gmail account for sending emails

### Backend Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Environment variables are already configured in `.env`:
   - MongoDB URI
   - Email credentials
   - JWT secret
   - Port configurations

4. Start the backend server:
   ```bash
   npm run dev
   ```
   
   Server will run on: http://localhost:3000

### Frontend Setup

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   
   Frontend will run on: http://localhost:5173

## API Endpoints

### Public Routes
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login (sends 2FA code)
- `POST /api/auth/verify-2fa` - Verify 2FA code and complete login
- `POST /api/auth/resend-2fa` - Resend 2FA code

### Protected Routes
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout current session
- `GET /api/auth/devices` - Get all active sessions
- `DELETE /api/auth/devices/:sessionId` - Logout specific device
- `POST /api/auth/logout-all` - Logout all other devices

## Usage Flow

1. **Registration:**
   - User registers with name, email, and password
   - Receives welcome email
   - Redirected to login

2. **Login:**
   - User enters email and password
   - 6-digit verification code sent to email
   - User enters code and selects session duration
   - Successfully logged in

3. **Dashboard:**
   - View active sessions/devices
   - See device details (browser, OS, IP, last active)
   - Logout from specific devices
   - Logout from all other devices
   - View session expiration time

## Security Features

- ✅ Password hashing with bcrypt
- ✅ JWT token authentication
- ✅ Two-factor authentication via email
- ✅ Session expiration management
- ✅ Device tracking and management
- ✅ Secure HTTP-only cookies
- ✅ CORS protection
- ✅ Input validation

## Environment Variables

### Backend (.env)
```env
PORT=3000
BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email
EMAIL_PASS=your_app_password
```

### Frontend (.env)
```env
VITE_BACKEND_URL=http://localhost:3000
VITE_FRONTEND_URL=http://localhost:5173
```

## Session Duration Options

- 1 hour
- 6 hours
- 12 hours
- 24 hours (Recommended)
- 3 days
- 1 week
- 30 days

## Development

### Backend Development
```bash
cd backend
npm run dev  # Uses nodemon for auto-restart
```

### Frontend Development
```bash
cd frontend
npm run dev
```

## Production Build

### Frontend
```bash
cd frontend
npm run build
npm run preview
```

## Troubleshooting

1. **Email not sending:**
   - Verify Gmail app password is correct
   - Enable "Less secure app access" or use App Password
   - Check email credentials in `.env`

2. **MongoDB connection error:**
   - Verify MongoDB URI is correct
   - Check network access in MongoDB Atlas
   - Ensure IP is whitelisted

3. **CORS errors:**
   - Verify FRONTEND_URL in backend `.env`
   - Check BACKEND_URL in frontend `.env`

## License

MIT






## MCP Custom Connected Apps

The backend exposes a StreamableHTTP MCP endpoint at /mcp and supports OAuth 2.0 Dynamic Client Registration at /oauth/register. Registered OAuth clients are stored in MongoDB.

Set these backend environment variables in production:

    MCP_PUBLIC_URL=https://your-backend-domain.example
    MCP_ALLOWED_REDIRECT_URIS=https://your-registered-client.example/callback

MCP_PUBLIC_URL must be the public HTTPS origin without a trailing slash. Gemini should be given the full MCP URL, for example https://your-backend-domain.example/mcp. Gemini can discover OAuth automatically from /.well-known/oauth-authorization-server; if automatic registration is unavailable, enter the OAuth authorization and token URLs manually.

The MCP tools are user-scoped. Gemini completes the DayToDay login at /oauth/authorize, exchanges the authorization code at /oauth/token, and calls /mcp with the resulting Bearer token.
