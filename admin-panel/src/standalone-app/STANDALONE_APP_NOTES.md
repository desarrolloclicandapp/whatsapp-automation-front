# Standalone App Notes

## Objetivo

Este directorio contiene la nueva interfaz `standalone` de Waflow, construida en paralelo a la interfaz actual.

La meta es:

- crear una nueva experiencia visual y funcional sin afectar la app activa
- mantener el trabajo aislado dentro de `src/standalone-app/`
- replicar, cuando convenga, la misma estructura, diseño y comportamiento que ya existe en `src/admin/`
- simplificar solo donde el producto standalone lo requiera, especialmente para el caso monocuenta

## Reglas de trabajo que estamos siguiendo

- No modificar archivos originales de `src/admin/`, `src/auth/` ni lógica existente de la app principal.
- Trabajar solo dentro de `src/standalone-app/`, salvo excepciones puntuales de i18n en `src/locales/es.js` y `src/locales/en.js`.
- Cuando una vista existente en `admin` ya funciona bien, preferir clonar su estructura en vez de reinventarla.
- Mantener la misma modularización del original cuando tenga sentido.
- Reutilizar componentes originales desde `src/admin/` o `src/components/` si eso ayuda a conservar comportamiento real y no rompe el aislamiento.
- Evitar extraer componentes compartidos nuevos si eso puede afectar la interfaz actual.
- Mantener el diseño lo más parecido posible al original, salvo simplificaciones explícitas del flujo standalone.

## Criterio visual y funcional

- El layout standalone debe parecerse al `AgencyDashboard` actual.
- Las vistas clonadas deben conservar comportamiento y estructura del original tanto como sea posible.
- Las simplificaciones aprobadas hasta ahora se hacen solo para:
  - eliminar conceptos de multi-cuenta/subcuenta
  - ocultar ajustes demasiado técnicos para el usuario final
  - mantener el sandbox invisible para la app principal

## Política de i18n

- Se usan preferentemente claves existentes del proyecto cuando ya cubren el texto necesario.
- Las claves nuevas propias del sandbox se agregan con prefijo `standalone.*`.
- No se deben reescribir ni “limpiar” archivos completos de locales.
- Solo se agregan bloques o claves nuevas al final, minimizando riesgo de mojibake.

## Estado actual del sandbox

### 1. Login

Archivo:

- `StandaloneLogin.jsx`

Base tomada de:

- `src/admin/WelcomeAuth.jsx`

Estado:

- clonado desde el flujo original
- mantiene lógica de autenticación, OTP, email, teléfono y acceso admin
- panel izquierdo limpiado para quitar CTA promocional y referencias visuales no deseadas
- sigue estructura split screen del original

### 2. Layout principal

Archivo:

- `StandaloneLayout.jsx`

Base tomada de:

- `src/admin/AgencyDashboard.jsx`

Estado:

- sidebar colapsable implementado
- header superior implementado
- navegación base replicada con tabs:
  - `overview`
  - `billing`
  - `agents`
  - `settings`
  - `builder`
- `reliability` excluido a propósito de la interfaz standalone
- links inferiores presentes:
  - soporte
  - cerrar sesión
- el enlace de documentación fue eliminado del sidebar standalone
- ya renderiza vistas reales para:
  - `billing`
  - `agents`
  - `settings`

### 3. Billing / Suscripción

Archivo:

- `StandaloneSubscription.jsx`

Base tomada de:

- `src/admin/SubscriptionManager.jsx`

Dependencias reutilizadas:

- `src/admin/PaymentMethodForm.jsx`
- `src/admin/constants/plans.js`

Estado:

- clon funcional del gestor de suscripciones
- mantiene tabs:
  - servicios
  - métodos de pago
  - facturas
- conserva integración con Stripe
- conserva lógica de compra, cambio de plan, cancelación, portal y pago directo
- el archivo fue limpiado para dejar imports y estructura más sanos dentro del sandbox
- sigue reutilizando dependencias reales del panel actual:
  - `PaymentMethodForm.jsx`
  - `constants/plans.js`

