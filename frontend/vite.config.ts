import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// vitest/config re-exporta defineConfig de vite con el tipado de "test"
// agregado -- no cambia nada del build de produccion, solo permite que
// TypeScript reconozca el bloque test de abajo.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    // Sin esto, las llamadas de un vi.fn() compartido (vi.hoisted) se
    // acumulan entre pruebas del mismo archivo -- un test podia ver llamadas
    // de otro test anterior.
    clearMocks: true,
  },
})
