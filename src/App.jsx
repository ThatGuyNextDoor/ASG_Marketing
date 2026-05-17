import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import VALayout from './components/layout/VALayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Calendar from './pages/Calendar'
import Generate from './pages/Generate'
import AllPosts from './pages/AllPosts'
import BrandAssets from './pages/BrandAssets'
import Performance from './pages/Performance'
import VABoard from './pages/VABoard'

function AdminLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

function AppRoutes() {
  const { user, userRole } = useAuth()

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (userRole === 'va') {
    return (
      <Routes>
        <Route path="*" element={
          <VALayout>
            <VABoard />
          </VALayout>
        } />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<AdminLayout><Dashboard /></AdminLayout>} />
      <Route path="/calendar" element={<AdminLayout><Calendar /></AdminLayout>} />
      <Route path="/generate" element={<AdminLayout><Generate /></AdminLayout>} />
      <Route path="/posts" element={<AdminLayout><AllPosts /></AdminLayout>} />
      <Route path="/assets" element={<AdminLayout><BrandAssets /></AdminLayout>} />
      <Route path="/performance" element={<AdminLayout><Performance /></AdminLayout>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  useAuth()

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
