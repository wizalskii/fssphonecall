import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Home from './pages/Home';
import PilotView from './pages/PilotView';
import ControllerView from './pages/ControllerView';
import AuthCallback from './pages/AuthCallback';
import PrivacyPolicy from './pages/PrivacyPolicy';
import ProtectedRoute from './components/common/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/pilot" element={
          <ProtectedRoute><PilotView /></ProtectedRoute>
        } />
        <Route path="/controller" element={
          <ProtectedRoute><ControllerView /></ProtectedRoute>
        } />
      </Routes>
    </AuthProvider>
  );
}

export default App;
