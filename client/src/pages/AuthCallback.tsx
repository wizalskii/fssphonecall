import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { saveAuthToken } from '../context/AuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      saveAuthToken(token);
      // Full reload so AuthProvider picks up the new token from localStorage
      window.location.href = '/';
    } else {
      navigate('/?error=auth_failed');
    }
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-600">Signing in...</p>
    </div>
  );
}
