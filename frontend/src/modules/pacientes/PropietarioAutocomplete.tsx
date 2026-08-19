import { useEffect, useState } from 'react';
import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import type { Propietario } from '../../types/dominio';
import { buscarPropietarios } from './api';

interface Props {
  value: Propietario | null;
  onChange: (propietario: Propietario | null) => void;
  error?: string;
  // Configurable porque este componente tambien se usa desde Facturacion, donde no
  // hay ningun formulario de alta de propietario debajo al que remitir al usuario.
  textoSinOpciones?: string;
}

export function PropietarioAutocomplete({
  value,
  onChange,
  error,
  textoSinOpciones = 'Sin coincidencias. Puedes registrar un propietario nuevo abajo.',
}: Props) {
  const [opciones, setOpciones] = useState<Propietario[]>([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    const temporizador = setTimeout(() => {
      buscarPropietarios(texto)
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
      getOptionLabel={(propietario) =>
        `${propietario.nombres} ${propietario.apellidos} — ${propietario.identificacion}`
      }
      isOptionEqualToValue={(o, v) => o.id_propietario === v.id_propietario}
      noOptionsText={textoSinOpciones}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Buscar propietario por cédula o nombre"
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
