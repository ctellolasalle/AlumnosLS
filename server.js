const express = require('express');
const { Connection, Request, TYPES } = require('tedious');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
require('dotenv').config();

// Importar el sistema de autenticacion
const AuthManager = require('./lib/auth');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1); // Le dice a Express que confíe en el primer proxy

// Inicializar el gestor de autenticacion
const authManager = new AuthManager();
app.locals.authManager = authManager;

// Configuracion de seguridad
app.use(helmet({
  contentSecurityPolicy: false
}));

// Configuracion de sesiones - IMPORTANTE: Antes de passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'tu_clave_secreta_super_segura_aqui',
  name: process.env.SESSION_NAME || 'lasalle_session',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS en produccion
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Inicializar Passport
app.use(passport.initialize());
app.use(passport.session());

// CORS y JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting MAS PERMISIVO y EXCLUYENDO rutas de auth
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // Aumentado de 100 a 200 requests por IP
  message: 'Demasiadas solicitudes, intente mas tarde',
  standardHeaders: true,
  legacyHeaders: false,
  // EXCLUIR rutas de autenticacion del rate limiting
  skip: (req, res) => {
    return req.path.startsWith('/auth/') || 
           req.path === '/login' ||
           req.path.startsWith('/auth/google');
  }
});

// Aplicar rate limiting SOLO a rutas que no sean de auth
app.use(limiter);

// Configuracion para SQL Server 2000
const dbConfig = {
  server: process.env.DB_SERVER || '192.168.30.200',
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER || 'ctello',
      password: process.env.DB_PASSWORD || 'LSFLorida2022'
    }
  },
  options: {
    database: process.env.DB_NAME || 'LaSalleAran',
    port: 1433,
    encrypt: false,
    trustServerCertificate: true,
    connectionTimeout: 30000,
    requestTimeout: 30000,
    rowCollectionOnRequestCompletion: true,
    useUTC: false,
    abortTransactionOnError: true,
    enableArithAbort: true,
    isolationLevel: 1, // READ_COMMITTED
    // Configuraciones especificas para SQL Server 2000
    tdsVersion: '7_1', // Compatible con SQL Server 2000
    useColumnNames: false,
    columnNameReplacer: undefined,
    debug: {
      packet: false,
      data: false,
      payload: false,
      token: false
    }
  }
};

// Pool de conexiones simple para SQL Server 2000
class ConnectionPool {
  constructor(config) {
    this.config = config;
    this.connections = [];
    this.maxConnections = 5;
    this.currentConnections = 0;
  }

  async getConnection() {
    return new Promise((resolve, reject) => {
      const connection = new Connection(this.config);
      
      connection.on('connect', (err) => {
        if (err) {
          console.error('Error de conexion:', err);
          reject(err);
        } else {
          console.log('✅ Conexion establecida');
          resolve(connection);
        }
      });

      connection.on('error', (err) => {
        console.error('Error en conexion:', err);
        reject(err);
      });

      connection.connect();
    });
  }

  async executeQuery(query, parameters = []) {
    const connection = await this.getConnection();
    
    return new Promise((resolve, reject) => {
      const request = new Request(query, (err) => {
        connection.close();
        if (err) {
          console.error('Error en consulta:', err);
          reject(err);
        }
      });

      // Agregar parametros
      parameters.forEach(param => {
        request.addParameter(param.name, param.type, param.value);
      });

      const result = [];
      
      request.on('row', (columns) => {
        const row = {};
        columns.forEach(column => {
          row[column.metadata.colName] = column.value;
        });
        result.push(row);
      });

      request.on('requestCompleted', () => {
        connection.close();
        resolve(result);
      });

      request.on('error', (err) => {
        connection.close();
        reject(err);
      });

      connection.execSql(request);
    });
  }
}

// Crear pool de conexiones
const pool = new ConnectionPool(dbConfig);

// ===============================
// RUTAS DE AUTENTICACION (SIN RATE LIMIT)
// ===============================
app.use('/auth', authRoutes);

// Ruta para la pagina de login (SIN RATE LIMIT)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ===============================
// RUTAS PROTEGIDAS (CON RATE LIMIT APLICADO)
// ===============================

// Ruta principal - PROTEGIDA
app.get('/', authManager.requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rate limiting ESPECIFICO para la API de busqueda (mas restrictivo)
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // maximo 30 busquedas por minuto por usuario
  message: { 
    success: false, 
    message: 'Demasiadas busquedas, espere un momento antes de continuar' 
  },
  standardHeaders: true,
  legacyHeaders: false
});

