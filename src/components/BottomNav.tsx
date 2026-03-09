import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Home', icon: '$' },
  { to: '/add', label: 'Add', icon: '+' },
  { to: '/banks', label: 'Banks', icon: 'III' },
  { to: '/arrange', label: 'Arrange', icon: '⇅' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 safe-area-pb shadow-[0_-2px_10px_rgba(0,0,0,0.04)] dark:shadow-none">
      <div className="max-w-lg mx-auto flex gap-2 px-2 py-4">
        {tabs.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 py-2.5 rounded-full text-center text-xs font-medium transition-all ${
                isActive
                  ? 'bg-violet-100 text-violet-700 shadow-[0_0_14px_rgba(139,92,246,0.35)] dark:bg-violet-900/50 dark:text-violet-300 dark:shadow-[0_0_14px_rgba(139,92,246,0.4)]'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
              }`
            }
          >
            <div className="flex flex-col items-center gap-0.5 leading-none">
              <span className="text-lg">{icon}</span>
              <span className="text-[11px]">{label}</span>
            </div>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
