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

// Pages — protected app
import Dashboard    from './pages/app/Dashboard'
import Campaigns    from './pages/app/Campaigns'
import Inventory    from './pages/app/Inventory'
import Proposals    from './pages/app/Proposals'
import ProposalNew  from './pages/app/ProposalNew'
import Reports      from './pages/app/Reports'
import Team         from './pages/app/Team'
import Settings     from './pages/app/Settings'

// Pages — admin panel
import AdminLayout          from './pages/admin/AdminLayout'
import AdminDashboard       from './pages/admin/AdminDashboard'
import AdminEmpresas        from './pages/admin/AdminEmpresas'
import AdminEmpresaDetalle  from './pages/admin/AdminEmpresaDetalle'
import AdminNuevoCliente    from './pages/admin/AdminNuevoCliente'
import AdminPlanes          from './pages/admin/AdminPlanes'
import AdminAdmins          from './pages/admin/AdminAdmins'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

const router = createBrowserRouter([
  { path: '/',         element: <Landing /> },
  { path: '/login',    element: <Login /> },
  { path: '/register', element: <Register /> },

  // Protected: all authenticated routes
  {
    element: <AuthGuard />,
    children: [
      // ── App routes ──
      {
        element: <AppShell />,
        children: [
          { path: '/app',                      element: <Dashboard /> },
          { path: '/app/campaigns',            element: <Campaigns /> },
          { path: '/app/proposals',            element: <Proposals /> },
          { path: '/app/proposals/new',        element: <ProposalNew /> },
          { path: '/app/proposals/:id/edit',   element: <ProposalNew /> },
          { path: '/app/settings',             element: <Settings /> },

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

      // ── Admin routes (access checked inside AdminLayout) ──
      {
        element: <AdminLayout />,
        children: [
          { path: '/admin',                  element: <AdminDashboard /> },
          { path: '/admin/empresas',         element: <AdminEmpresas /> },
          { path: '/admin/empresas/nueva',   element: <AdminNuevoCliente /> },
          { path: '/admin/empresas/:id',     element: <AdminEmpresaDetalle /> },
          { path: '/admin/planes',           element: <AdminPlanes /> },
          { path: '/admin/admins',           element: <AdminAdmins /> },
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
