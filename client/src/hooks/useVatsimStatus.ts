import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface VatsimStatus {
  online: boolean;
  type: 'pilot' | 'controller' | 'atis' | null;
  callsign: string | null;
  frequency: string | null;
  requireConnection: boolean;
}

export function useVatsimStatus() {
  const { token, user } = useAuth();
  const [status, setStatus] = useState<VatsimStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !user) {
      setStatus(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/vatsim-status?cid=${user.cid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && !cancelled) {
          setStatus(await res.json());
        }
      } catch {
        // Silently fail — status is optional
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Poll every 30s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token, user]);

  return { status, loading };
}
