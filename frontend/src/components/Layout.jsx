import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import api from '../services/api';

const DEFAULT_USER = {
  name: 'Juan Dela Cruz',
  role: 'Student',
  department: 'College of Computer Studies',
  idNumber: '2023-00123'
};

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : DEFAULT_USER;
    } catch {
      return DEFAULT_USER;
    }
  });

  // Automatically close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleSelectUser = (user) => {
    setCurrentUser(user);
    localStorage.setItem('user', JSON.stringify(user));
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Proceed with local logout even if server fails
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      navigate('/auth');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen m-0 p-0 overflow-hidden bg-gray-100">
      {/* Topbar spans the full width at the top */}
      <Topbar 
        currentUser={currentUser} 
        onSelectUser={handleSelectUser}
        onLogout={handleLogout}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
        onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
      />
      
      {/* Container for Sidebar and Main Content */}
      <div className="flex flex-1 h-[calc(100vh-64px)] md:h-[calc(100vh-86px)] overflow-hidden relative">
        <Sidebar 
          isMobileOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          onLogout={handleLogout}
        />
        <main className="flex-1 h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-[#f8f9fa]">
          <Outlet context={{ user: currentUser, onSelectUser: handleSelectUser }} />
        </main>
      </div>
    </div>
  );
}

