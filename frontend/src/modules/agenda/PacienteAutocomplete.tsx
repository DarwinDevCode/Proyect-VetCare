import { useEffect, useState } from 'react';
import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import type { PacienteParaCita } from '../../types/dominio';
import { buscarPacientesActivos } from './api';

interface Props {
  value: PacienteParaCita | null;
  onChange: (paciente: PacienteParaCita | null) => void;
  error?: string;
}

// RF-012: elegir un paciente ya registrado en el Modulo 1 para agendarle una cita.
export function PacienteAutocomplete({ value, onChange, error }: Props) {
  const [opciones, setOpciones] = useState<PacienteParaCita[]>([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    const temporizador = setTimeout(() => {
      buscarPacientesActivos(texto)
        .then((resultado) => {
          if (vigente) setOpciones(resultado);
        })
        .finally(() => vigente && setCargando(false));
    }, 250);

    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [texto]);

  return (
    <Autocomplete
      options={opciones}
      loading={cargando}
      value={value}
      onChange={(_, nuevo) => onChange(nuevo)}
      onInputChange={(_, nuevoTexto) => setTexto(nuevoTexto)}
      getOptionLabel={(paciente) =>
        `${paciente.nombre} — ${paciente.propietario.nombres} ${paciente.propietario.apellidos}`
      }
      isOptionEqualToValue={(o, v) => o.id_paciente === v.id_paciente}
      noOptionsText="Sin coincidencias. Busca por nombre de la mascota o del propietario."
      renderInput={(params) => (
        <TextField
          {...params}
          label="Paciente"
          placeholder="Buscar por nombre de la mascota o del propietario"
          error={!!error}
          helperText={error}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              endAdornment: (
                <>
                  {cargando ? <CircularProgress size={18} /> : null}
                  {params.slotProps.input.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}
