import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StaffManagement from './pages/StaffManagement';
import LeaveRequests from './pages/LeaveRequests';
import Payroll from './pages/Payroll';
import Roster from './pages/Roster';
import ShiftManagement from './pages/ShiftManagement';
import StaffScheduling from './pages/StaffScheduling';
import './App.css';

// 受保護的路由組件
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #5A7A8A',
          borderTop: '4px solid transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
      </div>
    );
  }
  
  return isAuthenticated ? children : <Navigate to="/login" />;
}

// 管理員權限路由組件
function AdminRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #5A7A8A',
          borderTop: '4px solid transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  const hasAdminPermission = user && (user.is_staff || user.is_superuser);
  if (!hasAdminPermission) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '40px',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          maxWidth: '500px'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🚫</div>
          <h2 style={{ color: '#dc3545', marginBottom: '15px' }}>訪問被拒絕</h2>
          <p style={{ color: '#666', marginBottom: '10px' }}>您沒有權限訪問此頁面。</p>
          <p style={{ color: '#666', marginBottom: '20px' }}>如需訪問權限，請聯繫系統管理員。</p>
          <button 
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            onClick={() => window.location.href = '/dashboard'}
          >
            返回主頁
          </button>
        </div>
      </div>
    );
  }
  
  return children;
}

function AppContent() {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          
          {/* 班表路由 - 改為 /roster */}
          <Route 
            path="/roster" 
            element={
              <ProtectedRoute>
                <Roster />
              </ProtectedRoute>
            }
          />

          {/* 向後兼容：如果有人還用舊路徑 */}
          <Route 
            path="/schedule" 
            element={<Navigate to="/roster" replace />}
          />

          {/* 員工管理路由 */}
          <Route 
            path="/staff" 
            element={
              <ProtectedRoute>
                <StaffManagement />
              </ProtectedRoute>
            }
          />

          {/* 班次管理路由 */}
          <Route 
            path="/shifts" 
            element={
              <AdminRoute>
                <ShiftManagement />
              </AdminRoute>
            }
          />

          <Route 
            path="/shift-management" 
            element={
              <AdminRoute>
                <ShiftManagement />
              </AdminRoute>
            }
          />

          {/* 員工排班路由 - 現在使用真實的頁面 */}
          <Route 
            path="/staff-scheduling" 
            element={
              <AdminRoute>
                <StaffScheduling />
              </AdminRoute>
            }
          />

          {/* 請假管理路由 */}
          <Route 
            path="/leave-requests" 
            element={
              <ProtectedRoute>
                <LeaveRequests />
              </ProtectedRoute>
            }
          />

          {/* 薪資查詢路由 */}
          <Route 
            path="/payroll" 
            element={
              <ProtectedRoute>
                <Payroll />
              </ProtectedRoute>
            }
          />
          
          <Route 
            path="/" 
            element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;