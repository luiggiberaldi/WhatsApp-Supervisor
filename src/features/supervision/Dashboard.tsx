import { useAppStore } from '../../store/appStore';
import { Users, MessageCircle, Clock, AlertTriangle, TrendingUp, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function SupervisionDashboard() {
  const conversations = useAppStore(state => state.conversations);
  const profiles = useAppStore(state => state.profiles);
  const messages = useAppStore(state => state.messages);

  const agents = profiles.filter(p => p.role === 'agent');
  
  // Metrics
  const openCount = conversations.filter(c => c.status !== 'closed').length;
  const unassignedCount = conversations.filter(c => c.status === 'new').length;
  const pendingCount = conversations.filter(c => c.status === 'pending').length;
  
  const criticalChats = conversations.filter(c => c.unread_count > 0 && c.status !== 'closed');

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Page title and pill indicators */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-2">
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight uppercase">Supervisión en Tiempo Real</h1>
            <p className="text-xs text-slate-500 font-medium">Panel de control de vendedores, mensajes en espera y tiempos de respuesta.</p>
          </div>
          <div className="flex gap-2">
            <span className="px-2.5 py-1 text-[10px] font-black uppercase text-indigo-750 bg-indigo-50 border border-indigo-150 rounded">Métricas Seguras</span>
            <span className="px-2.5 py-1 text-[10px] font-black uppercase text-slate-600 bg-slate-100 border border-slate-200 rounded">Live Feed</span>
          </div>
        </div>

        {/* Global KPIs cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-center justify-between">
             <div>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Abiertos</p>
               <h3 className="text-2xl font-black text-indigo-600 tracking-tight">{openCount}</h3>
             </div>
             <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center">
               <MessageCircle className="w-5 h-5" />
             </div>
          </div>

          <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-center justify-between">
             <div>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">En Espera / New</p>
               <h3 className="text-2xl font-black text-orange-600 tracking-tight">{unassignedCount}</h3>
             </div>
             <div className="w-9 h-9 bg-orange-50 text-orange-600 rounded flex items-center justify-center">
               <AlertTriangle className="w-5 h-5" />
             </div>
          </div>

          <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-center justify-between">
             <div>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tickets Pendientes</p>
               <h3 className="text-2xl font-black text-slate-800 tracking-tight">{pendingCount}</h3>
             </div>
             <div className="w-9 h-9 bg-slate-100 text-slate-600 rounded flex items-center justify-center">
               <Clock className="w-5 h-5" />
             </div>
          </div>

          <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-center justify-between">
             <div>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Demora Respuesta</p>
               <h3 className="text-2xl font-black text-emerald-600 tracking-tight">~2m</h3>
             </div>
             <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded flex items-center justify-center">
               <TrendingUp className="w-5 h-5" />
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Agent Workload Table */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" /> Rendimiento de Vendedores
              </h2>
              <span className="text-[9px] font-black uppercase bg-indigo-50 text-indigo-750 px-2 py-0.5 rounded border border-indigo-100">
                Supervisor Monitor
              </span>
            </div>
            <div className="p-0 flex-1 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-450 font-black uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5">Vendedor asignado</th>
                    <th className="px-4 py-2.5 text-center">Chat Abiertos</th>
                    <th className="px-4 py-2.5 text-center">Msg Sin Leer</th>
                    <th className="px-4 py-2.5 text-right">Estado Sistema</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agents.map(agent => {
                    const assigned = conversations.filter(c => c.assigned_to === agent.id && c.status !== 'closed');
                    const unread = assigned.reduce((acc, c) => acc + c.unread_count, 0);
                    return (
                      <tr key={agent.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded bg-slate-950 text-white font-mono flex items-center justify-center text-[10px] font-black uppercase">
                              {agent.full_name.charAt(0)}
                            </div>
                            <span className="font-bold text-slate-850 text-xs">{agent.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-900">{assigned.length} chats</td>
                        <td className="px-4 py-3 text-center">
                          {unread > 0 ? (
                            <span className="bg-orange-100 text-orange-700 text-[10px] font-extrabold px-2 py-0.5 rounded">
                              {unread} msgs
                            </span>
                          ) : (
                            <span className="text-slate-300 font-bold">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                           <span className="text-[10px] font-extrabold text-indigo-650 flex items-center justify-end gap-1">
                             <span className="w-1.5 h-1.5 bg-indigo-600 rounded"></span> Conectado
                           </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Attention prioritization */}
          <div className="bg-white border text-xs text-slate-600 border-slate-200 rounded shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-orange-50/50 flex justify-between items-center">
              <h2 className="text-xs font-bold text-orange-850 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-orange-600" /> Atención Prioritaria
              </h2>
            </div>
            <div className="p-0 flex-1 overflow-y-auto max-h-[320px]">
              {criticalChats.length === 0 ? (
                <div className="p-6 text-center text-slate-400 flex flex-col items-center">
                   <CheckCircle2 className="w-8 h-8 text-indigo-200 mb-2" />
                   <p className="font-semibold text-xs uppercase tracking-wider">Bandeja al día</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {criticalChats.map(c => {
                    const agent = profiles.find(p => p.id === c.assigned_to);
                    return (
                      <li key={c.id} className="p-3 hover:bg-slate-50 transition-colors">
                        <div className="flex justify-between items-start mb-0.5">
                           <span className="font-bold text-slate-800 text-xs">Lead ID: #{c.id.substring(0,6)}</span>
                           <span className="text-[10px] text-orange-700 font-extrabold uppercase bg-orange-100 px-1.5 rounded">{c.unread_count} sin contestar</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">Hora: {format(new Date(c.last_message_at), 'HH:mm')}</p>
                        <p className="text-[11px] font-semibold text-slate-600 mt-1 italic">Asignación: {agent ? agent.full_name : 'No Asignado'}</p>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
