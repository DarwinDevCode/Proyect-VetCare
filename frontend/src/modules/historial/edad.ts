// RF-010: la edad se calcula a partir de fecha_nacimiento; si no existe, no se muestra.
export function calcularEdadTexto(fechaNacimiento: string | null): string {
  if (!fechaNacimiento) return 'Edad desconocida';

  const nacimiento = new Date(fechaNacimiento);
  const hoy = new Date();

  let anios = hoy.getFullYear() - nacimiento.getFullYear();
  let meses = hoy.getMonth() - nacimiento.getMonth();

  if (hoy.getDate() < nacimiento.getDate()) meses -= 1;
  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }

  if (anios <= 0 && meses <= 0) return 'Recién nacido';
  if (anios === 0) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  if (meses === 0) return `${anios} ${anios === 1 ? 'año' : 'años'}`;
  return `${anios} ${anios === 1 ? 'año' : 'años'} y ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
}
