import { api } from './client.js';

export const listRecurrentes = () =>
  api.get('/recurrentes').then(r => r.data);

export const createRecurrente = (r) =>
  api.post('/recurrentes', r).then(res => res.data);

export const updateRecurrente = (id, r) =>
  api.put(`/recurrentes/${id}`, r).then(res => res.data);

export const deleteRecurrente = (id) =>
  api.delete(`/recurrentes/${id}`).then(res => res.data);

export const reorderRecurrentes = (orderedIds) =>
  api.post('/recurrentes/reorder', { ids: orderedIds }).then(res => res.data);
