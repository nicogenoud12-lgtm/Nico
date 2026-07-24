import { api } from './client.js';

export const listVentas = () =>
  api.get('/ventas').then(r => r.data);

export const createVenta = (v) =>
  api.post('/ventas', v).then(r => r.data);

export const updateVenta = (id, v) =>
  api.put(`/ventas/${id}`, v).then(r => r.data);

export const deleteVenta = (id) =>
  api.delete(`/ventas/${id}`).then(r => r.data);

export const createVentaPago = (ventaId, pago) =>
  api.post(`/ventas/${ventaId}/pagos`, pago).then(r => r.data);

export const deleteVentaPago = (ventaId, pagoId) =>
  api.delete(`/ventas/${ventaId}/pagos/${pagoId}`).then(r => r.data);
