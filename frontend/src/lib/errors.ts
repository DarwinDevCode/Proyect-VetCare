import type { PostgrestError } from '@supabase/supabase-js';

/**
 * RNF-014: los errores se muestran en lenguaje comprensible, sin códigos ni mensajes
 * propios del gestor de datos. Los mensajes de las excepciones que lanzamos nosotros
 * mismos en triggers (ver supabase/migrations/..._business_rules.sql) ya están en
 * español y se muestran tal cual; el resto se traduce a partir del código PostgreSQL.
 */
export function mensajeError(error: unknown): string {
  const pgError = error as PostgrestError | null;

  if (!pgError) return 'Ocurrió un error inesperado. Intenta nuevamente.';

  switch (pgError.code) {
    case '23505':
      return 'Ya existe un registro con ese mismo dato único (por ejemplo, identificación, código o número).';
    case '23503':
      return 'La operación hace referencia a un registro que no existe o ya no está disponible.';
    case '23514':
    case 'check_violation':
      return pgError.message?.includes('No hay existencia') || pgError.message?.includes('clasificado como vacuna')
        ? pgError.message
        : 'Los datos ingresados no cumplen una regla del sistema. Revisa los valores e intenta de nuevo.';
    case '42501':
      return 'Tu rol no tiene permiso para realizar esta acción.';
    case '23P01':
      return 'El veterinario seleccionado ya tiene una cita en ese horario.';
    // P0001 es el codigo de un `raise exception` sin SQLSTATE propio: en este
    // proyecto solo lo lanzan nuestras funciones (fn_emitir_factura), y su texto ya
    // esta redactado en espanol para el usuario, asi que se muestra tal cual.
    case 'P0001':
      return pgError.message ?? 'No se pudo completar la operación.';
    default:
      if (pgError.message?.startsWith('No hay existencia') || pgError.message?.includes('clasificado como vacuna')) {
        return pgError.message;
      }
      return 'No se pudo completar la operación. Verifica los datos e intenta nuevamente.';
  }
}
