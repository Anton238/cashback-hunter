import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Home' },
  { to: '/add', label: 'Add' },
  { to: '/banks', label: 'Banks' },
  { to: '/arrange', label: 'Arrange' },
  { to: '/settings', label: 'Settings' },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 border-t border-slate-800 safe-area-pb">
      <div className="max-w-lg mx-auto flex">
        {tabs.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 py-3 text-center ${isActive ? 'text-indigo-400 font-medium' : 'text-slate-400 hover:text-slate-200'}`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
