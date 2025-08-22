# Imagen base
FROM node:20

# Crear y establecer el directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install --omit=dev

# Copiar el resto del código
COPY . .

# Exponer el puerto que usa tu app
EXPOSE 3000

# Comando para arrancar la app
CMD ["npm", "start"]
