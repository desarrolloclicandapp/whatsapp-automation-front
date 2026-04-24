# Standalone App Status

## Resumen ejecutivo

Hoy existe un circuito real de punta a punta para:

- entrar por `/crm` o `/standalone`
- autenticarse con el flujo standalone
- persistir `users.interface = 'standalone'`
- aprovisionar una cuenta monocuenta real con Waflow WhatsApp hosted
- cargar overview, settings, agents y accesos desde endpoints reales

El flujo agency/default sigue separado:

- `/` y `/agency` -> frontend actual
- `/crm` y `/standalone` -> frontend standalone

## Estado actual por capa

### Update final aplicado (Go/Flow/Elite + CRM)

Listo:

- `StandaloneSubscription.jsx` ya no usa catalogo agency/addons
- standalone usa solo:
  - Go (`price_1TOii0HSoN0LpQiBieTZRrUU` / `price_1TOii0HSoN0LpQiBz9r0nqBz`)
  - Flow (`price_1TOimyHSoN0LpQiB6u9YT6lk` / `price_1TOimyHSoN0LpQiB0pupYGHU`)
  - Elite (`price_1TOithHSoN0LpQiBwp9tadRl` / `price_1TOithHSoN0LpQiBENAvlxHF`)
- `StandaloneLayout.jsx` ahora:
  - abre `WaFloW CRM` directo si existe acceso real
  - si no hay acceso, dispara solicitud real con `/agency/ghl/subaccount-request`
- backend ya reconoce esos `price_id` en:
  - `billingService.js` (`STRIPE_CONFIG`)
  - `featuresService.js` (price map)
- locales actualizados para standalone de suscripcion y solicitud CRM

### Backend y base de datos

Listo:

- columna `users.interface` creada y backfill aplicado en `init.js`
- auth devuelve `interface`
- onboarding standalone llama a aprovisionamiento real
- `GET /agency/info` ya expone:
  - `interface`
  - `primary_location_id`
  - `crm_type` efectivo

Nuevo servicio clave:

- `whatsapp-automation/src/services/standaloneProvisioningService.js`

Responsabilidad:

- crear location unica
- aprovisionar cuenta hosted de Waflow WhatsApp
- crear acceso inicial
- crear slot inicial
- dejar acceso del mismo usuario final configurado

### Frontend standalone

Listo:

- `StandaloneLayout.jsx` ya usa `useStandaloneWorkspace.js`
- `StandaloneDashboard.jsx` ya usa datos reales
- `StandaloneSlotManager.jsx` ya usa endpoints reales y ahora monta el flujo QR original dentro del standalone
- `StandaloneSlotManager.jsx` ya expone tambien la configuracion de `SMS / Twilio`
- `StandaloneSettings.jsx` ya renderiza:
  - `General` global de cuenta: alerta, tag y keywords globales
  - `Integraciones` globales: Usuario Maestro + OpenAI + ElevenLabs + Proxy
- `StandaloneSettings.jsx` no expone una pestaña intermedia de Waflow WhatsApp
- `StandaloneAgents.jsx` ya trabaja con `locationId` real
- `StandaloneLogin.jsx` ya entrega `interface` standalone al cerrar el flujo
- `App.jsx` ya revalida la interfaz operativa con `/agency/info`
- layout/dashboard/slots/login ya no muestran copy de prueba ni claves `standalone.*` en pantalla
- `StandaloneLayout.jsx` sincroniza tabs con query params para convivir mejor con Stripe
- `StandaloneLayout.jsx` abre Waflow WhatsApp directamente desde el shortcut lateral
- `StandaloneLayout.jsx` intenta apertura con contexto de número (seed-welcome por slot cuando aplica)
- `StandaloneDashboard.jsx` ya reacciona en caliente al conectar un numero y deja visible solo la card de abrir WhatsApp cuando ya esta conectado

Se mantiene cercano al original:

- `StandaloneSubscription.jsx`
- `StandaloneMessageBuilder.jsx`

## Que ya esta operando con datos reales

### Login / onboarding

- OTP email
- OTP phone
- `source: 'standalone_crm'`
- persistencia de `interface`
- aprovisionamiento monocuenta al completar perfil

### Workspace loader

- `/agency/info`
- `/agency/locations`
- `/agency/location-details/:locationId`
- `/agency/chatwoot/access-info`

### Gestion de WhatsApp

- add slot
- QR start
- QR/status
- reconnect
- soft-disconnect
- disconnect
- delete slot
- official API config
- official API validate
- QR share link
- el bloque QR/reconexion ahora replica el comportamiento operativo del componente original
- `SMS / Twilio` ya esta disponible tambien en el standalone

### Settings

- Usuario Maestro de Waflow WhatsApp
- OpenAI
- ElevenLabs por WhatsApp
- Proxy personalizado por WhatsApp
- alertas/tags/keywords por WhatsApp
- API keys
- webhooks

### Billing

- checkout y portal de Stripe ya distinguen `users.interface`
- standalone vuelve a `/crm?tab=billing`
- agency mantiene su retorno historico

## Riesgos y recomendaciones

### 1. Aprovisionamiento real en VPS

Lo primero a validar en entorno real es:

- alta nueva por `/crm`
- creacion automatica de la location
- creacion de la cuenta hosted de Waflow Inbox
- creacion del inbox/slot inicial
- apertura del acceso real de Waflow WhatsApp

### 2. Dependencias de Chatwoot

El standalone real depende de que el stack hosted de Chatwoot este sano y de que las credenciales/config del servidor esten correctas:

- base URL
- provisioning service
- webhook URL publica
- secretos/tokens necesarios

### 3. Billing y Agents

Ambos ya estan mucho mas cerca del original, pero conviene probarlos de punta a punta con una cuenta standalone real para confirmar:

- refresco de limites despues de billing
- carga correcta del workspace de agents con `locationId` real
- retorno correcto desde checkout y portal a `billing` del standalone

### 4. No mezclar sessiones manualmente

La bifurcacion por `userInterface` ya esta integrada, pero la validacion real importante es abrir:

- `/`
- `/agency`
- `/crm`
- `/standalone`

con sesiones distintas para confirmar que no haya rebotes raros ni pantallas cruzadas.

## Verificacion reciente

En este entorno, la validacion por build/check quedo limitada por:

- `EPERM: lstat C:\\Users\\info` al ejecutar `npm run build`
- misma limitacion para `node --check`

Verificado por inspeccion estatica:

- no hay `GeneralPanel` duplicado en `StandaloneSlotManager.jsx`
- QR realtime mantiene prioridad de evento `connection:open` frente a polling
- `StandaloneSettings.jsx` ya usa handlers reales en UI (General + Integraciones)

Warnings no bloqueantes conocidos:

- `noscript` dentro de `head` en `index.html`
- bundle grande de Vite