Último ajuste aplicado:

- se revisó nuevamente después de traer cambios recientes del repositorio
- se confirmó que el clon siga apuntando a las dependencias reales de `admin`
- se mantuvo la estrategia de clon cercano al original, sin reinterpretar el flujo de pagos

### 4. Agents

Archivo:

- `StandaloneAgents.jsx`

Base tomada de:

- `src/admin/WorkflowAgentsPanel.jsx`

Estado:

- clon visual cercano al original
- mantiene editor, documentos y chat de prueba
- simplificado para monocuenta

Reducciones aplicadas:

- se eliminó el selector visible de cuenta/subcuenta
- se eliminaron badges y referencias visibles de alcance multi-cuenta
- se eliminó la sección avanzada de:
  - `system_prompt`
  - `fallback_reply`
- los botones de prueba del chat se movieron debajo del `textarea`

Nota técnica:

- `selectedLocationId` sigue existiendo en código porque la API lo necesita
- por ahora se inicializa con `demo-location-123` como placeholder de sandbox

Último ajuste aplicado:

- se verificó de nuevo el frontend del panel contra `WorkflowAgentsPanel.jsx`
- se confirmó que la base visual sigue alineada con el original actual
- se conservaron las simplificaciones aprobadas:
  - sin selector de cuenta
  - sin badge de alcance de subcuenta
  - sin sección de prompt avanzado
  - botones de prueba movidos debajo del `textarea`

### 5. Dashboard wrapper

Archivo:

- `StandaloneDashboard.jsx`

Estado:

- ahora es la vista real del tab `overview`
- dejó de ser un wrapper vacío
- usa `mockLocation` y acciones simuladas para representar la gestión monocuenta sin API real

Adaptaciones aplicadas:

- se eliminó la tarjeta de límite de subcuentas
- la tarjeta de conexiones quedó orientada a `CONEXIONES WHATSAPP`
- se mantuvo la tarjeta de plan actual
- la guía rápida pasó a dos pasos:
  - añadir inbox
  - ponerlo en línea
- se eliminó la sección de cuentas activas, filtros y buscador de subcuentas
- el dashboard ahora muestra directamente la gestión de inboxes/conexiones

Archivos nuevos relacionados:

- `StandaloneSlotManager.jsx`

Base tomada de:

- overview de `src/admin/AgencyDashboard.jsx`
- bloques de slots y `SlotConnectionManager` dentro de `src/admin/LocationDetailsModal.jsx`

Simplificaciones aplicadas:

- experiencia plana sin modal previo
- datos mockeados en memoria para evitar llamadas reales
- acciones como QR, reconectar, desconectar y API oficial funcionan en modo sandbox con `toast`
- se mantuvo el selector de tipo de conexión:
  - QR
  - API oficial

### 6. Message Builder

Archivo:

- `StandaloneMessageBuilder.jsx`

Base tomada de:

- `src/admin/InteractiveMessageBuilder.jsx`

Estado:

- clon directo del constructor original
- mantiene:
  - estructura de dos columnas
  - panel de contenido
  - panel de botones
  - preview estilo WhatsApp
  - generador de comando
  - lógica de copiado con `navigator.clipboard.writeText`
  - `toast` de éxito y error

Ajuste aplicado:

- solo se cambió el nombre exportado a `StandaloneMessageBuilder`

### 7. Settings

Archivo:

- `StandaloneSettings.jsx`

Base tomada de:

- bloque `activeTab === 'settings'` dentro de `src/admin/AgencyDashboard.jsx`

Estado:

- se extrajo la estructura visual de dos columnas del panel original
- se creó un menú lateral reducido para standalone con:
  - `Waflow Inbox`
  - `Integraciones`
  - `Desarrolladores`
  - `Apariencia`
- se eliminaron del menú:
  - guía rápida
  - información de la cuenta
  - soporte
  - marca blanca

Simplificaciones aplicadas:

