import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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

      const perfil = await cargarPerfil(session);
      if (!activo) return;

      if (!perfil) {
        setErrorPerfil(
          'Tu cuenta no tiene un perfil configurado en VetCare. Contacta al Administrador del sistema.',
        );
        setSesion(null);
        setCargando(false);
        return;
      }

      setErrorPerfil(null);
      setSesion({ session, usuario: perfil.usuario, rol: perfil.rol });
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
