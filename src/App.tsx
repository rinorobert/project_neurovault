import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { StoreProvider } from './state/store'
import Home from './pages/Home'
import ParticipantView from './pages/ParticipantView'
import CoordinatorLogin from './pages/CoordinatorLogin'
import CoordinatorDashboard from './pages/CoordinatorDashboard'
import PublicLeaderboard from './pages/PublicLeaderboard'
import Register from './pages/Register'

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<ParticipantView />} />
          <Route path="/register" element={<Register />} />
          <Route path="/coordinator/login" element={<CoordinatorLogin />} />
          <Route path="/coordinator" element={<CoordinatorDashboard />} />
          <Route path="/leaderboard" element={<PublicLeaderboard />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}
