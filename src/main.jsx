// Desregistrar cualquier Service Worker activo de versiones anteriores
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => registration.unregister())
  })
}
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:        1000 * 60 * 5,   // datos frescos por 5 minutos
      gcTime:           1000 * 60 * 10,  // cache en memoria por 10 minutos
      retry:            1,               // reintentar 1 vez si falla
      refetchOnWindowFocus: false,       // no refetchear al volver a la tab
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
