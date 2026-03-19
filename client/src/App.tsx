import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Home from './pages/Home';
import PilotView from './pages/PilotView';
import ControllerView from './pages/ControllerView';
import AuthCallback from './pages/AuthCallback';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Settings from './pages/Settings';
import ProtectedRoute from './components/common/ProtectedRoute';
import RatingGate from './components/common/RatingGate';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/settings" element={
          <ProtectedRoute><Settings /></ProtectedRoute>
        } />
        <Route path="/pilot" element={
          <ProtectedRoute><PilotView /></ProtectedRoute>
        } />
        <Route path="/controller" element={
          <ProtectedRoute><RatingGate minRating={2}><ControllerView /></RatingGate></ProtectedRoute>
        } />
      </Routes>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
