import { useAppStore } from '../../store/appStore';
import { Users, MessageCircle, AlertTriangle, CheckCircle2, Clock, Inbox, UserPlus, MailQuestion } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../../lib/utils';

export default function SupervisionDashboard() {
  const conversations = useAppStore(state => state.conversations);
  const contacts = useAppStore(state => state.contacts);
  const profiles = useAppStore(state => state.profiles);

  const agents = profiles.filter(p => p.role === 'agent');
  const allCount = conversations.length;
  const openCount = conversations.filter(c => c.status !== 'closed').length;
  const newCount = conversations.filter(c => c.status === 'new').length;
  const assignedCount = conversations.filter(c => c.status === 'assigned').length;
  const pendingCount = conversations.filter(c => c.status === 'pending').length;
  const closedCount = conversations.filter(c => c.status === 'closed').length;
  const unreadCount = conversations.filter(c => c.unread_count > 0 && c.status !== 'closed').length;

  const criticalChats = conversations.filter(c => c.unread_count > 0 && c.status !== 'closed');
  const newUnassigned = conversations.filter(c => c.status === 'new' && !c.assigned_to);
  const recentActivity = [...conversations]
    .filter(c => c.last_message_at)
    .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
    .slice(0, 6);

  const getContact = (contactId: string) => contacts.find(c => c.id === contactId);
  const getAgent = (agentId: string | null) => profiles.find(p => p.id === agentId);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Page title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-2">
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight uppercase">Supervisión en Tiempo Real</h1>
            <p className="text-xs text-slate-500 font-medium">Panel de control — conversaciones, agentes y prioridades operativas.</p>
          </div>
          <div className="flex gap-2">
            <span className="px-2.5 py-1 text-[10px] font-black uppercase text-indigo-750 bg-indigo-50 border border-indigo-150 rounded">Métricas Seguras</span>
            <span className="px-2.5 py-1 text-[10px] font-black uppercase text-slate-600 bg-slate-100 border border-slate-200 rounded">Live Feed</span>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total</p>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">{allCount}</h3>
            </div>
            <div className="w-8 h-8 bg-slate-100 text-slate-500 rounded flex items-center justify-center">
              <Inbox className="w-4 h-4" />
            </div>
          </div>
          <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Abiertas</p>
              <h3 className="text-xl font-black text-indigo-600 tracking-tight">{openCount}</h3>
            </div>
            <div className="w-8 h-8 bg-indigo-50 text-indigo-500 rounded flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nuevas</p>
              <h3 className="text-xl font-black text-orange-600 tracking-tight">{newCount}</h3>
            </div>
            <div className="w-8 h-8 bg-orange-50 text-orange-500 rounded flex items-center justify-center">
              <MailQuestion className="w-4 h-4" />
            </div>
          </div>
          <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Asignadas</p>
              <h3 className="text-xl font-black text-sky-600 tracking-tight">{assignedCount}</h3>
            </div>
            <div className="w-8 h-8 bg-sky-50 text-sky-500 rounded flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
          </div>
          <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pendientes</p>
              <h3 className="text-xl font-black text-slate-700 tracking-tight">{pendingCount}</h3>
            </div>
            <div className="w-8 h-8 bg-slate-100 text-slate-500 rounded flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">No Leídos</p>
              <h3 className={cn("text-xl font-black tracking-tight", unreadCount > 0 ? "text-amber-600" : "text-slate-400")}>{unreadCount}</h3>
            </div>
            <div className={cn("w-8 h-8 rounded flex items-center justify-center", unreadCount > 0 ? "bg-amber-50 text-amber-500" : "bg-slate-100 text-slate-400")}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Agent Workload Table */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" /> Carga de Agentes
              </h2>
              <span className="text-[9px] font-black uppercase bg-indigo-50 text-indigo-750 px-2 py-0.5 rounded border border-indigo-100">
                {agents.length} agentes
              </span>
            </div>
            <div className="p-0 flex-1 overflow-x-auto">
              {agents.length === 0 ? (
                <div className="p-6 text-center text-slate-400 flex flex-col items-center">
                  <Users className="w-8 h-8 text-slate-200 mb-2" />
                  <p className="font-semibold text-xs uppercase tracking-wider">No hay agentes registrados</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-450 font-black uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Agente</th>
                      <th className="px-4 py-2.5 text-center">Chats Activos</th>
                      <th className="px-4 py-2.5 text-center">No Leídos</th>
                      <th className="px-4 py-2.5 text-center">Nuevos</th>
                      <th className="px-4 py-2.5 text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {agents.map(agent => {
                      const assigned = conversations.filter(c => c.assigned_to === agent.id && c.status !== 'closed');
                      const unread = assigned.reduce((acc, c) => acc + c.unread_count, 0);
                      const newAssigned = assigned.filter(c => c.status === 'new').length;
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
                          <td className="px-4 py-3 text-center font-bold text-slate-900">{assigned.length}</td>
                          <td className="px-4 py-3 text-center">
                            {unread > 0 ? (
                              <span className="bg-orange-100 text-orange-700 text-[10px] font-extrabold px-2 py-0.5 rounded">
                                {unread}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-bold">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {newAssigned > 0 ? (
                              <span className="bg-orange-50 text-orange-600 text-[10px] font-extrabold px-2 py-0.5 rounded">
                                {newAssigned}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-bold">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-[10px] font-extrabold text-emerald-600 flex items-center justify-end gap-1">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Activo
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Nuevas sin asignar */}
          <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-orange-50/50 flex justify-between items-center">
              <h2 className="text-xs font-bold text-orange-850 uppercase tracking-wider flex items-center gap-1.5">
                <MailQuestion className="w-4 h-4 text-orange-600" /> Nuevas Sin Asignar
              </h2>
              {newUnassigned.length > 0 && (
                <span className="text-[10px] font-extrabold bg-orange-100 text-orange-700 px-2 py-0.5 rounded">{newUnassigned.length}</span>
              )}
            </div>
            <div className="p-0 flex-1 overflow-y-auto max-h-[280px]">
              {newUnassigned.length === 0 ? (
                <div className="p-6 text-center text-slate-400 flex flex-col items-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-200 mb-2" />
                  <p className="font-semibold text-xs uppercase tracking-wider">Todas asignadas</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {newUnassigned.map(c => {
                    const contact = getContact(c.contact_id);
                    return (
                      <li key={c.id} className="p-3 hover:bg-slate-50 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-slate-800 text-xs truncate">
                            {contact?.display_name || contact?.phone || 'Desconocido'}
                          </span>
                          <span className="text-[10px] text-orange-700 font-bold whitespace-nowrap ml-2">
                            {c.unread_count > 0 && `${c.unread_count} no leídos`}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">{c.last_message_preview}</p>
                        <p className="text-[9px] text-slate-400 mt-1">
                          {c.last_message_at ? format(new Date(c.last_message_at), "d MMM HH:mm", { locale: es }) : '--'}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

        </div>

        {/* Recent Activity */}
        <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" /> Últimas Conversaciones Actualizadas
            </h2>
            <span className="text-[9px] font-black uppercase text-slate-500 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
              Tiempo Real
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-450 font-black uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5">Contacto</th>
                  <th className="px-4 py-2.5">Teléfono</th>
                  <th className="px-4 py-2.5">Último Mensaje</th>
                  <th className="px-4 py-2.5 text-center">Estado</th>
                  <th className="px-4 py-2.5 text-center">No Leídos</th>
                  <th className="px-4 py-2.5 text-center">Agente</th>
                  <th className="px-4 py-2.5 text-right">Actualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentActivity.map(c => {
                  const contact = getContact(c.contact_id);
                  const agent = getAgent(c.assigned_to);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-800">{contact?.display_name || contact?.phone || '--'}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono">{contact?.phone || '--'}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{c.last_message_preview || '--'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm",
                          c.status === 'new' ? "bg-orange-100 text-orange-700" :
                          c.status === 'assigned' ? "bg-sky-100 text-sky-700" :
                          c.status === 'pending' ? "bg-emerald-100 text-emerald-700" :
                          "bg-slate-200 text-slate-500"
                        )}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.unread_count > 0 ? (
                          <span className="bg-amber-100 text-amber-700 text-[10px] font-extrabold px-2 py-0.5 rounded">{c.unread_count}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500">{agent?.full_name || 'Sin asignar'}</td>
                      <td className="px-4 py-3 text-right text-slate-400 tabular-nums text-[10px]">
                        {c.last_message_at ? format(new Date(c.last_message_at), "d MMM HH:mm", { locale: es }) : '--'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom summary */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-200 pt-4">
          <span>
            <strong className="text-slate-600">{allCount}</strong> conversaciones totales &middot;
            <strong className="text-slate-600 ml-1">{closedCount}</strong> cerradas &middot;
            <strong className="text-indigo-600 ml-1">{openCount}</strong> abiertas
          </span>
          <span>
            {criticalChats.length > 0
              ? `${criticalChats.length} conversaciones requieren atención`
              : 'Bandeja al día'}
          </span>
        </div>

      </div>
    </div>
  );
}
