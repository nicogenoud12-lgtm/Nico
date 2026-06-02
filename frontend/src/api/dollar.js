import { api } from './client.js';

export const listDollarOps = () =>
  api.get('/dollar/ops').then(r => r.data);

export const createDollarOp = (op) =>
  api.post('/dollar/ops', op).then(r => r.data);

export const deleteDollarOp = (id) =>
  api.delete(`/dollar/ops/${id}`).then(r => r.data);

export const getQuotes = () =>
  api.get('/dollar/quotes').then(r => r.data);
