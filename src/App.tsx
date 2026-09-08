import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { StoreProvider } from './state/store.js'
import Home from './pages/Home.js'
import ParticipantView from './pages/ParticipantView.js'
import CoordinatorLogin from './pages/CoordinatorLogin.js'
import CoordinatorDashboard from './pages/CoordinatorDashboard.js'
import PublicLeaderboard from './pages/PublicLeaderboard.js'
import Register from './pages/Register.js'

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
