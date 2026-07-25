import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { getMeta, setMeta } from './db/meta';
import { destroyDb } from './db/schema';
import { initSync, requestFlush } from './sync/worker';
import { api } from './lib/api';

// Boot per docs/04_APP_FLOW.md §3: local data present means the app renders,
// whatever the session or the network is doing. A 401 marks the session stale
// and nothing more.

export type Boot = 'loading' | 'authed' | 'anon';

interface AppState {
  boot: Boot;
  shopName: string;
  setAuthed: (user: { id: string; shopName: string }) => Promise<void>;
  signOutLocal: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}

interface MeResponse {
  id: string;
  shopName: string;
}

export function AppProvider(props: { children: ReactNode }): ReactNode {
  const [boot, setBoot] = useState<Boot>('loading');
  const [shopName, setShopName] = useState('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      const userId = await getMeta<string>('userId');
      if (userId) {
        // Local data exists: render Today immediately, refresh in background.
        setShopName((await getMeta<string>('shopName')) ?? '');
        if (alive) setBoot('authed');
        initSync();
        const res = await api<MeResponse>('/me');
        if (res.ok && res.data) {
          await setMeta('shopName', res.data.shopName);
          if (alive) setShopName(res.data.shopName);
        } else if (res.status === 401) {
          await setMeta('sessionStale', true);
        }
        return;
      }
      // No local data: this device has never signed in.
      const res = await api<MeResponse>('/me');
      if (res.ok && res.data) {
        await setMeta('userId', res.data.id);
        await setMeta('shopName', res.data.shopName);
        if (alive) {
          setShopName(res.data.shopName);
          setBoot('authed');
        }
        initSync();
        requestFlush();
      } else if (alive) {
        setBoot('anon');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setAuthed = async (user: { id: string; shopName: string }): Promise<void> => {
    await setMeta('userId', user.id);
    await setMeta('shopName', user.shopName);
    setShopName(user.shopName);
    setBoot('authed');
    initSync();
    requestFlush();
  };

  const signOutLocal = async (): Promise<void> => {
    await destroyDb();
    setBoot('anon');
    setShopName('');
  };

  return (
    <Ctx.Provider value={{ boot, shopName, setAuthed, signOutLocal }}>
      {props.children}
    </Ctx.Provider>
  );
}
