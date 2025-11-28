# AlumnosLS Web

Sistema de Consulta de Alumnos La Salle - Versión Web con Autenticación Google OAuth 2.0.

Este proyecto proporciona una interfaz web para consultar una base de datos de alumnos, con un sistema de autenticación seguro a través de Google Workspace (OAuth 2.0).

## Requisitos Previos

- Un servidor con sistema operativo Debian o Ubuntu.
- Node.js y npm instalados.
- Acceso de superusuario (root) para la instalación del servicio.

## Instalación

La instalación se ha automatizado mediante un script para facilitar el despliegue en un entorno de producción.

1.  **Clona o copia el proyecto** en el directorio deseado en tu servidor.

2.  **Navega al directorio `scripts`**:
    ```bash
    cd /ruta/a/tu/proyecto/scripts
    ```

3.  **Ejecuta el script de instalación** con privilegios de superusuario:
    ```bash
    sudo bash install.sh
    ```

El script se encargará de:
- Actualizar el sistema e instalar `nodejs` y `npm`.
- Instalar las dependencias de Node.js del proyecto.
- Crear un archivo `.env` a partir del ejemplo `.env.example`.
- Guiarte para configurar las variables de entorno.
- Crear, habilitar e iniciar un servicio `systemd` para que la aplicación se ejecute de forma continua.

### Configuración del archivo `.env`

El script de instalación te pedirá que edites el archivo `.env`. Es crucial que configures correctamente las siguientes variables para que la aplicación funcione:

```env
# Configuracion del servidor
PORT=3000
NODE_ENV=production # Cambiar a 'production' para despliegue

# Configuracion de base de datos SQL Server
DB_SERVER=db_ip_server
DB_NAME=db_name
DB_USER=db_user
DB_PASSWORD=db_pass

# Autenticacion Google OAuth 2.0
# Asegúrate de que los valores coincidan con tu configuración en Google Cloud Console
GOOGLE_CLIENT_ID=XXXXXXXXXXXXXXXXXXX.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-XXXXXXXXXXXXXXXXXXX
GOOGLE_CALLBACK_URL=https://tudominio.com/auth/google/callback
GOOGLE_WORKSPACE_DOMAINS=tudominio.com,otrodominio.com # Dominios permitidos separados por coma

# Seguridad de sesiones
SESSION_SECRET=genera_una_clave_aleatoria_de_64_caracteres_aqui
SESSION_NAME=lasalle_session
SESSION_MAX_AGE=86400000 # 24 horas en milisegundos
SESSION_SECURE=true # Poner en 'true' si usas HTTPS (recomendado en producción)

# Configuracion de proxy (si la aplicación corre detrás de uno como Nginx o Apache)
TRUST_PROXY=true # Poner en 'true' si usas un proxy inverso

# Configuracion de CORS (opcional, '*' es inseguro para producción)
ALLOWED_ORIGINS=https://tudominio.com
```

## Gestión del Servicio

Una vez instalado, la aplicación se ejecuta como un servicio llamado `alumnos-ls`. Puedes gestionarlo con los siguientes comandos `systemd`:

-   **Verificar el estado del servicio**:
    ```bash
    sudo systemctl status alumnos-ls
    ```

-   **Ver los logs en tiempo real**:
    ```bash
    sudo journalctl -u alumnos-ls -f
    ```

-   **Detener el servicio**:
    ```bash
    sudo systemctl stop alumnos-ls
    ```

-   **Reiniciar el servicio**:
    ```bash
    sudo systemctl restart alumnos-ls
    ```

## Desarrollo

Para un entorno de desarrollo local, no es necesario usar el script `install.sh`. Sigue estos pasos:

1.  Clona el repositorio.
2.  Instala las dependencias (incluyendo las de desarrollo):
    ```bash
    npm install
    ```
3.  Crea un archivo `.env` a partir de `.env.example` y configúralo.
4.  Inicia el servidor en modo de desarrollo (se reiniciará automáticamente con cada cambio):
    ```bash
    npm run dev
    ```

## Scripts Disponibles

-   `npm start`: Inicia el servidor en modo de producción. Usado por el servicio `systemd`.
-   `npm run dev`: Inicia el servidor con `nodemon` para desarrollo.
-   `npm test` o `npm run test-db`: Ejecuta un script para probar la conexión a la base de datos.
