import { Outlet, NavLink, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Layout() {
  const { user, signOut, isAdmin } = useAuth()

  const activeNav = 'text-cyan-400 font-semibold text-sm'
  const inactiveNav = 'text-gray-400 hover:text-white transition-colors text-sm'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="bg-gray-900 border-b border-gray-800 border-t-2 border-t-cyan-500 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Link to="/" className="font-black text-white tracking-tight text-lg hover:text-cyan-400 transition-colors">⚽ VM 2026</Link>
            <div className="flex items-center gap-3">
              <Link to="/account" className="text-gray-500 text-sm hidden sm:block hover:text-gray-300 transition-colors">{user?.email}</Link>
              <button onClick={() => signOut()}
                className="text-sm text-gray-400 hover:text-white transition-colors">
                Logga ut
              </button>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <NavLink to="/" end className={({ isActive }) => isActive ? activeNav : inactiveNav}>Start</NavLink>
            <NavLink to="/matches" className={({ isActive }) => isActive ? activeNav : inactiveNav}>Gruppspel</NavLink>
            <NavLink to="/knockout" className={({ isActive }) => isActive ? activeNav : inactiveNav}>Slutspel</NavLink>
            <NavLink to="/leaderboard" className={({ isActive }) => isActive ? activeNav : inactiveNav}>Topplista</NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={({ isActive }) => isActive ? activeNav : inactiveNav}>Admin</NavLink>
            )}
          </div>
        </div>
      </nav>

      {/* Hero-banner */}
      <div className="relative w-full h-56 overflow-hidden mb-[-3rem]">
        <img
          src={`${import.meta.env.BASE_URL}Glad-midsommar.jpg`}
          alt="Glad midsommar!"
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center 15%' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent from-40% to-gray-950" />
      </div>

      <main className="relative max-w-4xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
