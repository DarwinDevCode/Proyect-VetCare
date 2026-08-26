import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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

  useEffect(() => {
    let activo = true;

    async function inicializar(session: Session | null) {
      if (!session) {
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
        setErrorPerfil('Esta cuenta no tiene acceso al portal. Contacta a la clínica.');
        setSesion(null);
        setCargando(false);
        return;
      }

      setErrorPerfil(null);
      setSesion({ session, propietario });
      setCargando(false);
    }

    supabase.auth.getSession().then(({ data }) => inicializar(data.session));

    const { data: subscripcion } = supabase.auth.onAuthStateChange((_event, session) => {
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