- `Waflow Inbox` muestra solo el formulario de Usuario Maestro
- la marca visible `Chatwoot` se reemplazó por `Waflow Inbox`
- `Integraciones` quedó reducida únicamente a OpenAI
- se eliminó el paso multi-cuenta de OpenAI y se dejó una configuración por cuenta
- `Desarrolladores` conserva API Keys y Webhooks con guardados mock/locales
- se reemplazaron referencias de `Agencia/Agency` por `Cuenta/Account`
- `Apariencia` mantiene la estructura del original

Nota técnica:

- en esta etapa los guardados de settings funcionan en modo sandbox/local salvo que luego se inyecten handlers por props

## Integración actual dentro del sandbox

`StandaloneLayout.jsx` ya renderiza vistas reales para:

- `overview` -> `StandaloneDashboard`
- `billing` -> `StandaloneSubscription`
- `agents` -> `StandaloneAgents`
- `settings` -> `StandaloneSettings`
- `builder` -> `StandaloneMessageBuilder`

Además:

- el layout se volvió a alinear visualmente con la versión más reciente de `AgencyDashboard.jsx`
- se ajustó el contenedor principal para parecerse más al dashboard actual
- se conectaron los tabs `billing` y `agents` para que ya no muestren placeholder sino sus clones reales

Las demás pestañas siguen con placeholder temporal hasta construir sus vistas reales.

## Cambios recientes registrados

### Integracion productiva por URL

Archivos afectados:

- `src/App.jsx`
- `StandaloneLogin.jsx`

Cambio aplicado:

- la app ahora bifurca desde el punto de entrada de la URL
- `/` y `/agency` mantienen el frontend actual
- `/crm` y `/standalone` cargan el frontend standalone
- si una sesion intenta abrir el frontend equivocado, `App.jsx` corrige la ruta antes de montar una UI incompatible
- se empezo a persistir `userInterface` en frontend para mantener la pagina correcta entre recargas y sesiones

Compatibilidad y seguridad:

- el flujo actual de agencias no se reemplazo ni se reestructuro
- los usuarios `admin` nunca montan el arbol standalone
- el standalone sigue entrando por `StandaloneLogin` y luego por `StandaloneLayout`

Preparacion de backend:

- `StandaloneLogin.jsx` ahora envia `source: 'standalone_crm'` en el flujo OTP/profile
- esto deja preparado el backend unico para distinguir el origen del alta cuando esa columna o logica se consuma de forma real

### Ajuste de copy standalone

Archivos afectados:

- `StandaloneDashboard.jsx`
- `StandaloneSlotManager.jsx`
- `StandaloneSettings.jsx`
- `StandaloneLogin.jsx`
- `src/locales/es.js`
- `src/locales/en.js`

Cambio aplicado:

- en la interfaz standalone se reemplazo el copy visible de `Inbox` por `WhatsApp`
- tambien se reforzo el uso de `Cuenta/Account` en textos visibles del sandbox
- se dejaron nuevas claves `standalone.*` para evitar depender del copy del panel original de agencias

Resultado esperado:

- overview y guia rapida hablan de `WhatsApp`
- gestor de slots muestra `Nuevo WhatsApp`, `WhatsApp conectado`, `Vincular WhatsApp`, etc.
- settings usa `Waflow WhatsApp` en vez de `Waflow Inbox`
- login standalone usa textos orientados a `cuenta/account` en los pasos de alta

### Tercera card en "Empieza aqui"

Archivos afectados:

- `StandaloneDashboard.jsx`
- `src/locales/es.js`
- `src/locales/en.js`

Cambio aplicado:

- se agrego una tercera card en la guia rapida del overview standalone
- la nueva card invita a abrir la mensajeria con el texto `Empieza a chatear`
- el boton `Abrir Waflow Inbox` usa una URL simulada temporal
- se dejo un mock local `isWhatsAppConnected` para probar el estado visual habilitado o deshabilitado
- la grilla de la guia rapida paso a 3 columnas en desktop para mantener simetria visual

### Modal de upgrade en Sidebar

Archivos afectados:

- `StandaloneLayout.jsx`
- `src/locales/es.js`
- `src/locales/en.js`

