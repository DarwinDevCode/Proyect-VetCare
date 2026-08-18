import { useEffect, useState } from 'react';
import { MenuItem, Stack, TextField } from '@mui/material';
import type { Especie, Raza } from '../../types/dominio';
import { listarRazasPorEspecie } from './api';

interface Props {
  especies: Especie[];
  idEspecie: number | '';
  idRaza: number | '';
  onChangeEspecie: (id: number | '') => void;
  onChangeRaza: (id: number | '') => void;
  errorEspecie?: string;
}

// RF-006: la especie es obligatoria; la raza es opcional y debe pertenecer a la
// especie declarada (RN-003) -- por eso el combo de razas depende del de especie.
export function EspecieRazaSelect({
  especies,
  idEspecie,
  idRaza,
  onChangeEspecie,
  onChangeRaza,
  errorEspecie,
}: Props) {
  const [razas, setRazas] = useState<Raza[]>([]);
  const [cargandoRazas, setCargandoRazas] = useState(false);

  useEffect(() => {
    if (!idEspecie) {
      setRazas([]);
      return;
    }
    setCargandoRazas(true);
    listarRazasPorEspecie(idEspecie)
      .then(setRazas)
      .finally(() => setCargandoRazas(false));
  }, [idEspecie]);

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <TextField
        select
        label="Especie"
        required
        fullWidth
        value={idEspecie}
        error={!!errorEspecie}
        helperText={errorEspecie}
        onChange={(e) => {
          onChangeEspecie(e.target.value ? Number(e.target.value) : '');
          onChangeRaza('');
        }}
      >
        {especies.map((especie) => (
          <MenuItem key={especie.id_especie} value={especie.id_especie}>
            {especie.nombre}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        label="Raza (opcional)"
        fullWidth
        value={idRaza}
        disabled={!idEspecie || cargandoRazas}
        helperText={!idEspecie ? 'Selecciona primero la especie' : 'Déjalo vacío si es mestizo'}
        onChange={(e) => onChangeRaza(e.target.value ? Number(e.target.value) : '')}
      >
        <MenuItem value="">Sin especificar (mestizo)</MenuItem>
        {razas.map((raza) => (
          <MenuItem key={raza.id_raza} value={raza.id_raza}>
            {raza.nombre}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
