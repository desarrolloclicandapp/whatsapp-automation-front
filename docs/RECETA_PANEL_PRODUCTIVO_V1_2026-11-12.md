# Receta del panel v1 publicado el 12-11

El servicio `whatsapp-baileys_whatsapp-frontend-service` usa `waflow-v1-frontend:20261112-slot-delete`, ID `sha256:b73347d5ac4ad12d65447218a0a18cc6da0d533f77bf4db48c32be6b30413175`.

La base es `waflow-v1-frontend:25fe56a-one-click`, ID `sha256:e1556da8c45a80ccfa6a9e17d9f307641699ce51f9ceba5044fe21e428f3c4d6`. El fuente de los dos cambios en el motivo de borrado está en el commit `d4bca42`. Se compila `admin-panel` con `npm ci --no-audit --no-fund` y `npm run build`; el `dist/` resultante es la única entrada de `Dockerfile.v1-panel-slot-delete-20261112`. El Dockerfile borra el `dist/` heredado antes de copiarlo para que no queden archivos anteriores.

El build conserva los seis parámetros públicos de la versión anterior: `VITE_API_URL`, `VITE_INSTALL_APP_URL`, `VITE_STRIPE_PUBLIC_KEY`, `VITE_SUPPORT_PHONE`, `VITE_OFFICIAL_WHATSAPP_API_UI_ENABLED` y `VITE_OFFICIAL_WHATSAPP_API_ADMIN_BYPASS_ENABLED`. Sus valores se toman de la versión publicada y no se guardan en esta receta. Antes de una reconstrucción, comparar los assets y el runtime config con la imagen anterior, ejecutar lint/build y verificar la huella final. La vuelta atrás es la imagen base exacta anterior; este documento no autoriza desplegar.
