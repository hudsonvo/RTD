import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import TripPlanner from './pages/TripPlanner'
import LiveTracker from './pages/LiveTracker'
import Stops from './pages/Stops'
import RoutesPage from './pages/Routes'
import Alerts from './pages/Alerts'
import Login from './pages/Login'
import Register from './pages/Register'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen">
          <Navbar />
          <main>
            <Routes>
              <Route path="/"          element={<Dashboard />} />
              <Route path="/planner"   element={<TripPlanner />} />
              <Route path="/tracker"   element={<LiveTracker />} />
              <Route path="/stops"     element={<Stops />} />
              <Route path="/routes"    element={<RoutesPage />} />
              <Route path="/alerts"    element={<Alerts />} />
              <Route path="/login"     element={<Login />} />
              <Route path="/register"  element={<Register />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
