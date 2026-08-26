import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { Propietario } from '../types/dominio';

interface SesionPortal {
  session: Session;
  propietario: Propietario;
}

interface PortalAuthContextValue {
  cargando: boolean;
  sesion: SesionPortal | null;
  errorPerfil: string | null;
  iniciarSesion: (correo: string, password: string) => Promise<{ error: string | null }>;
  cerrarSesion: () => Promise<void>;
}

const PortalAuthContext = createContext<PortalAuthContextValue | undefined>(undefined);

async function cargarPropietario(session: Session): Promise<Propietario | null> {
  const { data, error } = await supabase
    .from('propietario')
    .select('*')
    .eq('id_usuario_portal', session.user.id)
    .single();
  if (error || !data) return null;
  return data;
}

// Hallazgo de arquitectura del plan (REDISENO-ORGANIC-PLAN.md): el portal es una
// identidad completamente aparte de la de personal, pero comparte el MISMO cliente
// de Supabase (mismo auth.users, mismo storage de sesion) -- separar el contexto de
// React alcanza para que las paginas de /portal/* nunca lean AuthContext/usuario/rol
// de personal, sin que haga falta un segundo cliente ni tocar ese modelo. El
// AuthProvider de personal (App.tsx) sigue montado en paralelo: si una cuenta de
// portal navegara por error a una ruta de staff, cargarPerfil() ahi no encuentra
// fila en usuario y ese flujo ya falla con su propio error, sin afectar a este.
export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState<SesionPortal | null>(null);
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null);
  // Ref, no estado: onAuthStateChange se suscribe una sola vez (deps []) y
  // necesita comparar contra el usuario YA cargado en cada evento, sin quedar
  // atado al closure de la primera ejecucion del efecto.
  const usuarioActualId = useRef<string | null>(null);

  useEffect(() => {
    let activo = true;

    async function inicializar(session: Session | null) {
      if (!session) {
        usuarioActualId.current = null;
        if (activo) {
          setSesion(null);
          setCargando(false);
        }
        return;
      }

      const propietario = await cargarPropietario(session);
      if (!activo) return;

      if (!propietario) {
        // No es necesariamente un error del portal: tambien ocurre si en este
        // mismo navegador hay una sesion de personal activa (mismo storage de
        // auth) -- se trata igual, como "sin acceso de portal para esta cuenta".
        usuarioActualId.current = null;
        setErrorPerfil('Esta cuenta no tiene acceso al portal. Contacta a la clínica.');
        setSesion(null);
        setCargando(false);
        return;
      }

      usuarioActualId.current = session.user.id;
      setErrorPerfil(null);
      setSesion({ session, propietario });
      setCargando(false);
    }

    supabase.auth.getSession().then(({ data }) => inicializar(data.session));

    const { data: subscripcion } = supabase.auth.onAuthStateChange((_event, session) => {
      // Se compara el user.id, no el nombre del evento: GoTrue no solo emite
      // TOKEN_REFRESHED/USER_UPDATED para el mismo usuario ya logueado, tambien
      // reemite un INITIAL_SESSION extra despues de una mutacion como
      // updateUser() (confirmado instrumentando el callback) -- listar eventos
      // por nombre es fragil, comparar el usuario es exacto. Si sigue siendo el
      // mismo usuario, solo se refresca el objeto session (token nuevo); no hace
      // falta re-pedir el perfil ni mostrar el loader de pantalla completa, que
      // desmontaria cualquier dialogo abierto. Bug real encontrado probando
      // "Cambiar contraseña": la contraseña si cambiaba (confirmado por API),
      // pero el mensaje de exito nunca llegaba a verse porque el dialogo se
      // cerraba solo.
      if (session && session.user.id === usuarioActualId.current) {
        setSesion((actual) => (actual ? { ...actual, session } : actual));
        return;
      }
      setCargando(true);
      inicializar(session);
    });

    return () => {
      activo = false;
      subscripcion.subscription.unsubscribe();
    };
  }, []);

  async function iniciarSesion(correo: string, password: string) {
    setErrorPerfil(null);
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password });
    if (error) {
      return { error: 'Correo o contraseña incorrectos.' };
    }
    return { error: null };
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    setSesion(null);
  }

  return (
    <PortalAuthContext.Provider value={{ cargando, sesion, errorPerfil, iniciarSesion, cerrarSesion }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error('usePortalAuth debe usarse dentro de PortalAuthProvider');
  return ctx;
}
