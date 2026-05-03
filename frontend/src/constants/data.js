export const CAT_COLORS = {
  'Comida': '#e8b86d',
  'Compras': '#7eb8d4',
  'Combustible': '#d4876b',
  'Ocio': '#a78bda',
  'Salud': '#6bbf8e',
  'Suscripciones': '#e88ba0',
  'Ropa': '#f0c060',
  'Viajes': '#60b4b4',
  'Inversiones': '#5a9cd4',
  'Inversión': '#5a9cd4',
  'Gimnasio': '#88c070',
  'Regalo': '#d490c0',
  'Donación': '#a0c890',
  'Art. Higiene': '#80c8c0',
  'Impuestos': '#c8a080',
  'Suplementos': '#98d0a0',
  'Peluquería': '#d0a8d0',
  'Otros': '#b0aaaa',
  'Ingresos': '#2d7a52',
  'Fábrica': '#2d7a52'
};

export const MEDIOS = ['Efectivo', 'Naranja X', 'MP Crédito', 'Ualá Crédito', 'Astropay', 'Personal Pay'];

export const CATS_GASTO = Object.keys(CAT_COLORS).filter(c => c !== 'Ingresos' && c !== 'Fábrica');

export const NAV_ITEMS = [
  { id: 'dashboard', icon: '⌂', label: 'Inicio' },
  { id: 'movimientos', icon: '↕', label: 'Movimientos' },
  { id: 'categorias', icon: '◎', label: 'Categorías' },
  { id: 'anual', icon: '▦', label: 'Anual' },
  { id: 'ajustes', icon: '⚙', label: 'Ajustes' }
];

export const COLOR_PALETTE = [
  '#e8b86d','#7eb8d4','#d4876b','#a78bda','#6bbf8e','#e88ba0',
  '#f0c060','#60b4b4','#88c070','#d490c0','#b0aaaa','#5a9cd4',
  '#98d0a0','#d0a8d0','#c8a080','#ff6b6b','#ffd93d','#6bcb77',
  '#4d96ff','#845ec2','#ff9671','#00c9a7','#f9c74f','#43aa8b',
  '#e76f51','#2ec4b6','#cbf3f0','#ffbf69','#9b5de5','#f15bb5'
];

export const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
