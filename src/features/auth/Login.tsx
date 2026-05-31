import { useAppStore } from '../../store/appStore';
import { MessageSquare, Shield, User } from 'lucide-react';
import { demoProfiles } from '../../store/demoData';

export default function Login() {
  const setCurrentUser = useAppStore(state => state.setCurrentUser);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 text-emerald-600">
            <MessageSquare className="w-8 h-8" />
          </div>
        </div>
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">WhatsApp Supervisor MVP</h1>
          <p className="text-slate-500 mt-2 text-sm">Selecciona un usuario de demo para continuar</p>
        </div>

        <div className="space-y-4">
          {demoProfiles.map(profile => (
            <button
              key={profile.id}
              onClick={() => setCurrentUser(profile)}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${profile.role === 'supervisor' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'} group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors`}>
                  {profile.role === 'supervisor' ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 group-hover:text-emerald-800 transition-colors">{profile.full_name}</p>
                  <p className="text-xs text-slate-500 capitalize">{profile.email}</p>
                </div>
              </div>
              <span className="text-emerald-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Conectar
              </span>
            </button>
          ))}
        </div>
        
        <div className="mt-8 text-center border-t border-slate-100 pt-6">
           <p className="text-xs text-slate-400">Modo Demo Local • Datos No Persistentes</p>
        </div>
      </div>
    </div>
  );
}
