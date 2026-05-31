// Mock data for the MVP demo mode

export const demoProfiles = [
  { id: 'u1', email: 'supervisor@demo.com', full_name: 'Marta (Supervisor)', role: 'supervisor' },
  { id: 'u2', email: 'agent1@demo.com', full_name: 'Carlos (Agent)', role: 'agent' },
  { id: 'u3', email: 'agent2@demo.com', full_name: 'Lucia (Agent)', role: 'agent' },
];

export const demoContacts = [
  { id: 'c1', phone: '5491122334455', display_name: 'Juan Perez', avatar_url: null },
  { id: 'c2', phone: '5491198765432', display_name: 'Maria Gomez', avatar_url: null },
  { id: 'c3', phone: '5491155556666', display_name: 'Empresa XYZ', avatar_url: null },
  { id: 'c4', phone: '5491144447777', display_name: '+54 9 11 4444-7777', avatar_url: null },
];

export const demoConversations = [
  {
    id: 'conv1',
    contact_id: 'c1',
    status: 'assigned',
    assigned_to: 'u2',
    last_message_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    last_message_preview: '¿Tienen stock del modelo XP?',
    unread_count: 1,
  },
  {
    id: 'conv2',
    contact_id: 'c2',
    status: 'new',
    assigned_to: null,
    last_message_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    last_message_preview: 'Quisiera un presupuesto.',
    unread_count: 2,
  },
  {
    id: 'conv3',
    contact_id: 'c3',
    status: 'closed',
    assigned_to: 'u3',
    last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    last_message_preview: 'Perfecto, procedemos con eso.',
    unread_count: 0,
  },
  {
    id: 'conv4',
    contact_id: 'c4',
    status: 'pending',
    assigned_to: 'u2',
    last_message_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    last_message_preview: 'Lo reviso y te aviso.',
    unread_count: 0,
  }
];

export const demoMessages = [
  {
    id: 'm1',
    conversation_id: 'conv1',
    direction: 'inbound',
    content: 'Hola buenas tardes',
    created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    status: 'received'
  },
  {
    id: 'm2',
    conversation_id: 'conv1',
    direction: 'outbound',
    content: 'Hola Juan, ¿en qué te puedo ayudar?',
    sent_by_user_id: 'u2',
    created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    status: 'read'
  },
  {
    id: 'm3',
    conversation_id: 'conv1',
    direction: 'inbound',
    content: '¿Tienen stock del modelo XP?',
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    status: 'received'
  },
  {
    id: 'm4',
    conversation_id: 'conv2',
    direction: 'inbound',
    content: 'Hola!',
    created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    status: 'received'
  },
  {
    id: 'm5',
    conversation_id: 'conv2',
    direction: 'inbound',
    content: 'Quisiera un presupuesto.',
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    status: 'received'
  }
];

export const demoNotes = [
  {
    id: 'n1',
    conversation_id: 'conv1',
    user_id: 'u1',
    content: 'Cliente VIP, tratar con prioridad.',
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  }
];
