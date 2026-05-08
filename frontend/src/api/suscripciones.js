import { api } from './client.js';

export const listSuscripciones = () =>
  api.get('/suscripciones').then(r => r.data);

export const createSuscripcion = (s) =>
  api.post('/suscripciones', s).then(r => r.data);

export const updateSuscripcion = (id, s) =>
  api.put(`/suscripciones/${id}`, s).then(r => r.data);

export const deleteSuscripcion = (id) =>
  api.delete(`/suscripciones/${id}`).then(r => r.data);

export const reorderSuscripciones = (orderedIds) =>
  api.post('/suscripciones/reorder', { ids: orderedIds }).then(r => r.data);
