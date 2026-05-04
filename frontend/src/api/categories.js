import { api } from './client.js';

export const listCategories = () =>
  api.get('/categories').then(r => r.data);

export const createCategory = (cat) =>
  api.post('/categories', cat).then(r => r.data);

export const updateCategory = (id, cat) =>
  api.put(`/categories/${id}`, cat).then(r => r.data);

export const deleteCategory = (id) =>
  api.delete(`/categories/${id}`).then(r => r.data);

export const reorderCategories = (orderedIds) =>
  api.post('/categories/reorder', { ids: orderedIds }).then(r => r.data);

export const listMediums = () =>
  api.get('/mediums').then(r => r.data);

export const createMedium = (m) =>
  api.post('/mediums', m).then(r => r.data);

export const updateMedium = (id, m) =>
  api.put(`/mediums/${id}`, m).then(r => r.data);

export const deleteMedium = (id) =>
  api.delete(`/mediums/${id}`).then(r => r.data);

export const reorderMediums = (orderedIds) =>
  api.post('/mediums/reorder', { ids: orderedIds }).then(r => r.data);

export const listMonths = () =>
  api.get('/months').then(r => r.data);
