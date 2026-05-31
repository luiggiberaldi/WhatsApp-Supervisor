import { MessageSquare } from 'lucide-react';

export default function EmptyInbox() {
  return (
    <div className="hidden lg:flex flex-1 items-center justify-center bg-slate-50/50">
      <div className="text-center">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-4 text-emerald-200">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700">Ninguna conversación seleccionada</h3>
        <p className="text-slate-500 text-sm mt-1 max-w-sm">Selecciona una conversación de la lista para leer los mensajes e interactuar.</p>
      </div>
    </div>
  );
}
