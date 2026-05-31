import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { User, Phone, MapPin, Tag, RefreshCcw, FileText, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';

export default function ContactPanel({ conversation }: { conversation: any }) {
  const currentUser = useAppStore(state => state.currentUser);
  const contacts = useAppStore(state => state.contacts);
  const profiles = useAppStore(state => state.profiles);
  const allNotes = useAppStore(state => state.notes);
  
  const assignConversation = useAppStore(state => state.assignConversation);
  const updateConversationStatus = useAppStore(state => state.updateConversationStatus);
  const addNote = useAppStore(state => state.addNote);

  const contact = contacts.find(c => c.id === conversation.contact_id);
  const contactNotes = allNotes.filter(n => n.conversation_id === conversation.id);
  
  const [newNote, setNewNote] = useState('');
  
  const agents = profiles.filter(p => p.role === 'agent');
  
  const handleAssign = (agentId: string) => {
    assignConversation(conversation.id, agentId);
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    addNote({
      conversation_id: conversation.id,
      user_id: currentUser.id,
      content: newNote.trim()
    });
    setNewNote('');
  };

  const avatarSeed = contact?.display_name || contact?.phone || 'Felix';
  const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`;

  return (
    <div className="hidden xl:flex w-64 bg-white border-l border-slate-200 flex-col h-full overflow-y-auto shrink-0 z-20">
      <div className="p-4 border-b border-slate-150 bg-slate-50/50">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Información del Lead</h3>
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl mb-2 flex items-center justify-center overflow-hidden border border-slate-250 shadow-sm">
             <img src={avatarUrl} alt="Avatar" referrerPolicy="no-referrer" />
          </div>
          <h4 className="font-bold text-sm text-slate-800 text-center truncate w-full">{contact?.display_name || 'Desconocio'}</h4>
          <p className="text-[10px] text-slate-500 font-medium font-mono tracking-tight mt-0.5">{contact?.phone}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 flex flex-col h-full">
        {/* Asignación (Supervisors only) */}
        {currentUser.role === 'supervisor' && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Asignar Vendedor</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
              value={conversation.assigned_to || ''}
              onChange={(e) => handleAssign(e.target.value)}
            >
              <option value="">Sin asignar (Nuevo)</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.full_name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Status Multi Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado de Ticket</label>
          <div className="grid grid-cols-2 gap-1.5">
             <button 
                onClick={() => updateConversationStatus(conversation.id, 'closed')}
                className={cn(
                  "py-1.5 text-[9px] font-bold rounded uppercase border transition-colors",
                  conversation.status === 'closed' 
                    ? "bg-slate-800 text-white border-slate-800" 
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                )}
             >
               Cerrado
             </button>
             <button 
                onClick={() => updateConversationStatus(conversation.id, 'pending')}
                className={cn(
                  "py-1.5 text-[9px] font-bold rounded uppercase border transition-colors",
                  conversation.status === 'pending' 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                )}
             >
               Pendiente
             </button>
             <button 
                onClick={() => updateConversationStatus(conversation.id, 'assigned')}
                className={cn(
                  "py-1.5 text-[9px] font-bold rounded uppercase border transition-colors col-span-2",
                  conversation.status === 'assigned' 
                    ? "bg-indigo-600 text-white border-indigo-600" 
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                )}
             >
               En Proceso (Asignado)
             </button>
          </div>
        </div>

        {/* Tags with border */}
        <div className="space-y-1.5 border-t border-slate-100 pt-3">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tags Comerciales</label>
          <div className="flex flex-wrap gap-1">
            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[9px] rounded-full font-extrabold shadow-[2px_2px_0_rgba(148,163,184,0.15)]">WhatsApp</span>
            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[9px] rounded-full font-extrabold shadow-[2px_2px_0_rgba(148,163,184,0.15)]">Lead Calificado</span>
            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-indigo-600 text-[9px] rounded-full font-extrabold shadow-[2px_2px_0_rgba(79,70,229,0.15)]">MVP Demo</span>
          </div>
        </div>

        {/* Recent notes drawer at the bottom */}
        <div className="mt-auto border-t border-slate-200 pt-4 flex flex-col min-h-[180px]">
           <div className="flex justify-between items-center mb-2 shrink-0">
             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
               <FileText className="w-3.5 h-3.5" /> Notas Internas
             </label>
           </div>
           
           <div className="flex-1 overflow-y-auto space-y-2 max-h-[160px] pb-2">
             {contactNotes.length === 0 ? (
                <p className="text-[10px] text-slate-405 text-center italic py-2">No hay anotaciones hechas por supervisores o agentes.</p>
             ) : (
                contactNotes.map(note => {
                  const author = profiles.find(p => p.id === note.user_id);
                  return (
                    <div key={note.id} className="bg-amber-50 border border-amber-200/60 p-2 rounded text-[11px] text-amber-950 font-medium">
                      <div className="flex justify-between items-center mb-0.5 text-[9px] font-black text-amber-800">
                        <span>{author?.full_name || 'Agente'}</span>
                        <span className="text-amber-500/80">{format(new Date(note.created_at), 'dd/MM HH:mm')}</span>
                      </div>
                      <p className="leading-snug">{note.content}</p>
                    </div>
                  )
                })
             )}
           </div>

           <form onSubmit={handleAddNote} className="flex gap-1.5 pt-2 border-t border-slate-100 shrink-0">
            <input 
              type="text" 
              placeholder="Nueva nota..."
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              className="flex-1 text-[11px] border border-slate-200 rounded px-2 py-1.5 bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400 font-semibold"
            />
            <button type="submit" disabled={!newNote.trim()} className="px-2.5 bg-slate-900 leading-none text-white rounded text-[10px] font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors">
              +
            </button>
           </form>
        </div>
      </div>
    </div>
  );
}
