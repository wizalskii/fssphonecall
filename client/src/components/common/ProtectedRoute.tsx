import type { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import Card from './Card';
import Button from './Button';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
          <p className="text-gray-600 mb-6">You need to sign in with your VATSIM account to continue.</p>
          <Button variant="primary" size="lg" onClick={login}>
            Sign in with VATSIM
          </Button>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
