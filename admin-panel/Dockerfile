# 1. Usamos una imagen base ligera de Node 22 (soluciona el error de Vite 7)
FROM node:22-alpine

# 2. Establecemos el directorio de trabajo
WORKDIR /app

# 3. Copiamos los archivos de definición de paquetes primero (para aprovechar la caché de Docker)
COPY package*.json ./

# 4. Instalamos las dependencias
RUN npm install
RUN npm install --global serve@14.2.6

# 5. Copiamos el resto del código fuente
COPY . .

# 6. Definimos los Argumentos de Construcción (Build Args)
# Vite necesita estas variables DURANTE el build para "quemarlas" en el código HTML/JS.
# Si tienes más variables VITE_, agrégalas aquí.
ARG VITE_API_URL=https://wa.waflow.ai
ARG VITE_INSTALL_APP_URL
ARG VITE_STRIPE_PUBLIC_KEY
ARG VITE_SUPPORT_PHONE
ARG VITE_OFFICIAL_WHATSAPP_API_UI_ENABLED=true
ARG VITE_OFFICIAL_WHATSAPP_API_ADMIN_BYPASS_ENABLED=false
ARG GIT_SHA

# Las convertimos en variables de entorno disponibles para el proceso de build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_INSTALL_APP_URL=$VITE_INSTALL_APP_URL
ENV VITE_STRIPE_PUBLIC_KEY=$VITE_STRIPE_PUBLIC_KEY
ENV VITE_SUPPORT_PHONE=$VITE_SUPPORT_PHONE
ENV VITE_OFFICIAL_WHATSAPP_API_UI_ENABLED=$VITE_OFFICIAL_WHATSAPP_API_UI_ENABLED
ENV VITE_OFFICIAL_WHATSAPP_API_ADMIN_BYPASS_ENABLED=$VITE_OFFICIAL_WHATSAPP_API_ADMIN_BYPASS_ENABLED
ENV GIT_SHA=$GIT_SHA

# 7. Ejecutamos el build de Vite
RUN npm run build

# 8. Exponemos el puerto 3000
EXPOSE 3000

# 9. Comando de inicio
# Genera runtime-config.js desde el .env del servicio y sirve la carpeta dist.
CMD ["sh", "-c", "node scripts/writeRuntimeConfig.cjs && serve -s dist -l 3000"]
