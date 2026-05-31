import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { MessageSquare, Shield, User, Loader2 } from 'lucide-react';
import { demoProfiles } from '../../store/demoData';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const login = useAppStore(state => state.login);
  const setCurrentUser = useAppStore(state => state.setCurrentUser);
  const authLoading = useAppStore(state => state.authLoading);
  const authError = useAppStore(state => state.authError);
  const clearAuthError = useAppStore(state => state.clearAuthError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch {
      // error set in store
    } finally {
      setSubmitting(false);
    }
  };

  const supabaseAvailable = !!supabase;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 text-emerald-600">
            <MessageSquare className="w-8 h-8" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">WhatsApp Supervisor</h1>
          <p className="text-slate-500 mt-2 text-sm">
            {supabaseAvailable ? 'Inicia sesión con tu cuenta' : 'Modo Demo — selecciona un usuario'}
          </p>
        </div>

        {authError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {authError}
          </div>
        )}

        {supabaseAvailable && !showDemo ? (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); clearAuthError(); }}
                  placeholder="tu@email.com"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 placeholder:text-slate-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearAuthError(); }}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 placeholder:text-slate-400"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !email.trim() || !password}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Ingresando...' : 'Iniciar Sesión'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setShowDemo(true)}
                className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2"
              >
                Modo Demo (sin conexión)
              </button>
            </div>
          </>
        ) : (
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
            {supabaseAvailable && (
              <div className="text-center pt-2">
                <button
                  onClick={() => setShowDemo(false)}
                  className="text-sm text-slate-400 hover:text-indigo-600 underline underline-offset-2"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 text-center border-t border-slate-100 pt-6">
          <p className="text-xs text-slate-400">
            {supabaseAvailable && !showDemo ? 'WhatsApp Supervisor v1.0.4' : 'Modo Demo Local • Datos No Persistentes'}
          </p>
        </div>
      </div>
    </div>
  );
}