Cambio aplicado:

- el boton azul de `WaFloW CRM` ya no queda sin accion
- para planes `trial/starter` ahora abre un modal de upgrade dentro del mismo layout
- el modal usa copy premium y boton principal para redirigir al tab `billing`
- el cierre del popup se puede hacer desde la `X` superior o desde el boton secundario

Comportamiento:

- click en `WaFloW CRM` -> `setShowUpgradeModal(true)`
- click en `Mejorar mi plan ahora` -> `setActiveTab('billing')` y cierre del modal
- el modal vive solo en sandbox y no afecta al frontend original

### Resincronización tras actualización del repo

Después de un `git pull`, se revisaron nuevamente los clones del sandbox contra sus equivalentes en `src/admin/`.

Resultado:

- `StandaloneLayout.jsx` se ajustó para parecerse más a la estructura vigente del dashboard actual
- `StandaloneSubscription.jsx` se revisó para mantener su cercanía con el gestor de suscripciones original
- `StandaloneAgents.jsx` se volvió a comparar visualmente con el panel original para validar que las simplificaciones no rompieran la base de UI

### Ajuste del Sidebar

Archivo afectado:

- `StandaloneLayout.jsx`

Cambio aplicado:

- se eliminó el enlace de documentación del pie del sidebar
- se eliminó también el icono `BookOpen` del import

Se mantuvo intacto:

- enlace de soporte
- botón de cerrar sesión
- estructura y espaciado del bloque inferior del sidebar

### Creación de Settings Standalone

Archivos afectados:

- `StandaloneSettings.jsx`
- `StandaloneLayout.jsx`

Cambio aplicado:

- se creó la vista standalone de configuración basada en la sección `settings` del dashboard original
- se conectó el tab `settings` del layout para renderizar `StandaloneSettings`
- se mantuvo el look general del panel original, simplificando opciones para el caso monocuenta

Se mantuvo intacto:

- el código original de `AgencyDashboard.jsx`
- la estructura aislada del sandbox

### Adaptación del Overview Standalone

Archivos afectados:

- `StandaloneDashboard.jsx`
- `StandaloneSlotManager.jsx`
- `StandaloneLayout.jsx`

Cambio aplicado:

- se transformó el overview del sandbox para caso monocuenta
- el usuario entra al dashboard y ve directamente sus inboxes/conexiones
- la lógica visual del modal de detalle se aplanó dentro del dashboard
- se creó un gestor de slots standalone con expansión por inbox y paneles mock de:
  - conexión QR
  - API oficial

Se mantuvo intacto:

- `AgencyDashboard.jsx`
- `LocationDetailsModal.jsx`

### Preview local standalone

Archivos afectados:

- `App.jsx`
- `StandalonePreviewApp.jsx`
- `StandaloneLayout.jsx`

Cambio aplicado:

- se agrego una ruta temporal local en `/standalone-preview`
- esa ruta monta una shell de preview independiente del flujo real de auth/admin/agencia
- la shell permite probar presets mock de cuenta, login/layout y estado visual de conexion
- el logout del preview vuelve al estado inicial del sandbox

Notas de implementacion:

- el preview reutiliza los providers globales actuales
- el builder ya quedo conectado dentro del layout para inspeccion local completa
- el preview sigue siendo visual/sandbox y no una integracion real de backend

## Pendientes conocidos

- reemplazar el `selectedLocationId` fijo de agentes por un valor real del contexto cuando toque integrar datos reales
- decidir si el overview standalone mantendrá datos mock o si luego leerá una ubicación real del contexto del usuario
- revisar periódicamente los clones contra sus equivalentes de `src/admin/` cuando haya cambios nuevos upstream
- mantener este archivo actualizado en cada paso relevante

## Regla para futuras iteraciones

Cada vez que se trabaje una nueva vista o se cambie una decisión importante del sandbox, actualizar este archivo con:

- qué se creó o ajustó
- de qué archivo original se tomó referencia
- qué se mantuvo igual
- qué se simplificó y por qué
