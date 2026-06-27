# Alexa Skill — "Gastos"

Hablale a tu Alexa y que anote gastos/ingresos con Gemini, igual que el bot de
Telegram. La skill captura lo que decís como texto libre y lo manda al backend
(`POST /alexa/webhook`), que reusa `bot_core.handle_conversation` para entender y
persistir la transacción en nombre del owner (`TELEGRAM_BOT_OWNER_ID`).

**Uso:**

- "Alexa, abrí gastos" → (Alexa: "Dale, decime el gasto o ingreso.") →
  "anota gasté diez mil pesos en una hamburguesa" → "Listo, anoté $10.000 en Comida".
- En un tiro: "Alexa, dile a gastos que registra diez mil en hamburguesa".

Si falta info (no entiende la categoría o el monto), Alexa repregunta manteniendo
la conversación abierta; el historial viaja en `session.attributes` (no toca la DB).

## Por qué responde rápido

Alexa exige respuesta en ~8 segundos. El endpoint llama a Gemini en modo `fast`
(`thinkingBudget=0`, `timeout=7s`); `gemini-2.5-flash` sin thinking responde en
1-4s. (El bot de Telegram sigue usando thinking + timeout 45s.)

## Setup en la Alexa Developer Console (manual)

Estos pasos van en https://developer.amazon.com/alexa/console/ask (no son código):

1. **Create Skill** → tipo **Custom**, hosting **Provision your own**.
2. **Idioma**: agregá el/los locale(s) de tu Echo. En Argentina suele ser
   **Español (US)** (`es-US`); podés agregar también **Español (MX)** (`es-MX`).
   El mismo modelo sirve para ambos.
3. **Interaction Model** → **JSON Editor**: pegá el contenido de
   [`backend/alexa/interaction_model.json`](../backend/alexa/interaction_model.json)
   (repetilo en cada locale que hayas agregado) → **Save** → **Build Model**.
   - Invocation name: `gastos`.
   - Intent `RegistrarGastoIntent` con slot `frase` (`AMAZON.SearchQuery`). Ojo:
     `AMAZON.SearchQuery` no admite que el slot sea la frase entera sola, por eso
     todos los samples tienen una palabra-gancho ("anota", "registra", "que"…).
4. **Endpoint** → **HTTPS**:
   - Default Region: `https://apigastos.genoud-nube.com.ar/alexa/webhook`
   - Certificado: **"My development endpoint is a sub-domain of a domain that has
     a wildcard certificate from a certificate authority"** (válido vía Cloudflare).
5. **Skill ID**: copialo (arriba de todo, "View Skill ID") y ponelo en
   `backend/.env`:
   ```
   ALEXA_SKILL_ID=amzn1.ask.skill.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```
   Reiniciá el backend (`docker compose up -d --build`) para tomar la variable.
6. **Probar**: pestaña **Test** (poné el toggle en *Development*) → escribí o hablá
   "abrí gastos" y después "gasté diez mil en hamburguesa". Después probalo en el
   Echo real (tiene que estar en la misma cuenta de Amazon).

## Seguridad

El endpoint es público, así que valida cada request:

- **Firma de Amazon**: headers `SignatureCertChainUrl` + `Signature` → valida la
  URL del cert (`https://s3.amazonaws.com/echo.api/...`), descarga/cachea el cert,
  chequea vigencia + SAN `echo-api.amazon.com` y verifica la firma RSA/SHA1 sobre
  el body crudo.
- **Timestamp** del request dentro de ±150s (anti-replay).
- **applicationId** == `ALEXA_SKILL_ID` (si está configurado).

Un POST sin firma válida o con applicationId incorrecto se rechaza (400/401).
Por eso el endpoint **no** se puede probar con `curl` a mano: usá el simulador de
la consola de Alexa, que manda requests firmados de verdad.
