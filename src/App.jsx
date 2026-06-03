import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import TripPlanner from './pages/TripPlanner'
import LiveTracker from './pages/LiveTracker'
import Stops from './pages/Stops'
import RoutesPage from './pages/Routes'
import Alerts from './pages/Alerts'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/planner" element={<TripPlanner />} />
            <Route path="/tracker" element={<LiveTracker />} />
            <Route path="/stops" element={<Stops />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/alerts" element={<Alerts />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
