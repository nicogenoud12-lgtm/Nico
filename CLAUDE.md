# Nico — Gastos App

## Deploy (servidor de producción)

**Host:** `familia` (CasaOS, 10.0.0.69)
**Usuario:** `genoud`
**Ruta del repo:** `/home/genoud/Nico`

```bash
ssh genoud@familia
cd /home/genoud/Nico
git fetch origin
git checkout claude/plan-finance-system-4USmT  # rama activa
git pull origin claude/plan-finance-system-4USmT
docker compose up -d --build
```

## Arquitectura

- **Frontend:** Vite + React (`frontend/src/`), sirve en el root
- **Backend:** FastAPI + SQLAlchemy + SQLite (`backend/app/`), API en `apigastos.genoud-nube.com.ar`
- **Bot Telegram:** integrado al backend (`backend/app/routers/telegram.py`, `backend/app/gemini.py`)
- **Reverse proxy:** Cloudflare Tunnel → CasaOS

## Rama activa

- `claude/plan-finance-system-4USmT` — PR #4, refactors + nuevas features (ver abajo)

## Variables de entorno

`VITE_API_BASE_URL` en el frontend apunta a `https://apigastos.genoud-nube.com.ar`.

---

## Estructura del frontend

```
frontend/src/
  App.jsx                     # Root: estado global, loadAll, navegación, pull-to-refresh
  theme.js                    # Colores (C), estilos base (s), CARD_COLORS
  screens/
    ScreenMovimientos.jsx     # Lista completa de transacciones + editar/eliminar por tap
    ScreenGastos.jsx          # Solo gastos + categorías + editar/eliminar por tap
    ScreenIngresos.jsx        # Solo ingresos
    ScreenInversiones.jsx     # Solo inversiones (cat_kind === 'inversion')
    ScreenTarjetas.jsx        # Tarjetas de crédito + movimientos agrupados por cuota
    ScreenRecurrentes.jsx     # Gastos recurrentes (antes: Suscripciones)
    ScreenAnual.jsx           # Panel anual: donut ahorro, detalle por mes con etiquetas
    ScreenAjustes.jsx         # Categorías, medios, backup/restore, bot rules
  components/
    TxRow.jsx                 # Fila de transacción — onClick abre modal (no hay botones visibles)
    TxForm.jsx                # Formulario alta/edición — importe con formato miles, sin autoFocus
    CuotaDetailModal.jsx      # Modal con desglose completo de cuotas al tocar una fila en cuotas
    TarjetaCard.jsx           # Card de tarjeta — logo arriba a la derecha
    TarjetaBankLogo.jsx       # Logo del banco: imagen URL con fallback a iniciales, fondo transparente
    TarjetaForm.jsx           # Formulario tarjeta — campo logo_url
    RecurrenteForm.jsx        # Formulario recurrente (dia_mes, auto_create, logo_url)
    Modal.jsx                 # Wrapper modal genérico
  hooks/
    usePullToRefresh.js       # Swipe-down para recargar en mobile (document-level touch events)
  api/
    transactions.js
    categories.js
    mediums.js
    tarjetas.js
    recurrentes.js            # (antes: suscripciones.js)
    months.js
    backup.js
  utils/
    format.js                 # fmtARS, fmtARSInt (sin decimales), todayStr, etc.
```

## Estructura del backend

```
backend/app/
  main.py          # FastAPI app, init_db, migraciones idempotentes, APScheduler cron
  models.py        # SQLAlchemy ORM: Category, Medium, Month, Tarjeta, Recurrente, Transaction, BotRule
  schemas.py       # Pydantic schemas
  crud.py          # Lógica de negocio, run_recurrentes()
  database.py      # Engine SQLite, SessionLocal, get_db
  config.py        # Settings (CORS, etc.)
  gemini.py        # Parser NLP con Gemini para el bot (cuotas, tarjetas, categorías)
  routers/
    transactions.py
    categories.py
    mediums.py
    tarjetas.py
    recurrentes.py  # (antes: suscripciones.py)
    months.py
    backup.py
    telegram.py
```

---

## Features implementadas

### Navegación y UX
- **Nav state persistido** en `localStorage` — al recargar se vuelve a la pantalla actual
- **Pull-to-refresh** en mobile: swipe-down llama `loadAll()`, spinner SVG mientras carga
- **Tap en fila** abre modal de edición/eliminación — sin botones visibles en la fila
- **Eliminar** está dentro del modal `TxForm` (botón al fondo, solo en edición)
- **Importe con formato** mientras se escribe: separadores de miles con `.`, decimal con `,` (ej: `20.500,50`). Presionar `.` en el teclado inserta `,`.
- **Sin autoFocus** en el campo importe — el teclado no se abre automáticamente al editar

### Transacciones
- **Tipos:** gasto (`g`), ingreso (`i`), inversión (categoría con `kind='inversion'`)
- **Cuotas:** campo `cuota_num` / `cuota_total` — badge `X/Y` en la fila
- **CuotaDetailModal:** tap en una fila con cuotas muestra el desglose completo (todas las cuotas, fechas, montos, cuál está paga/pendiente)
- **Moneda:** ARS o USD por transacción

### Gastos Recurrentes (antes: Suscripciones)
- Tabla en BD: `suscripciones` (nombre de tabla sin cambiar para compatibilidad)
- Modelo Python/API: `Recurrente` / `/recurrentes`
- **auto_create:** si está activo, el cron crea automáticamente la transacción el día `dia_mes` de cada mes
- **Cron:** APScheduler ejecuta `run_recurrentes()` a las 00:05 y al arrancar

### Tarjetas de crédito
- **Logo:** campo `logo_url` en el formulario — muestra imagen URL; fallback a iniciales si falla o no hay URL
- Logo ubicado arriba a la derecha de la card, tamaño 48px, fondo transparente
- `TarjetaBankLogo` maneja error de carga con `onError`

### Panel Anual (`ScreenAnual.jsx`)
- Donut de ahorro YTD
- Detalle por mes con etiquetas: **Ingreso / Gasto / Neto / Ahorro / Variación**
- En mobile: layout de cards 2×2 con métricas etiquetadas (no tabla)

### Categorías
- `kind`: `gasto` | `ingreso` | `inversion`
- Inversiones filtradas de las pantallas de gastos y mostradas en su propia pantalla

### Bot Telegram + Gemini NLP
- Parsea mensajes de texto libre a transacciones
- Soporta cuotas (`en X cuotas`) y tarjetas (`con [tarjeta]`)
- BotRules: mapeo keyword → categoría configurable desde Ajustes

### Backup / Restore
- `GET /backup/export` → JSON con todos los datos
- `POST /backup/import` → reemplaza toda la BD; soporta `recurrentes` y `suscripciones` (retrocompatible)

---

## Migraciones idempotentes (`main.py::_migrate`)

Se ejecutan al arrancar sobre la BD existente:
1. Columnas nuevas en `transactions`: `currency`, `cuota_num`, `cuota_total`, `tarjeta_id`
2. Reconstrucción de `categories` si el UNIQUE constraint es solo sobre `name` (debe ser `name+kind`)
3. Migrar categoría `Inversiones` a `kind='inversion'`
4. Columnas en `suscripciones`: `dia_mes`, `auto_create`, `last_run_month`
5. Columna `logo_url` en `tarjetas`

---

## Medios por defecto (solo para DB nueva)

```python
DEFAULT_MEDIOS = ["Contado", "MP", "MP Crédito", "Naranja X", "Ualá", "Ualá Crédito", "Astropay", "Personal Pay"]
```
"Efectivo" y "Transferencia" fueron removidos.
