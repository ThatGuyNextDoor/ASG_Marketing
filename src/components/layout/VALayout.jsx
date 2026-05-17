import { useAuth } from '../../hooks/useAuth'

export default function VALayout({ children }) {
  const { signOut, user } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-navy-dark text-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold flex items-center justify-center font-serif font-bold text-white text-sm">
              AS
            </div>
            <div>
              <p className="font-serif font-bold text-sm leading-none">All Spot Group</p>
              <p className="text-xs text-teal mt-0.5">Content Board</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/60 hidden sm:block">{user?.email}</span>
            <button
              onClick={signOut}
              className="text-xs text-white/70 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