// API para buscar alumnos - PROTEGIDA con rate limit especifico
app.get('/api/alumnos/buscar', authManager.requireAuth, searchLimiter, async (req, res) => {
  try {
    const { texto, estado } = req.query;
    
    if (!texto || texto.trim().length < 1) {
      return res.json({ success: false, message: 'Texto de busqueda requerido' });
    }

    const textoLimpio = texto.trim().toUpperCase();
    let apellido = '';
    let nombre = '';
    
    // Logica de busqueda igual que en Python
    if (textoLimpio.includes(',')) {
      const partes = textoLimpio.split(',').map(p => p.trim());
      apellido = partes[0];
      nombre = partes[1] || '';
    } else {
      const palabras = textoLimpio.split(' ').filter(p => p.length > 0);
      if (palabras.length === 1) {
        apellido = palabras[0];
        nombre = '';
      } else {
        apellido = palabras[0];
        nombre = palabras.slice(1).join(' ');
      }
    }

    // Filtros de estado
    let filtroEstado = '';
    switch (estado) {
      case 'activos':
        filtroEstado = `
          AND Cursos.denominacion <> '** Egresado **'
          AND Cursos.denominacion <> 'Externo'
          AND Cursos.denominacion <> 'Ingresantes'
        `;
        break;
      case 'egresados':
        filtroEstado = `AND Cursos.denominacion = '** Egresado **'`;
        break;
      default: // todos
        filtroEstado = `
          AND Cursos.denominacion <> 'Externo'
          AND Cursos.denominacion <> 'Ingresantes'
        `;
        break;
    }

    // Query compatible con SQL Server 2000
    const query = `
      SELECT Alumnos.ApNom, Cursos.denominacion
      FROM Alumnos
      INNER JOIN Cursos ON Alumnos.idCurso = Cursos.idCurso
      WHERE (
        UPPER(Alumnos.ApNom) LIKE @texto OR
        REPLACE(REPLACE(UPPER(Alumnos.ApNom), ',', ''), ' ', '') LIKE @textoSinEspacios OR
        (UPPER(Alumnos.ApNom) LIKE @apellido AND UPPER(Alumnos.ApNom) LIKE @nombre) OR
        (@nombre = '' AND UPPER(Alumnos.ApNom) LIKE @apellido) OR
        UPPER(Alumnos.ApNom) LIKE @texto
      )
      ${filtroEstado}
      ORDER BY Cursos.denominacion ASC, Alumnos.ApNom ASC
    `;

    const textoSinEspacios = textoLimpio.replace(/[ ,]/g, '');
    
    // Parametros para Tedious
    const parameters = [
      { name: 'texto', type: TYPES.NVarChar, value: `%${textoLimpio}%` },
      { name: 'textoSinEspacios', type: TYPES.NVarChar, value: `%${textoSinEspacios}%` },
      { name: 'apellido', type: TYPES.NVarChar, value: `%${apellido}%` },
      { name: 'nombre', type: TYPES.NVarChar, value: nombre ? `%${nombre}%` : '%' }
    ];

    const result = await pool.executeQuery(query, parameters);
    
    // Log de la consulta para auditoria
    console.log(`🔍 Busqueda realizada por ${req.user.email}: "${texto}" - ${result.length} resultados`);
    
    res.json({
      success: true,
      data: result,
      count: result.length
    });

  } catch (error) {
    console.error('Error en busqueda:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Test de conexion - PROTEGIDA
app.get('/api/test', authManager.requireAuth, async (req, res) => {
  try {
    const result = await pool.executeQuery('SELECT 1 as test');
    console.log(`🔧 Test de conexion realizado por ${req.user.email}`);
    res.json({ success: true, message: 'Conexion exitosa', data: result });
  } catch (error) {
    console.error('Error en test:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===============================
// MIDDLEWARE DE MANEJO DE ERRORES
// ===============================

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor'
  });
});

// Ruta 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Recurso no encontrado'
  });
});

// ===============================
// INICIALIZACION DEL SERVIDOR
// ===============================

async function startServer() {
  try {
    // Verificar variables de entorno de OAuth
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.warn('⚠️ Variables de entorno de Google OAuth no configuradas');
      console.log('📝 Configure GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env');
    }
    
    // Probar conexion inicial
    console.log('🔄 Probando conexion a SQL Server 2000...');
    await pool.executeQuery('SELECT 1 as test');
    console.log('✅ Conexion a SQL Server 2000 exitosa');
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`🔐 Login: http://localhost:${PORT}/login`);
      console.log(`📱 App: http://localhost:${PORT}`);
      console.log('');
      console.log('⚡ Rate Limiting configurado:');
      console.log('   - General: 200 req/15min (excluye auth)');
      console.log('   - Busqueda: 30 req/min');
      console.log('   - Auth: Sin limite');
      console.log('');
      console.log('👥 Usuarios autorizados:');
      authManager.getAuthorizedEmails().forEach(email => {
        console.log(`   - ${email}`);
      });
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    console.log('\n💡 Verificar:');
    console.log('- SQL Server 2000 ejecutandose');
    console.log('- Credenciales en archivo .env');
    console.log('- Puerto 1433 accesible');
    console.log('- Variables OAuth configuradas');
    process.exit(1);
  }
}

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('\n🔄 Cerrando servidor...');
  process.exit(0);
});

startServer().catch(console.error);