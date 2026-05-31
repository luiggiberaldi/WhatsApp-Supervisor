import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Send, User as UserIcon, Clock, Check, CheckCheck, Menu } from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ChatView({ conversation }: { conversation: any }) {
  const currentUser = useAppStore(state => state.currentUser);
  const contacts = useAppStore(state => state.contacts);
  const allMessages = useAppStore(state => state.messages);
  const addMessage = useAppStore(state => state.addMessage);
  const readConversation = useAppStore(state => state.readConversation);
  
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const contact = contacts.find(c => c.id === conversation.contact_id);
  const messages = allMessages
    .filter(m => m.conversation_id === conversation.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (conversation.unread_count > 0) {
      readConversation(conversation.id);
    }
  }, [messages.length, conversation.id, conversation.unread_count, readConversation]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    addMessage({
      conversation_id: conversation.id,
      direction: 'outbound',
      content: inputText.trim(),
      sent_by_user_id: currentUser.id,
    });
    
    setInputText('');
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F3F4F6] relative h-full">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-10 w-full">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-slate-800 text-sm sm:text-base">
            {contact?.display_name || 'Desconocido'}{' '}
            <span className="text-slate-400 font-normal ml-2 text-xs sm:text-sm hidden sm:inline">{contact?.phone}</span>
          </h2>
          <div className="flex items-center gap-1 sm:ml-4 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
             <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Source: WhatsApp</span>
          </div>
        </div>
        <div className="flex gap-2">
           <span className="hidden sm:inline-block px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 rounded border border-indigo-100 self-center">
             {conversation.status === 'new' ? 'Nuevo Ticket' : 'Atendiendo'}
           </span>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto w-full p-6 space-y-4">
        {/* System entry milestone logo */}
        <div className="flex justify-center my-2">
          <div className="bg-indigo-50 text-indigo-750 px-4 py-2 rounded-lg border border-indigo-100 flex items-center gap-2.5 text-xs font-semibold max-w-lg shadow-sm">
             <div className="w-1.5 h-1.5 rounded-full bg-indigo-650 animate-pulse"></div>
             <p>Conversación asignada en tiempo real vía <strong>Evolution API Webhook</strong>.</p>
          </div>
        </div>

        {messages.map((msg, index) => {
          const isOutbound = msg.direction === 'outbound';
          const isInternal = msg.direction === 'internal';
          const showDate = index === 0 || format(new Date(msg.created_at), 'yyyy-MM-dd') !== format(new Date(messages[index - 1].created_at), 'yyyy-MM-dd');

          return (
            <div key={msg.id} className="w-full">
              {showDate && (
                <div className="flex justify-center my-4">
                  <span className="bg-slate-250 border border-slate-300/50 px-3 py-1 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-wider shadow-sm">
                    {format(new Date(msg.created_at), "d 'de' MMMM", { locale: es })}
                  </span>
                </div>
              )}
              
              <div className={cn("flex w-full mb-1.5", isOutbound || isInternal ? "justify-end" : "justify-start")}>
                {isInternal ? (
                  <div className="ml-auto flex items-start gap-3 max-w-[75%]">
                     <div className="bg-amber-50 p-3.5 rounded-xl shadow-sm border border-amber-200 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 border-b border-amber-150 pb-1">
                        <span className="text-[9px] font-black uppercase text-amber-600 tracking-wider">Nota Interna · Solo Sistema</span>
                      </div>
                      <p className="text-sm text-amber-950 font-medium whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      <span className="text-[10px] text-amber-500 block mt-1.5 text-right font-medium">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm relative group",
                    isOutbound 
                      ? "bg-indigo-600 text-white rounded-tr-none border border-indigo-550" 
                      : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                  )}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    <div className="flex justify-end items-center gap-1.5 mt-1.5 opacity-80">
                      <span className={cn(
                        "text-[9px] font-bold tracking-wide tabular-nums",
                        isOutbound ? "text-indigo-200" : "text-slate-400"
                      )}>
                        {format(new Date(msg.created_at), 'HH:mm')} · WhatsApp
                      </span>
                      {isOutbound && (
                        <span className="text-slate-200">
                          {msg.status === 'read' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400 font-bold" /> : <Check className="w-3.5 h-3.5 text-indigo-300" />}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} className="h-1 w-full" />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200 shrink-0">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="flex-1 relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escribe la respuesta por WhatsApp..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none h-[42px] leading-tight text-slate-800 placeholder:text-slate-400 font-sans font-medium"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!inputText.trim() || (currentUser.role === 'agent' && conversation.assigned_to !== currentUser.id && conversation.status !== 'new')}
            className="h-[42px] w-[42px] bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-all shadow-md shrink-0 hover:scale-[1.03]"
          >
            <Send className="w-4.5 h-4.5 transform rotate-90 ml-0.5 text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}
