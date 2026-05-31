import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import InboxLayout from './features/inbox/InboxLayout';
import ChatView from './features/inbox/ChatView';
import EmptyInbox from './features/inbox/EmptyInbox';
import SupervisionDashboard from './features/supervision/Dashboard';
import Login from './features/auth/Login';
import { useAppStore } from './store/appStore';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const currentUser = useAppStore(state => state.currentUser);
  const authLoading = useAppStore(state => state.authLoading);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

  return <>{children}</>;
}

export default function App() {
  const initAuth = useAppStore(state => state.initAuth);
  const currentUser = useAppStore(state => state.currentUser);

  useEffect(() => {
    initAuth();
  }, []);

  return (
    <AuthGuard>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/conversations" replace />} />
            <Route path="conversations" element={<InboxLayout />}>
              <Route index element={<EmptyInbox />} />
              <Route path=":conversationId" element={<ChatView />} />
            </Route>
            {currentUser?.role === 'supervisor' && (
              <Route path="supervision" element={<SupervisionDashboard />} />
            )}
          </Route>
        </Routes>
      </Router>
    </AuthGuard>
  );
}
