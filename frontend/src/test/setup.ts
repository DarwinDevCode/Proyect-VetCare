import '@testing-library/jest-dom/vitest';

// jsdom no implementa window.matchMedia -- MUI lo usa en useMediaQuery
// (patron "esMovil" del portal, ver PortalLayout.tsx y las *PortalPage.tsx)
// y en algunos componentes internamente. Sin este mock, cualquier prueba que
// monte un componente que lo use falla con "matchMedia is not a function".
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
