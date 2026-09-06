// Registro del service worker + auto-actualización.
//
// La app está instalada como PWA en el teléfono. Con el registro por defecto,
// el SW viejo sigue sirviendo el build cacheado hasta que el sistema decide
// buscar una versión nueva: en standalone (icono en la home) casi nunca hay
// navegación fresca, así que la app puede quedar semanas atrasada (ej.: el
// menú sin "Ventas" mientras en la compu ya aparece).
//
// Acá forzamos el chequeo de actualizaciones cada minuto, al volver a la app
// (visibilitychange/focus) y recargamos apenas el SW nuevo toma el control.
const SW_URL = '/sw.js';
const UPDATE_INTERVAL_MS = 60 * 1000;

export function setupPwaAutoUpdate() {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;

  // Si no había SW controlando, el primer `controllerchange` es la instalación
  // inicial (clientsClaim) — no hay nada viejo que refrescar.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SW_URL, { scope: '/' })
      .then((reg) => {
        const check = () => {
          if (document.visibilityState !== 'visible') return;
          if (navigator.onLine === false) return;
          reg.update().catch(() => {});
        };
        setInterval(check, UPDATE_INTERVAL_MS);
        document.addEventListener('visibilitychange', check);
        window.addEventListener('focus', check);
      })
      .catch(() => {});
  });
}
