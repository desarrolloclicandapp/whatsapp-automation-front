# Standalone App Status

## Resumen actual

El sandbox `src/standalone-app/` ya funciona como una segunda interfaz dentro del mismo frontend.

Entrada por URL:

- `/` y `/agency` -> frontend actual
- `/crm` y `/standalone` -> frontend standalone

La bifurcacion principal ya esta integrada en [App.jsx](/c:/Users/info/Documents/Waflow-Frontend/whatsapp-automation-front/admin-panel/src/App.jsx) y se apoya en `userInterface` para evitar mezclar sesiones con el frontend incorrecto.

## Estado por pantalla

### Login

Archivo:

- [StandaloneLogin.jsx](/c:/Users/info/Documents/Waflow-Frontend/whatsapp-automation-front/admin-panel/src/standalone-app/StandaloneLogin.jsx)

Estado:

- funcional con endpoints reales del flujo OTP
- envia `source: 'standalone_crm'`
- copy ya adaptado a `cuenta/account` para el standalone

### Layout

Archivo:

- [StandaloneLayout.jsx](/c:/Users/info/Documents/Waflow-Frontend/whatsapp-automation-front/admin-panel/src/standalone-app/StandaloneLayout.jsx)

Estado:

- sidebar colapsable
- tabs reales conectados
- accesos rapidos de producto
- modal de upgrade para `WaFloW CRM`

### Overview

Archivos:

- [StandaloneDashboard.jsx](/c:/Users/info/Documents/Waflow-Frontend/whatsapp-automation-front/admin-panel/src/standalone-app/StandaloneDashboard.jsx)
- [StandaloneSlotManager.jsx](/c:/Users/info/Documents/Waflow-Frontend/whatsapp-automation-front/admin-panel/src/standalone-app/StandaloneSlotManager.jsx)

Estado:

- vista monocuenta
- stats superiores adaptadas
- guia rapida con 3 cards
- gestion plana de WhatsApp sin modal previoñ

Nota:

- esta parte sigue con datos mock y toasts simulados

### Billing

Archivo:

- [StandaloneSubscription.jsx](/c:/Users/info/Documents/Waflow-Frontend/whatsapp-automation-front/admin-panel/src/standalone-app/StandaloneSubscription.jsx)

Estado:

- clon cercano del gestor original
- usa dependencias reales del panel actual
- pega a endpoints reales de pagos

### Agents

Archivo:

- [StandaloneAgents.jsx](/c:/Users/info/Documents/Waflow-Frontend/whatsapp-automation-front/admin-panel/src/standalone-app/StandaloneAgents.jsx)

Estado:

- clon del panel original
- simplificado para monocuenta
- mantiene `selectedLocationId` fijo en sandbox

Riesgo:

- para datos reales hay que reemplazar el `demo-location-123`

### Settings

Archivo:

- [StandaloneSettings.jsx](/c:/Users/info/Documents/Waflow-Frontend/whatsapp-automation-front/admin-panel/src/standalone-app/StandaloneSettings.jsx)

Estado:

- menu simplificado
- `Waflow WhatsApp`, `Integraciones`, `Desarrolladores`, `Apariencia`
- OpenAI reducido a una sola cuenta
- varios guardados siguen en modo local/mock si no se inyectan handlers reales

### Builder

Archivo:

- [StandaloneMessageBuilder.jsx](/c:/Users/info/Documents/Waflow-Frontend/whatsapp-automation-front/admin-panel/src/standalone-app/StandaloneMessageBuilder.jsx)

Estado:

- clon directo del builder original
- mantiene preview, copy al portapapeles y comando generado

## Copy e i18n

Locales afectados:

- [es.js](/c:/Users/info/Documents/Waflow-Frontend/whatsapp-automation-front/admin-panel/src/locales/es.js)
- [en.js](/c:/Users/info/Documents/Waflow-Frontend/whatsapp-automation-front/admin-panel/src/locales/en.js)

Estado:

- el standalone ya usa claves `standalone.*` para copy propio
- en la UI standalone se prioriza:
  - `WhatsApp` en vez de `Inbox`
  - `Cuenta/Account` en vez de `Agencia/Agency` cuando aplica

## Que esta real y que esta mock

Mas real:

- login OTP
- bifurcacion por URL
- billing
- parte importante de agents
- builder

Mas mock/sandbox:

- overview
- gestor de WhatsApp del dashboard
- shortcut de `WaFloW Mensajeria`
- modal de upgrade de `WaFloW CRM`
- parte de settings

## Recomendaciones

### 1. No asumir que overview ya esta listo para produccion real

`StandaloneDashboard` y `StandaloneSlotManager` estan pensados para maquetacion y flujo visual. Antes de usarlo con clientes reales conviene conectarlo a la data del usuario autenticado y reemplazar:

- slots mock
- `isWhatsAppConnected` mock
- acciones `toast` de QR / reconexion / desconexion

### 2. Resolver el `locationId` real en agents

`StandaloneAgents.jsx` todavia usa `demo-location-123`. Ese es hoy el punto tecnico mas delicado del sandbox si se quiere operacion real consistente.

### 3. Revisar billing con criterio standalone

Funciona, pero todavia conviene hacer una pasada de copy y semantica para validar si quedan restos de lenguaje heredado de `subagency/account/chatwoot` que no encajen con el producto final standalone.

### 4. Decidir el nombre final del modulo de mensajeria

Hoy conviven referencias de:

- `Waflow Inbox`
- `Waflow WhatsApp`
- shortcut `WaFloW Mensajeria`

Conviene cerrar una convencion final antes de pulir los ultimos textos para no duplicar branding.

### 5. Mantener sincronizacion con `admin`

Como varias pantallas son clones cercanos del panel actual, cada cambio fuerte en `src/admin/` puede exigir resincronizacion manual de:

- `StandaloneSubscription`
- `StandaloneAgents`
- `StandaloneMessageBuilder`

### 6. Seguir registrando cambios en la bitacora

El historial vivo sigue en:

- [STANDALONE_APP_NOTES.md](/c:/Users/info/Documents/Waflow-Frontend/whatsapp-automation-front/admin-panel/src/standalone-app/STANDALONE_APP_NOTES.md)

Este documento sirve mas como foto del estado actual y checklist de riesgos.

## Verificacion reciente

Ultima validacion hecha:

- `npm run build` en `whatsapp-automation-front/admin-panel`

Resultado:

- build ok

Warnings no bloqueantes que siguen presentes:

- `noscript` dentro de `head` en `index.html`
- bundle grande de Vite
