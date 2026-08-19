import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import type { EventoHistorial } from '../../types/dominio';
import type { ConsumoDeConsulta } from './api';
import { COLOR_TIPO_EVENTO, ETIQUETA_TIPO_EVENTO, interpretarEvento } from './eventoHistorial';

interface Props {
  evento: EventoHistorial;
  // Consumos ya registrados contra esta consulta (RF-023); vacio para los demas
  // tipos de evento.
  consumos: ConsumoDeConsulta[];
  onAbrirVacunacion: (idConsulta: number) => void;
  onAbrirExamen: (idConsulta: number) => void;
  onAbrirConsumo: (idConsulta: number) => void;
  onAbrirCompletarExamen: (idExamen: number, fechaSolicitud: string) => void;
}

// RF-020: una entrada del timeline, con su forma segun tipo_evento. RF-018/RF-019
// "dentro de una consulta": las entradas de consulta ofrecen acciones contextuales
// que abren los mismos dialogos de vacunacion/examen con idConsulta prefijado.
export function EventoHistorialItem({
  evento,
  consumos,
  onAbrirVacunacion,
  onAbrirExamen,
  onAbrirConsumo,
  onAbrirCompletarExamen,
}: Props) {
  const interpretado = interpretarEvento(evento);

  // fecha_aplicacion/fecha_solicitud son DATE en la base; la vista las castea a
  // timestamptz con medianoche UTC implicita ("2026-08-18T00:00:00+00:00"). Si se
  // formatea esa marca con dayjs en un huso horario detras de UTC (America),
  // convierte a hora local y el DIA CALENDARIO retrocede uno (medianoche UTC del 18
  // se ve como las 19:00 del 17 en UTC-5) -- un bug real, no solo un detalle
  // cosmetico. La correccion: tomar los primeros 10 caracteres (solo "YYYY-MM-DD",
  // sin offset) y parsear eso, que dayjs interpreta como medianoche LOCAL, sin
  // ninguna conversion de huso horario. Para consulta, en cambio, fecha_hora trae
  // una hora real y si se debe mostrar tal cual, convertida a hora local.
  const soloFecha = (fecha: string) => fecha.slice(0, 10);
  const fechaTexto =
    evento.tipo_evento === 'consulta'
      ? dayjs(evento.fecha).format('DD/MM/YYYY HH:mm')
      : dayjs(soloFecha(evento.fecha)).format('DD/MM/YYYY');

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Chip label={ETIQUETA_TIPO_EVENTO[evento.tipo_evento]} size="small" color={COLOR_TIPO_EVENTO[evento.tipo_evento]} />
          <Typography variant="body2" color="text.secondary">
            {fechaTexto}
          </Typography>
        </Stack>

        {interpretado.tipo === 'consulta' && (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {interpretado.motivo}
            </Typography>
            <Typography variant="body2">Diagnóstico: {interpretado.diagnostico}</Typography>
            {interpretado.tratamiento && (
              <Typography variant="body2" color="text.secondary">
                Tratamiento: {interpretado.tratamiento}
              </Typography>
            )}
            {consumos.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Productos utilizados
                </Typography>
                {consumos.map((consumo) => (
                  <Typography key={consumo.id_movimiento} variant="body2" color="text.secondary">
                    {/* cantidad se guarda negativa (chk_movimiento_signo); se muestra
                        en positivo, que es como el veterinario la registro. */}
                    {Math.abs(consumo.cantidad)} {consumo.producto.unidad_medida} de {consumo.producto.nombre}
                    {consumo.observacion ? ` — ${consumo.observacion}` : ''}
                  </Typography>
                ))}
              </Box>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
              <Button size="small" onClick={() => onAbrirVacunacion(evento.id_evento)}>
                Aplicar vacuna a esta consulta
              </Button>
              <Button size="small" onClick={() => onAbrirExamen(evento.id_evento)}>
                Solicitar examen para esta consulta
              </Button>
              <Button size="small" onClick={() => onAbrirConsumo(evento.id_evento)}>
                Registrar consumo de producto
              </Button>
            </Stack>
          </Box>
        )}

        {interpretado.tipo === 'vacunacion' && (
          <Typography variant="body2">Vacuna aplicada: {interpretado.producto}</Typography>
        )}

        {interpretado.tipo === 'examen' && (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {interpretado.tipoExamen}
            </Typography>
            {interpretado.completado ? (
              <>
                <Typography variant="body2">Resultado: {interpretado.resultado}</Typography>
                {interpretado.observacion && (
                  <Typography variant="body2" color="text.secondary">
                    {interpretado.observacion}
                  </Typography>
                )}
              </>
            ) : (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Sin resultado todavía.
                </Typography>
                <Button size="small" onClick={() => onAbrirCompletarExamen(evento.id_evento, soloFecha(evento.fecha))}>
                  Completar resultado
                </Button>
              </Stack>
            )}
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
