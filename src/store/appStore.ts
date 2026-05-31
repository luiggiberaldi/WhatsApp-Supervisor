import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { demoProfiles, demoContacts, demoConversations, demoMessages, demoNotes } from './demoData';

interface AppState {
  // Auth
  currentUser: any | null;
  setCurrentUser: (user: any) => void;
  authLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;

  initAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;

  // Data
  profiles: any[];
  contacts: any[];
  conversations: any[];
  messages: any[];
  notes: any[];

  // UI state
  selectedConversationId: string | null;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  sendError: string | null;
  clearSendError: () => void;

  // Legacy actions
  addMessage: (msg: any) => void;
  updateConversationStatus: (id: string, status: string) => void;
  assignConversation: (id: string, userId: string | null) => void;
  addNote: (note: any) => void;
  readConversation: (id: string) => void;

  // API actions
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, to: string, text: string) => Promise<any>;

  // Realtime actions
  addConversationRealtime: (conv: any) => void;
  updateConversationRealtime: (conv: any) => void;
  addMessageRealtime: (msg: any) => void;

  // PATCH unread
  markConversationRead: (id: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Auth — start null, initAuth will hydrate
  currentUser: null,
  authLoading: true,
  authError: null,
  clearAuthError: () => set({ authError: null }),

  initAuth: async () => {
    if (!supabase) {
      // No Supabase configured — use demo
      set({ currentUser: demoProfiles[0], authLoading: false });
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profile) {
          set({ currentUser: profile, authLoading: false });
          return;
        }
      }
      set({ authLoading: false });
    } catch {
      set({ authLoading: false });
    }
  },

  login: async (email, password) => {
    if (!supabase) {
      // Fallback to demo matching by email
      const demo = demoProfiles.find(p => p.email === email);
      if (demo) {
        set({ currentUser: demo, authError: null });
        return;
      }
      set({ authError: 'No hay conexión con Supabase. Usa el modo demo.' });
      return;
    }
    set({ authLoading: true, authError: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error('No se pudo iniciar sesión');
      let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();
      if (!profile) {
        const { data: newProfile } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: data.user.email || email,
            full_name: data.user.email?.split('@')[0] || 'Usuario',
            role: 'agent',
          })
          .select()
          .single();
        profile = newProfile;
      }
      if (profile) {
        set({ currentUser: profile, authLoading: false });
      } else {
        throw new Error('No se pudo crear el perfil de usuario');
      }
    } catch (e: any) {
      set({ authError: e.message || 'Error al iniciar sesión', authLoading: false });
      throw e;
    }
  },

  logout: async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    set({ currentUser: null, selectedConversationId: null });
  },

  setCurrentUser: (user) => set({ currentUser: user }),

  // Data
  profiles: demoProfiles,
  contacts: demoContacts,
  conversations: demoConversations,
  messages: demoMessages,
  notes: demoNotes,

  selectedConversationId: null,
  isLoadingConversations: false,
  isLoadingMessages: false,
  isSendingMessage: false,
  sendError: null,
  clearSendError: () => set({ sendError: null }),

  markConversationRead: async (id) => {
    set((state) => ({
      selectedConversationId: id,
      conversations: state.conversations.map(c =>
        c.id === id ? { ...c, unread_count: 0 } : c
      ),
    }));
    if (id) {
      try {
        await fetch(`/api/conversations/${id}/read`, { method: 'PATCH' });
      } catch {
        // Local reset already done, don't block UX
      }
    }
  },

  setSelectedConversationId: (id) => {
    get().markConversationRead(id as string);
  },

  // Legacy demo actions
  addMessage: (msg) => set((state) => {
    const newMsg = { ...msg, id: `m_${Date.now()}`, created_at: new Date().toISOString(), status: 'sent' };
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
    return { messages: [...state.messages, newMsg], conversations: convs };
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
  })),

  // API actions
  fetchConversations: async () => {
    set({ isLoadingConversations: true });
    try {
      const res = await fetch('/api/conversations');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const raw = json.data || [];
      const contactMap = new Map<string, any>();
      raw.forEach((c: any) => {
        if (c.contact) contactMap.set(c.contact_id, { id: c.contact_id, ...c.contact });
      });
      set({
        conversations: raw,
        contacts: Array.from(contactMap.values()),
        isLoadingConversations: false,
      });
    } catch (e) {
      console.warn('[Store] API fetchConversations failed, using demo data:', e);
      set({ isLoadingConversations: false });
    }
  },

  fetchMessages: async (conversationId) => {
    set({ isLoadingMessages: true });
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      set({ messages: json.data || [], isLoadingMessages: false });
    } catch (e) {
      console.warn('[Store] API fetchMessages failed, using demo data:', e);
      set({ isLoadingMessages: false });
    }
  },

  sendMessage: async (conversationId, to, text) => {
    if (!to) {
      set({ sendError: 'El contacto no tiene un número de teléfono válido.', isSendingMessage: false });
      return;
    }
    set({ isSendingMessage: true, sendError: null });
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, to, text }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Send failed');
      const newMsg = {
        id: json.messageId || `temp_${Date.now()}`,
        conversation_id: conversationId,
        contact_id: null,
        direction: 'outbound',
        content: text,
        message_type: 'text',
        provider_message_id: json.messageId,
        sent_by_user_id: null,
        status: json.status || 'sent',
        raw_payload: null,
        created_at: new Date().toISOString(),
      };
      set((state) => ({
        messages: [...state.messages, newMsg],
        conversations: state.conversations.map(c =>
          c.id === conversationId
            ? { ...c, last_message_preview: text, last_message_at: new Date().toISOString() }
            : c
        ),
        isSendingMessage: false,
      }));
      return json;
    } catch (e: any) {
      set({ isSendingMessage: false, sendError: e.message || 'Error al enviar mensaje' });
      throw e;
    }
  },

  // Realtime actions
  addConversationRealtime: (conv) => set((state) => {
    const exists = state.conversations.find(c => c.id === conv.id);
    if (exists) {
      return {
        conversations: state.conversations.map(c =>
          c.id === conv.id ? { ...c, ...conv } : c
        ),
      };
    }
    return { conversations: [conv, ...state.conversations] };
  }),

  updateConversationRealtime: (conv) => set((state) => ({
    conversations: state.conversations.map(c =>
      c.id === conv.id ? { ...c, ...conv } : c
    ),
  })),

  addMessageRealtime: (msg) => set((state) => {
    const exists = state.messages.find(m => m.id === msg.id);
    if (exists) return state;
    return { messages: [...state.messages, msg] };
  }),
}));
