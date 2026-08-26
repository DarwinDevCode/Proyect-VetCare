// fecha_aplicacion/fecha_solicitud (vacunacion/examen, ver v_historial_clinico)
// son DATE en la base; la vista que las expone las castea a timestamptz con
// medianoche UTC implicita ("2026-08-18T00:00:00+00:00"). Formatear esa marca
// con dayjs sin mas la convierte a la hora local del navegador, y en un huso
// detras de UTC (America) el DIA CALENDARIO retrocede uno -- bug real,
// encontrado y corregido en el timeline de Historial Clinico (CLAUDE.md,
// "Problemas conocidos"). Tomar solo "YYYY-MM-DD" (sin offset) antes de
// parsear evita la conversion: dayjs interpreta eso como medianoche LOCAL.
export function soloFechaLocal(fecha: string): string {
  return fecha.slice(0, 10);
}
