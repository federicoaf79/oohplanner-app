import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'

// Guards & Layout
import AuthGuard   from './components/guards/AuthGuard'
import RoleGuard   from './components/guards/RoleGuard'
import AppShell    from './components/layout/AppShell'

// Pages — public
import Landing       from './pages/Landing'
import Login         from './pages/auth/Login'
import Register      from './pages/auth/Register'
import NotFound      from './pages/NotFound'

// Pages — protected
import Dashboard  from './pages/app/Dashboard'
import Campaigns  from './pages/app/Campaigns'
import Inventory  from './pages/app/Inventory'
import Proposals  from './pages/app/Proposals'
import Reports    from './pages/app/Reports'
import Team       from './pages/app/Team'
import Settings   from './pages/app/Settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

const router = createBrowserRouter([
  { path: '/',         element: <Landing /> },
  { path: '/login',    element: <Login /> },
  { path: '/register', element: <Register /> },

  // Protected: all /app routes
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/app',              element: <Dashboard /> },
          { path: '/app/campaigns',    element: <Campaigns /> },
          { path: '/app/proposals',    element: <Proposals /> },
          { path: '/app/settings',     element: <Settings /> },

          // manager + owner only
          {
            element: <RoleGuard roles={['owner', 'manager']} />,
            children: [
              { path: '/app/inventory', element: <Inventory /> },
              { path: '/app/reports',   element: <Reports /> },
            ],
          },

          // owner only
          {
            element: <RoleGuard roles={['owner']} />,
            children: [
              { path: '/app/team', element: <Team /> },
            ],
          },
        ],
      },
    ],
  },

  { path: '*', element: <NotFound /> },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
