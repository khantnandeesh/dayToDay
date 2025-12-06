import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Verify2FA from './pages/Verify2FA';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import PasswordManager from './pages/PasswordManager';
import SecurityExplained from './pages/SecurityExplained';
import SecureDrive from './pages/SecureDrive';
import PublicShare from './pages/PublicShare';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />
          <Route
            path="/verify-2fa"
            element={
              <PublicRoute>
                <Verify2FA />
              </PublicRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/passwords"
            element={
              <ProtectedRoute>
                <PasswordManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/drive"
            element={
              <ProtectedRoute>
                <SecureDrive />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route path="/security" element={<SecurityExplained />} />
          <Route path="/share/:token" element={<PublicShare />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
