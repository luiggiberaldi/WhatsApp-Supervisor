import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { Search, Filter, Clock, MoreVertical, Phone, CheckCircle2, Circle, MessageSquare } from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ChatView from './ChatView';
import ContactPanel from './ContactPanel';

export default function Inbox() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const currentUser = useAppStore(state => state.currentUser);
  const profiles = useAppStore(state => state.profiles);
  const contacts = useAppStore(state => state.contacts);
  
  const allConversations = useAppStore(state => state.conversations);
  
  // Filter conversations based on role
  // Sup: sees all. Agent: sees assigned to them or 'new'
  const accessibleConversations = allConversations.filter(c => 
    currentUser.role === 'supervisor' || c.assigned_to === currentUser.id || c.status === 'new'
  );

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = accessibleConversations.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    const contact = contacts.find(cont => cont.id === c.contact_id);
    if (searchQuery && contact) {
      const q = searchQuery.toLowerCase();
      const matchName = contact.display_name?.toLowerCase().includes(q);
      const matchPhone = contact.phone.includes(q);
      if (!matchName && !matchPhone) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

  const activeConversation = accessibleConversations.find(c => c.id === conversationId);

  return (
    <div className="flex h-full w-full bg-slate-50">
      {/* 1. Left List: Inbox */}
      <div className={cn(
        "bg-white border-r border-slate-200 flex flex-col transition-all duration-300 shadow-sm",
        activeConversation ? "hidden lg:flex w-[320px] xl:w-[380px]" : "w-full lg:w-[320px] xl:w-[380px]"
      )}>
        <div className="p-4 border-b border-slate-200 flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 tracking-tight uppercase">Conversaciones</h2>
            <button className="p-1.5 hover:bg-slate-100 rounded text-slate-500 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
          
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o celular..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium placeholder:font-normal placeholder:text-slate-400"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0">
            {['all', 'new', 'assigned', 'pending', 'closed'].map(status => (
              <button 
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all",
                  filterStatus === status 
                    ? "bg-indigo-600 text-white shadow-sm" 
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-850"
                )}
              >
                {status === 'all' ? 'Todas' : status === 'new' ? 'Nuevas' : status === 'assigned' ? 'Asignadas' : status === 'pending' ? 'Pendientes' : 'Cerradas'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-slate-500 flex flex-col items-center">
              <CheckCircle2 className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-xs font-semibold uppercase tracking-wider">No hay conversaciones</p>
            </div>
          ) : (
            filteredConversations.map(conv => {
              const contact = contacts.find(c => c.id === conv.contact_id);
              const assignee = profiles.find(p => p.id === conv.assigned_to);
              const isSelected = conversationId === conv.id;
              
              const avatarSeed = contact?.display_name || contact?.phone || 'Felix';
              const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`;

              return (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/inbox/${conv.id}`)}
                  className={cn(
                    "w-full text-left p-4 flex gap-3 cursor-pointer transition-all relative border-l-4",
                    isSelected 
                      ? "bg-indigo-50 border-indigo-600" 
                      : "bg-white border-transparent hover:bg-slate-50"
                  )}
                >
                  <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden bg-slate-150 border border-slate-200 shadow-sm">
                     <img src={avatarUrl} alt="Avatar" referrerPolicy="no-referrer" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <span className="font-bold text-sm text-slate-900 truncate">
                        {contact?.display_name || contact?.phone}
                      </span>
                      <span className="text-[10px] font-medium tabular-nums text-slate-400 shrink-0 ml-2">
                        {format(new Date(conv.last_message_at), 'HH:mm')}
                      </span>
                    </div>
                    
                    <p className={cn(
                      "text-xs truncate mb-2",
                      conv.unread_count > 0 ? "text-slate-900 font-semibold" : "text-slate-500"
                    )}>
                      {conv.last_message_preview}
                    </p>
                    
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm inline-block",
                        conv.status === 'new' ? "bg-orange-100 text-orange-700" :
                        conv.status === 'assigned' ? "bg-indigo-100 text-indigo-700" :
                        conv.status === 'pending' ? "bg-green-100 text-green-700" :
                        "bg-slate-200 text-slate-600"
                      )}>
                        {conv.status}
                      </span>
                      {assignee && (
                        <span className="text-[10px] text-slate-400 font-semibold truncate italic">
                          Asignado: {assignee.full_name}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {conv.unread_count > 0 && (
                    <div className="flex flex-col items-end justify-center shrink-0 self-center pl-1">
                      <span className="bg-indigo-600 text-white font-extrabold text-[10px] leading-none h-5 px-1.5 rounded-full min-w-[20px] max-w-[32px] text-center shadow-[0_1px_4px_rgba(79,70,229,0.3)] flex items-center justify-center animate-pulse">
                        {conv.unread_count}
                      </span>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Middle & Right: Chat & Panel */}
      {activeConversation ? (
        <div className="flex-1 flex min-w-0 bg-slate-50 relative">
          <ChatView conversation={activeConversation} />
          <ContactPanel conversation={activeConversation} />
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center bg-slate-50/50">
          <div className="text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-4 text-emerald-200">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">Ninguna conversación seleccionada</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm">Selecciona una conversación de la lista para leer los mensajes e interactuar.</p>
          </div>
        </div>
      )}
    </div>
  );
}
