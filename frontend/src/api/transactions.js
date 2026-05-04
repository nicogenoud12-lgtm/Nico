import { api } from './client.js';

export const listTransactions = () =>
  api.get('/transactions').then(r => r.data);

export const createTransaction = (tx) =>
  api.post('/transactions', tx).then(r => r.data);

export const updateTransaction = (id, tx) =>
  api.put(`/transactions/${id}`, tx).then(r => r.data);

export const deleteTransaction = (id) =>
  api.delete(`/transactions/${id}`).then(r => r.data);
