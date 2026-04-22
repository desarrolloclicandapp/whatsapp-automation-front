# Standalone App Status

## Resumen ejecutivo

El standalone ya no esta solo en modo sandbox visual. Hoy existe un circuito real de punta a punta para:

- entrar por `/crm` o `/standalone`
- autenticarse con el flujo standalone
- persistir `users.interface = 'standalone'`
- aprovisionar una cuenta monocuenta real con Waflow Inbox hosted
- cargar overview, settings, agents y accesos desde endpoints reales

El flujo agency/default sigue separado:

- `/` y `/agency` -> frontend actual
- `/crm` y `/standalone` -> frontend standalone

## Estado actual por capa

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
- aprovisionar cuenta hosted de Waflow Inbox
- crear inbox inicial
- crear slot inicial
- dejar acceso del mismo usuario final configurado

### Frontend standalone

Listo:

- `StandaloneLayout.jsx` ya usa `useStandaloneWorkspace.js`
- `StandaloneDashboard.jsx` ya usa datos reales
- `StandaloneSlotManager.jsx` ya usa endpoints reales
- `StandaloneSettings.jsx` ya usa endpoints reales para settings principales
- `StandaloneAgents.jsx` ya trabaja con `locationId` real
- `StandaloneLogin.jsx` ya entrega `interface` standalone al cerrar el flujo

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

### Settings

- usuario maestro
- OpenAI
- API keys
- webhooks

## Riesgos y recomendaciones

### 1. Aprovisionamiento real en VPS

Lo primero a validar en entorno real es:

- alta nueva por `/crm`
- creacion automatica de la location
- creacion de la cuenta hosted de Waflow Inbox
- creacion del inbox/slot inicial
- apertura del acceso real de Waflow Inbox

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

### 4. No mezclar sessiones manualmente

La bifurcacion por `userInterface` ya esta integrada, pero la validacion real importante es abrir:

- `/`
- `/agency`
- `/crm`
- `/standalone`

con sesiones distintas para confirmar que no haya rebotes raros ni pantallas cruzadas.

## Verificacion reciente

Ejecutado:

- `npm run build` en `whatsapp-automation-front/admin-panel`

Resultado:

- build OK

Limitacion de verificacion:

- `node --check` sobre archivos backend no se pudo usar en este entorno por un error EPERM del sandbox/Windows al resolver rutas

Warnings no bloqueantes conocidos:

- `noscript` dentro de `head` en `index.html`
- bundle grande de Vite
