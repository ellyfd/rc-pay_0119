import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// P2-7: 统一获取当前用户（12个文件共用）
export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setIsLoading(true);
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (err) {
        setError(err?.message || 'Failed to load user');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  return { user, isLoading, error };
}