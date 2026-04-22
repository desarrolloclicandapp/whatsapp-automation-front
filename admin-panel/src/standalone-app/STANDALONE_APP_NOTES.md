# Standalone App Notes

## Objetivo

Este directorio contiene la nueva interfaz standalone/CRM de Waflow, construida en paralelo al frontend actual de agencias.

La meta del trabajo evoluciono en dos etapas:

- primero: crear una interfaz aislada en sandbox, sin tocar el flujo principal
- despues: conectarla de verdad al mismo backend y a la misma base de datos, manteniendo el circuito agency intacto

## Reglas que se mantuvieron

- no romper el flujo actual de `/` y `/agency`
- reutilizar estructura visual y logica de `src/admin/` cuando conviene
- mantener el standalone monocuenta y ocultar conceptos de subcuentas donde aplica
- centralizar el trabajo nuevo dentro de `src/standalone-app/`, salvo integraciones necesarias en `App.jsx`, locales y backend

## Historial resumido

### Etapa 1: sandbox visual

Se crearon las bases del standalone:

- `StandaloneLogin.jsx`
- `StandaloneLayout.jsx`
- `StandaloneDashboard.jsx`
- `StandaloneSubscription.jsx`
- `StandaloneAgents.jsx`
- `StandaloneMessageBuilder.jsx`
- `StandaloneSettings.jsx`
- `StandaloneSlotManager.jsx`

Tambien se agregaron claves `standalone.*` en locales y se ajusto el copy para que el standalone use:

- `WhatsApp` en lugar de `Inbox`
- `Cuenta/Account` en lugar de `Agencia/Agency` cuando corresponde

### Etapa 2: entrada real por URL

Se integro el bifurcador de frontend en `App.jsx`:

- `/` y `/agency` -> frontend actual
- `/crm` y `/standalone` -> frontend standalone

Ademas:

- `StandaloneLogin` envia `source: 'standalone_crm'`
- la app persiste y usa `userInterface`
- se corrigen rutas cuando la sesion no coincide con el frontend esperado

### Etapa 3: paso a integracion real

Se conecto el standalone al backend/BD reales.

Cambios principales de backend:

- `users.interface` ya se usa realmente
- `init.js` ahora hace backfill de `users.interface = 'agency'` cuando estaba vacio
- auth ahora devuelve `interface` en:
  - login
  - verify email OTP
  - verify phone OTP
  - impersonation
- `completeProfile` standalone ahora dispara aprovisionamiento monocuenta real
- se creo `whatsapp-automation/src/services/standaloneProvisioningService.js`

Lo que hace `standaloneProvisioningService.js`:

- crea la tenant/location unica del usuario standalone
- aprovisiona una cuenta hosted de Waflow Inbox/Chatwoot
- crea el inbox inicial
- crea el primer slot
- deja configurado el acceso del propio usuario final

Cambios principales de perfil/datos:

- `GET /agency/info` ahora devuelve:
  - `interface`
  - `primary_location_id`
  - `crm_type` efectivo resuelto desde la tenant primaria

Cambios principales de frontend:

- se creo `useStandaloneWorkspace.js`
- `StandaloneLayout` ahora carga:
  - cuenta real
  - locations reales
  - location primaria real
  - detalle real de location
  - acceso real a Waflow Inbox
- `StandaloneDashboard` ya no usa `mockLocation`
- `StandaloneSlotManager` ya no usa QR/slots simulados
- `StandaloneAgents` ya recibe `locationId` real
- `StandaloneSettings` ya opera con endpoints reales de:
  - usuario maestro
  - OpenAI
  - API keys
  - webhooks
- `StandaloneLogin` ahora pasa `interface` standalone al completar el alta/login del flujo nuevo

## Estado actual por area

### Login

- usa endpoints reales OTP
- envia `source: 'standalone_crm'`
- ya entrega `interface` standalone al cerrar el flujo

### Layout

- sidebar y header ya viven sobre datos reales
- shortcuts del sidebar leen plan/estado real del workspace
- el acceso de mensajeria abre Waflow Inbox real cuando existe acceso

### Overview

- usa cuenta, location y slots reales
- la guia rapida se calcula con datos reales
- ya no depende de mock local

### Gestor de WhatsApp

- usa endpoints reales para:
  - add slot
  - QR start
  - QR/status
  - reconnect
  - soft-disconnect
  - disconnect
  - delete slot
  - official API config/validate
  - QR share link

### Billing

- se mantiene como clon cercano del gestor original
- sigue usando dependencias reales del panel actual

### Agents

- mantiene simplificacion monocuenta
- ya recibe `locationId` real

### Settings

- Waflow WhatsApp conectado a usuario maestro real
- OpenAI conectado a `/agency/settings`
- API keys y webhooks conectados a endpoints reales
- apariencia sigue la base visual del original

### Builder

- sigue como clon cercano del builder original
- mantiene preview y copiado de comando

## Pendientes conocidos

- el standalone ya salio del modo mock en su flujo principal, pero todavia conviene revisar en VPS:
  - el aprovisionamiento real del primer workspace
  - la apertura real de Waflow Inbox
  - el comportamiento del primer slot en trial
- `StandaloneSubscription` y `StandaloneAgents` deberian revisarse otra vez cuando cambie fuerte su version original en `src/admin/`
- el check de sintaxis de backend con `node --check` no se pudo usar aqui por una limitacion EPERM del entorno de Windows/sandbox, aunque el frontend si compilo correctamente

## Verificacion reciente

- `npm run build` en `whatsapp-automation-front/admin-panel`
- resultado: build OK

Warnings no bloqueantes conocidos:

- `noscript` dentro de `head` en `index.html`
- bundle grande de Vite
