import { api } from './client.js';

export const listTarjetas = () =>
  api.get('/tarjetas').then(r => r.data);

export const createTarjeta = (t) =>
  api.post('/tarjetas', t).then(r => r.data);

export const updateTarjeta = (id, t) =>
  api.put(`/tarjetas/${id}`, t).then(r => r.data);

export const deleteTarjeta = (id) =>
  api.delete(`/tarjetas/${id}`).then(r => r.data);

export const reorderTarjetas = (orderedIds) =>
  api.post('/tarjetas/reorder', { ids: orderedIds }).then(r => r.data);
