# 1. Usamos una imagen base ligera de Node 22 (soluciona el error de Vite 7)
FROM node:22-alpine

# 2. Establecemos el directorio de trabajo
WORKDIR /app

# 3. Copiamos los archivos de definición de paquetes primero (para aprovechar la caché de Docker)
COPY package*.json ./

# 4. Instalamos las dependencias
RUN npm install

# 5. Copiamos el resto del código fuente
COPY . .

# 6. Definimos los Argumentos de Construcción (Build Args)
# Vite necesita estas variables DURANTE el build para "quemarlas" en el código HTML/JS.
# Si tienes más variables VITE_, agrégalas aquí.
ARG VITE_API_URL
ARG VITE_ADMIN_SECRET
ARG GIT_SHA

# Las convertimos en variables de entorno disponibles para el proceso de build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ADMIN_SECRET=$VITE_ADMIN_SECRET
ENV GIT_SHA=$GIT_SHA

# 7. Ejecutamos el build de Vite
RUN npm run build

# 8. Exponemos el puerto 3000
EXPOSE 3000

# 9. Comando de inicio
# Usamos 'serve' para servir la carpeta 'dist' generada
CMD ["npx", "serve", "-s", "dist", "-p", "3000"]