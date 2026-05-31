import { Outlet, NavLink } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { Inbox, Activity, LogOut, Settings, MessageSquare, Shield, User } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Layout() {
  const currentUser = useAppStore(state => state.currentUser);
  const setCurrentUser = useAppStore(state => state.setCurrentUser);
  const conversations = useAppStore(state => state.conversations);
  
  const unreadCount = conversations.reduce((acc, c) => acc + c.unread_count, 0);
  const openCount = conversations.filter(c => c.status !== 'closed').length;
  const unassignedCount = conversations.filter(c => c.assigned_to === null).length;

  return (
    <div className="flex flex-col h-screen w-full bg-[#F8FAFC] font-sans overflow-hidden text-slate-900">
      {/* 1. TOP HIGH-DENSITY DASHBOARD BAR */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 sm:px-6 justify-between shrink-0 shadow-sm z-30">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-800">
              WhatsApp Supervisor <span className="text-indigo-600">Demo</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-semibold tracking-wider">CONSOLA COMERCIAL • v1.0.4</p>
          </div>
        </div>

        <div className="flex gap-4 sm:gap-6 items-center">
          <div className="hidden md:flex gap-5 border-l border-slate-200 pl-6 shrink-0">
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Chats Abiertos</p>
              <p className="text-base font-bold leading-none text-indigo-700 mt-1">{openCount}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Sin Asignar</p>
              <p className="text-base font-bold leading-none text-orange-600 mt-1">{unassignedCount}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Prom. Respuesta</p>
              <p className="text-base font-bold leading-none text-slate-700 mt-1">2m</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 text-xs font-semibold">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-slate-700 truncate max-w-[120px] sm:max-w-[180px]">
              {currentUser?.role === 'supervisor' ? 'Supervisor' : 'Agente'}: {currentUser?.full_name}
            </span>
          </div>
        </div>
      </header>

      {/* 2. MAIN HORIZONTAL VIEW (SIDEBAR + CONTENT) */}
      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        {/* Navigation Rail / Sidebar */}
        <aside className="w-16 md:w-60 bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 shrink-0">
          <nav className="flex-1 py-4 flex flex-col gap-1 px-2.5">
            <NavLink
              to="/inbox"
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative",
                isActive ? "bg-indigo-600 text-white font-bold" : "hover:bg-slate-850 hover:text-white text-slate-400"
              )}
            >
              <Inbox className="w-5 h-5 shrink-0" />
              <span className="hidden md:block font-medium text-sm">Bandeja</span>
              {unreadCount > 0 && (
                <span className="absolute right-2 top-2.5 w-4 h-4 bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                  {unreadCount}
                </span>
              )}
            </NavLink>

            {currentUser?.role === 'supervisor' && (
              <NavLink
                to="/supervision"
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  isActive ? "bg-indigo-600 text-white font-bold" : "hover:bg-slate-850 hover:text-white text-slate-400"
                )}
              >
                <Activity className="w-5 h-5 shrink-0" />
                <span className="hidden md:block font-medium text-sm">Supervisión</span>
              </NavLink>
            )}

            <div className="mt-auto pt-4 border-t border-slate-800 space-y-1">
              <button className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-slate-800/50 hover:text-white text-slate-400">
                <Settings className="w-5 h-5 shrink-0" />
                <span className="hidden md:block font-medium text-sm">Ajustes</span>
              </button>
              <button 
                onClick={() => setCurrentUser(null)}
                className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-400 text-slate-400"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                <span className="hidden md:block font-medium text-sm">Cerrar Sesión</span>
              </button>
            </div>
          </nav>
        </aside>

        {/* Dynamic Page Component Outlet */}
        <div className="flex-grow flex flex-col overflow-hidden relative">
          <Outlet />
        </div>
      </div>

      {/* 3. FOOTER STATUS BAR */}
      <footer className="h-6 bg-slate-800 text-[10px] font-medium text-slate-400 flex items-center px-4 justify-between shrink-0 border-t border-slate-750">
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_#10b981]"></span>
            Evolution API Connected
          </span>
          <span className="hidden sm:inline">Instancia: <strong>sales_hq_01</strong></span>
        </div>
        <div className="flex gap-4">
          <span>Realtime: <span className="text-emerald-400 font-bold text-[9px] uppercase">Active</span></span>
          <span className="hidden sm:inline">ID Usuario: <strong>{currentUser?.id}</strong></span>
        </div>
      </footer>
    </div>
  );
}
