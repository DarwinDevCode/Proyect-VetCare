// Estado de "leida" de las notificaciones de la campana (personal y portal,
// ver layout/notificaciones.ts y portal/notificaciones.ts). Vive en
// localStorage, no en la base: cada notificacion es un calculo en vivo sobre
// datos que ya existen (stock bajo, citas, facturas...), no una fila de una
// tabla propia -- no hay donde guardar un "leido" del lado del servidor sin
// crear una tabla nueva solo para esto (pedido explicito del usuario:
// marcar leida al navegar a su modulo, sin ampliar el esquema).
const PREFIJO = 'vetcare:notificaciones-leidas:';

function leerGuardadas(clave: string): string[] {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? JSON.parse(crudo) : [];
  } catch {
    return [];
  }
}

function guardar(clave: string, ids: string[]): void {
  try {
    localStorage.setItem(clave, JSON.stringify(ids));
  } catch {
    // localStorage puede fallar (modo privado, cuota llena) -- degrada a
    // "todo sin leer" en esa sesion, no bloquea el resto de la campana.
  }
}

// Recorta lo guardado a los ids que siguen vigentes en la lista actual, para
// que localStorage no acumule ids de alertas que ya se resolvieron (ej. un
// producto que volvio a tener stock).
export function leerLeidasVigentes(idUsuario: string, idsVigentes: string[]): Set<string> {
  const clave = PREFIJO + idUsuario;
  const guardadas = leerGuardadas(clave);
  const vigentes = new Set(idsVigentes);
  const recorte = guardadas.filter((id) => vigentes.has(id));
  if (recorte.length !== guardadas.length) guardar(clave, recorte);
  return new Set(recorte);
}

export function marcarLeidaEnStorage(idUsuario: string, id: string): void {
  const clave = PREFIJO + idUsuario;
  const guardadas = leerGuardadas(clave);
  if (guardadas.includes(id)) return;
  guardar(clave, [...guardadas, id]);
}
