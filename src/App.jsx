import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { FavoritesProvider } from './hooks/useFavorites'
import Navbar from './components/Navbar'
import TripPlanner from './pages/TripPlanner'
import LiveTracker from './pages/LiveTracker'
import Stops from './pages/Stops'
import RoutesPage from './pages/Routes'
import Alerts from './pages/Alerts'
import Login from './pages/Login'
import Register from './pages/Register'
import Account from './pages/Account'
import Favorites from './pages/Favorites'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-88px)]">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FavoritesProvider>
        <div className="min-h-screen">
          <Navbar />
          <main>
            <Routes>
              <Route path="/"          element={<Navigate to="/planner" replace />} />
              <Route path="/planner"   element={<TripPlanner />} />
              <Route path="/tracker"   element={<LiveTracker />} />
              <Route path="/stops"     element={<Stops />} />
              <Route path="/routes"    element={<RoutesPage />} />
              <Route path="/alerts"    element={<Alerts />} />
              <Route path="/login"     element={<Login />} />
              <Route path="/register"  element={<Register />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/account"   element={<ProtectedRoute><Account /></ProtectedRoute>} />
            </Routes>
          </main>
        </div>
        </FavoritesProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
