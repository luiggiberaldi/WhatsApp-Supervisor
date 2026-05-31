import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Inbox from './features/inbox/Inbox';
import SupervisionDashboard from './features/supervision/Dashboard';
import Login from './features/auth/Login';
import { useAppStore } from './store/appStore';

export default function App() {
  const currentUser = useAppStore(state => state.currentUser);

  if (!currentUser) {
    return <Login />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/inbox" replace />} />
          <Route path="inbox" element={<Inbox />}>
            <Route path=":conversationId" element={<Inbox />} />
          </Route>
          {currentUser.role === 'supervisor' && (
            <Route path="supervision" element={<SupervisionDashboard />} />
          )}
        </Route>
      </Routes>
    </Router>
  );
}
