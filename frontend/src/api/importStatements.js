import { api } from './client.js';

// Sube el PDF del resumen y devuelve los movimientos extraídos (sin persistir).
export const extractStatement = (file, tarjetaId) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('tarjeta_id', tarjetaId);
  return api
    .post('/import/extract', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000, // Gemini puede tardar al leer el PDF
    })
    .then(r => r.data);
};

// Aprueba las filas elegidas y crea las transacciones.
export const confirmStatement = (tarjetaId, rows) =>
  api.post('/import/confirm', { tarjeta_id: tarjetaId, rows }).then(r => r.data);
