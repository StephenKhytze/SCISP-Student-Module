import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Monitor, BookOpen, GraduationCap, Users, LogOut, ArrowLeft, ArrowRight } from 'lucide-react';

export default function Sidebar({ isMobileOpen = false, onCloseMobileNav = () => {}, currentUser }) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/schedule', label: 'Schedule', icon: Calendar },
    { path: '/announcements', label: 'Announcements', icon: Monitor },
    { path: '/library', label: 'Library', icon: BookOpen },
    { path: '/student-info', label: 'Student Information', icon: GraduationCap },
    { path: '/faculty', label: 'Faculty Directory', icon: Users },
  ];

  return (
    <>
      {/* Backdrop for the mobile drawer - starts below the header so the header is not dimmed */}
      <div
        className={`fixed inset-x-0 bottom-0 top-[86px] bg-black/40 z-40 md:hidden transition-opacity ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none ${
          isMobileOpen ? 'opacity-100 duration-300' : 'opacity-0 pointer-events-none duration-[250ms]'
        }`}
        onClick={onCloseMobileNav}
        aria-hidden="true"
      />

      {/* Slides in on mobile, collapses on desktop */}
      <aside
        className={`fixed md:relative top-[86px] md:top-0 left-0 z-40 w-[280px] ${
          isCollapsed ? 'md:w-[100px]' : 'md:w-[280px]'
        } bg-[#80172B] text-white flex flex-col h-[calc(100vh-86px)] shrink-0 transition-[transform,width] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform md:will-change-auto motion-reduce:transition-none overflow-hidden md:overflow-visible ${
          isMobileOpen ? 'translate-x-0 duration-300' : '-translate-x-full duration-[250ms]'
        } md:translate-x-0 md:duration-300`}
      >
        {/* Profile header (mobile only) - the topbar avatar is hidden on mobile, so it lives here instead */}
        <div className="md:hidden flex items-center gap-3 px-5 pt-5 pb-4 border-b border-[#651020]">
          <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-md text-[#182848] shrink-0">
            <GraduationCap className="w-6 h-6 text-[#182848]" />
          </div>
          <div className="leading-tight overflow-hidden">
            <p className="font-bold text-[15px] text-white truncate">{currentUser?.name}</p>
            <p className="text-[12px] text-white/70">{currentUser?.role}</p>
          </div>
        </div>

        {/* Collapse arrow at the top right of sidebar (desktop only) */}
        <div className={`hidden md:flex ${isCollapsed ? 'justify-center' : 'justify-end'} p-5 transition-all duration-300`}>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-white hover:bg-white/10 p-1.5 rounded transition-colors focus:outline-none"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ArrowRight className="w-6 h-6 text-white/80" /> : <ArrowLeft className="w-6 h-6 text-white/80" />}
          </button>
        </div>

      {/* Navigation Links */}
      <nav className="flex-1 flex flex-col space-y-1.5 mt-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <div key={item.path} className="relative">
              <Link
                to={item.path}
                onClick={onCloseMobileNav}
                className={`flex items-center py-4 transition-all duration-300 ${
                  isActive
                    ? 'bg-[#182848] text-white rounded-r-2xl shadow-[6px_0_15px_rgba(0,0,0,0.25)] w-[calc(100%+20px)] relative z-10'
                    : 'text-white/80 hover:bg-white/10 hover:text-white rounded-r-2xl w-full pr-4'
                } ${isCollapsed ? 'justify-center' : 'space-x-4'}`}
                style={{ paddingLeft: isCollapsed ? '0' : '32px' }}
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-white/80'}`} />
                {!isCollapsed && (
                  <span className="font-bold text-[15px] tracking-wide whitespace-nowrap overflow-hidden transition-all duration-300">
                    {item.label}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Sign Out Button at the bottom */}
      <div className="mt-auto border-t border-[#651020] pt-4 pb-6">
        <Link
          to="/auth"
          onClick={() => {
            localStorage.removeItem('access_token');
            localStorage.removeItem('user');
          }}
          className={`flex items-center py-4 text-white/80 hover:bg-white/10 hover:text-white rounded-r-2xl w-full transition-all duration-300 ${
            isCollapsed ? 'justify-center pr-0' : 'space-x-4 pr-4'
          }`}
          style={{ paddingLeft: isCollapsed ? '0' : '32px' }}
          title={isCollapsed ? "Sign Out" : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0 text-white/80" />
          {!isCollapsed && (
            <span className="font-bold text-[15px] tracking-wide whitespace-nowrap overflow-hidden transition-all duration-300">
              Sign Out
            </span>
          )}
        </Link>
      </div>
      </aside>
    </>
  );
}
