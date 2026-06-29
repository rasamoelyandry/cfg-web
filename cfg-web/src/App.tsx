import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/admin/DashboardPage'
import OrdersPage from './pages/admin/OrdersPage'
import KitchenBoardPage from './pages/kitchen/KitchenBoardPage'
import ProtectedRoute from './components/common/ProtectedRoute'
import AppShell from './components/common/AppShell'

export default function App() {
  const { loadMe, isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) loadMe()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<DashboardPage />} />
            <Route path="/admin/orders" element={<OrdersPage />} />
          </Route>
          <Route path="/kitchen" element={<KitchenBoardPage />} />
        </Route>

        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
