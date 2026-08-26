import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { Rol, Usuario } from '../types/dominio';

interface SesionVetCare {
  session: Session;
  usuario: Usuario;
  rol: Rol;
}

interface AuthContextValue {
  cargando: boolean;
  sesion: SesionVetCare | null;
  errorPerfil: string | null;
  iniciarSesion: (correo: string, password: string) => Promise<{ error: string | null }>;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function cargarPerfil(session: Session): Promise<{ usuario: Usuario; rol: Rol } | null> {
  const { data, error } = await supabase
    .from('usuario')
    .select('*, rol:id_rol(*)')
    .eq('id_usuario', session.user.id)
    .single();

  if (error || !data) return null;

  const { rol, ...usuario } = data as Usuario & { rol: Rol };
  return { usuario, rol };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState<SesionVetCare | null>(null);
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null);
  // Ref, no estado: onAuthStateChange se suscribe una sola vez (deps []) y
  // necesita comparar contra el usuario YA cargado en cada evento, sin quedar
  // atado al closure de la primera ejecucion del efecto (mismo patron que
  // PortalAuthContext.tsx -- ver el porque abajo).
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

      const perfil = await cargarPerfil(session);
      if (!activo) return;

      if (!perfil) {
        usuarioActualId.current = null;
        setErrorPerfil(
          'Tu cuenta no tiene un perfil configurado en VetCare. Contacta al Administrador del sistema.',
        );
        setSesion(null);
        setCargando(false);
        return;
      }

      usuarioActualId.current = session.user.id;
      setErrorPerfil(null);
      setSesion({ session, usuario: perfil.usuario, rol: perfil.rol });
      setCargando(false);
    }

    supabase.auth.getSession().then(({ data }) => inicializar(data.session));

    const { data: subscripcion } = supabase.auth.onAuthStateChange((_event, session) => {
      // Se compara el user.id, no el nombre del evento -- GoTrue reemite
      // TOKEN_REFRESHED (y a veces un INITIAL_SESSION redundante) cada vez
      // que la pestaña recupera el foco/visibilidad, no solo en un cambio
      // real de sesion. Con el patron anterior (cargando=true + recargar el
      // perfil en CUALQUIER evento), eso bastaba para expulsar al usuario al
      // login: un vistazo momentaneo a un "sesion=null" mientras se
      // revalidaba (o un fallo transitorio de red justo al recuperar el
      // foco) hacia que RutaProtegida redirigiera a /ingresar. Bug real
      // reportado por el usuario ("al cambiar de pestaña, me devuelve al
      // login") -- mismo patron ya corregido antes en PortalAuthContext.tsx
      // (CLAUDE.md seccion 14) pero nunca aplicado aqui, en el contexto de
      // personal. Si sigue siendo el mismo usuario, solo se refresca el
      // objeto session (token nuevo); no hace falta re-pedir el perfil ni
      // mostrar el loader de pantalla completa.
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
    <AuthContext.Provider value={{ cargando, sesion, errorPerfil, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
