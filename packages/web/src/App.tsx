import { useEffect, type ReactNode } from 'react';
import { useApp } from './AppContext';
import { usePath, navigate } from './lib/router';
import Login from './screens/Login';
import Register from './screens/Register';
import Today from './screens/Today';
import History from './screens/History';
import DayView from './screens/DayView';
import Privacy from './screens/Privacy';

export default function App(): ReactNode {
  const { boot } = useApp();
  const path = usePath();

  const isAuthRoute = path === '/login' || path === '/register';

  useEffect(() => {
    if (boot === 'anon' && !isAuthRoute) navigate('/login', true);
    if (boot === 'authed' && isAuthRoute) navigate('/', true);
  }, [boot, isAuthRoute]);

  if (boot === 'loading') {
    return <div className="min-h-screen bg-paper" aria-busy="true" />;
  }

  if (boot === 'anon') {
    return path === '/register' ? <Register /> : <Login />;
  }

  if (path === '/history') return <History />;
  if (path === '/privacy') return <Privacy />;
  const day = /^\/day\/(\d{4}-\d{2}-\d{2})$/.exec(path);
  if (day?.[1]) return <DayView date={day[1]} />;
  return <Today />;
}
