import { api } from './client';

export const authApi = {
  login: (username, password) => {
    const form = new URLSearchParams();
    form.append('username', username);
    form.append('password', password);
    return api.post('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },

  register: (username, password, invitation_code) =>
    api.post('/auth/register', { username, password, invitation_code }),

  me: () => api.get('/auth/me'),

  listInvitations: () => api.get('/auth/invitations'),

  createInvitation: (note = null, expires_at = null) =>
    api.post('/auth/invitations', { note, expires_at }),

  deleteInvitation: (id) => api.delete(`/auth/invitations/${id}`),
};
