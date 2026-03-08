import { useState, useEffect, useCallback } from 'react';
import { apiPush } from '../lib/api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading';

export function usePush() {
  const [state, setState] = useState<PushState>('loading');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    const perm = Notification.permission;
    if (perm === 'denied') {
      setState('denied');
      return;
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? 'subscribed' : 'unsubscribed');
    });
  }, []);

  const subscribe = useCallback(async () => {
    setState('loading');
    try {
      const { key } = await apiPush.getVapidKey();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
      await apiPush.subscribe(sub.toJSON());
      setState('subscribed');
    } catch (err) {
      console.error('Push subscribe error:', err);
      setState(Notification.permission === 'denied' ? 'denied' : 'unsubscribed');
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setState('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiPush.unsubscribe(sub.endpoint);
        await sub.unsubscribe();
      }
      setState('unsubscribed');
    } catch (err) {
      console.error('Push unsubscribe error:', err);
      setState('subscribed');
    }
  }, []);

  const getEndpoint = useCallback(async (): Promise<string | null> => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub?.endpoint ?? null;
  }, []);

  return { state, subscribe, unsubscribe, getEndpoint };
}
