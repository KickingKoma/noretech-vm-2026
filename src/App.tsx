import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { MatchesPage } from './pages/MatchesPage'
import { KnockoutPage } from './pages/KnockoutPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { AdminPage } from './pages/AdminPage'
import { PlayerPage } from './pages/PlayerPage'
import { AccountPage } from './pages/AccountPage'
import { StartsidaPage } from './pages/StartsidaPage'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<StartsidaPage />} />
            <Route path="matches" element={<MatchesPage />} />
            <Route path="knockout" element={<KnockoutPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="player/:userId" element={<PlayerPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="admin" element={<AdminPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
