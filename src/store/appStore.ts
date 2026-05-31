import { create } from 'zustand';
import { demoProfiles, demoContacts, demoConversations, demoMessages, demoNotes } from './demoData';

interface AppState {
  // Auth
  currentUser: any | null;
  setCurrentUser: (user: any) => void;
  
  // Data
  profiles: any[];
  contacts: any[];
  conversations: any[];
  messages: any[];
  notes: any[];
  
  // Actions
  addMessage: (msg: any) => void;
  updateConversationStatus: (id: string, status: string) => void;
  assignConversation: (id: string, userId: string | null) => void;
  addNote: (note: any) => void;
  readConversation: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Default login as supervisor for demo
  currentUser: demoProfiles[0],
  setCurrentUser: (user) => set({ currentUser: user }),
  
  profiles: demoProfiles,
  contacts: demoContacts,
  conversations: demoConversations,
  messages: demoMessages,
  notes: demoNotes,
  
  addMessage: (msg) => set((state) => {
    const newMsg = { ...msg, id: `m_${Date.now()}`, created_at: new Date().toISOString(), status: 'sent' };
    
    // update conv
    const convs = state.conversations.map(c => {
      if (c.id === msg.conversation_id) {
        return { 
          ...c, 
          last_message_preview: msg.content, 
          last_message_at: newMsg.created_at,
          unread_count: msg.direction === 'inbound' ? c.unread_count + 1 : 0
        };
      }
      return c;
    });

    return { 
      messages: [...state.messages, newMsg],
      conversations: convs
    };
  }),

  updateConversationStatus: (id, status) => set((state) => ({
    conversations: state.conversations.map(c => c.id === id ? { ...c, status } : c)
  })),

  assignConversation: (id, userId) => set((state) => ({
    conversations: state.conversations.map(c => c.id === id ? { ...c, assigned_to: userId, status: userId ? 'assigned' : 'new' } : c)
  })),

  addNote: (note) => set((state) => ({
    notes: [...state.notes, { ...note, id: `n_${Date.now()}`, created_at: new Date().toISOString() }]
  })),

  readConversation: (id) => set((state) => ({
    conversations: state.conversations.map(c => c.id === id ? { ...c, unread_count: 0 } : c)
  }))
}));
