import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Monitor, BookOpen, GraduationCap, Users, LogOut, ArrowLeft, ArrowRight } from 'lucide-react';

export default function Sidebar({ isMobileOpen = false, onClose = () => {}, onLogout = () => {} }) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/schedule', label: 'Schedule', icon: Calendar },
    { path: '/announcements', label: 'Announcement', icon: Monitor },
    { path: '/library', label: 'Library', icon: BookOpen },
    { path: '/student-info', label: 'Student Information', icon: GraduationCap },
    { path: '/faculty', label: 'Faculty Directory', icon: Users },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 top-16 bg-black/50 z-30 md:hidden backdrop-blur-[1px] transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Aside */}
      <aside 
        className={`
          bg-[#80172B] text-white flex flex-col justify-between transition-all duration-300 ease-in-out
          fixed top-16 bottom-0 left-0 z-40 md:static md:top-auto md:bottom-auto
          ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-[calc(100%+40px)] md:translate-x-0'}
          ${isCollapsed ? 'md:w-[100px]' : 'md:w-[280px]'}
          w-[270px] sm:w-[280px] h-[calc(100vh-64px)] md:h-[calc(100vh-86px)] shrink-0 select-none overflow-y-auto overflow-x-hidden
        `}
      >
        <div className="flex flex-col flex-1">
          {/* Collapse arrow at the top right of sidebar (Desktop only) */}
          <div className={`hidden md:flex ${isCollapsed ? 'justify-center' : 'justify-end'} p-4 transition-all duration-300`}>
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-white hover:bg-white/10 p-1.5 rounded transition-colors focus:outline-none"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <ArrowRight className="w-6 h-6 text-white/80" /> : <ArrowLeft className="w-6 h-6 text-white/80" />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col space-y-1 mt-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <div key={item.path} className="relative">
                  <Link
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center py-3.5 transition-all duration-300 ${
                      isActive
                        ? 'bg-[#182848] text-white rounded-r-2xl shadow-[6px_0_15px_rgba(0,0,0,0.25)] w-[calc(100%+20px)] relative z-10'
                        : 'text-white/80 hover:bg-white/10 hover:text-white rounded-r-2xl w-full pr-4'
                    } ${isCollapsed ? 'md:justify-center' : 'space-x-4'}`}
                    style={{ paddingLeft: isCollapsed ? '0px' : '28px' }}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-white/80'}`} />
                    {(!isCollapsed || isMobileOpen) && (
                      <span className={`font-bold text-[15px] tracking-wide whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? 'md:hidden' : 'block'}`}>
                        {item.label}
                      </span>
                    )}
                  </Link>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Sign Out Button pinned at the bottom */}
        <div className="mt-auto border-t border-[#651020] pt-3 pb-5 shrink-0 bg-[#80172B]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className={`flex items-center py-3.5 text-white/80 hover:bg-white/10 hover:text-white rounded-r-2xl w-full transition-all duration-300 cursor-pointer ${
              isCollapsed ? 'md:justify-center md:pr-0' : 'space-x-4 pr-4'
            }`}
            style={{ paddingLeft: isCollapsed ? '0px' : '28px' }}
            title={isCollapsed ? "Sign Out" : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0 text-white/80" />
            {(!isCollapsed || isMobileOpen) && (
              <span className={`font-bold text-[15px] tracking-wide whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? 'md:hidden' : 'block'}`}>
                Sign Out
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

