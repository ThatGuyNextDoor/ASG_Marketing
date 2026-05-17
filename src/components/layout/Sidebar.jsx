import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '⬛' },
  { path: '/calendar', label: 'Calendar', icon: '📅' },
  { path: '/generate', label: 'Generate', icon: '✨' },
  { path: '/posts', label: 'All Posts', icon: '📋' },
  { path: '/assets', label: 'Brand Assets', icon: '🖼' },
  { path: '/performance', label: 'Performance', icon: '📊' },
]

export default function Sidebar({ onClose }) {
  const { signOut, user } = useAuth()

  return (
    <aside className="flex flex-col h-full bg-navy-dark text-white w-64">
      {/* Logo area */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gold flex items-center justify-center font-serif font-bold text-white text-sm">
            AS
          </div>
          <div>
            <p className="font-serif font-bold text-sm leading-none">All Spot Group</p>
            <p className="text-xs text-teal mt-0.5">Content Engine</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ path, label, icon }) => (
          <NavLink
            key={path}
            to={path}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans transition-all ${
                isActive
                  ? 'bg-navy text-white font-semibold'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`
            }
          >
            <span className="text-base">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-7 h-7 rounded-full bg-teal flex items-center justify-center text-xs font-bold text-white">
            {user?.email?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-white/70 truncate">{user?.email}</p>
            <p className="text-xs text-gold">Admin</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all font-sans"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
