import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface RatingGateProps {
  minRating: number;
  children: ReactNode;
}

/**
 * Blocks access if the user's VATSIM rating is below the required minimum.
 * Must be placed inside a ProtectedRoute (user is guaranteed non-null).
 */
export default function RatingGate({ minRating, children }: RatingGateProps) {
  const { user } = useAuth();

  if (!user || user.rating < minRating) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
