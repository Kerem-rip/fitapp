// Kullanıcı adı yazılırken boş mu diye canlı kontrol (kısa bir beklemeden sonra).
import { validateUsername } from '@fitapp/shared';
import { useEffect, useState } from 'react';
import { api } from '@/api/client';

export type UsernameStatus = 'empty' | 'invalid' | 'checking' | 'free' | 'taken' | 'unknown';

export function useUsernameCheck(username: string): { status: UsernameStatus; message?: string } {
  const [status, setStatus] = useState<UsernameStatus>('empty');
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    const value = username.trim().toLowerCase();
    if (!value) {
      setStatus('empty');
      setMessage(undefined);
      return;
    }
    const error = validateUsername(value);
    if (error) {
      setStatus('invalid');
      setMessage(error);
      return;
    }
    setStatus('checking');
    setMessage(undefined);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const free = await api.usernameAvailable(value);
        if (cancelled) return;
        setStatus(free ? 'free' : 'taken');
        setMessage(free ? undefined : 'Bu kullanıcı adı alınmış.');
      } catch {
        if (!cancelled) setStatus('unknown');
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  return { status, message };
}
