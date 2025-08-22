const express = require('express');
const { Connection, Request, TYPES } = require('tedious');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuracion de seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // maximo 100 requests por IP
  message: 'Demasiadas solicitudes, intente mas tarde'
});

app.use(limiter);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API para buscar alumnos
app.get('/api/alumnos/buscar', async (req, res) => {
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

// Test de conexion
app.get('/api/test', async (req, res) => {
  try {
    const result = await pool.executeQuery('SELECT 1 as test');
    res.json({ success: true, message: 'Conexion exitosa', data: result });
  } catch (error) {
    console.error('Error en test:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

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

// Inicializar servidor
async function startServer() {
  try {
    // Probar conexion inicial
    console.log('🔄 Probando conexion a SQL Server 2000...');
    await pool.executeQuery('SELECT 1 as test');
    console.log('✅ Conexion a SQL Server 2000 exitosa');
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`📱 Acceso web: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    console.log('\n💡 Verificar:');
    console.log('- SQL Server 2000 ejecutandose');
    console.log('- Credenciales en archivo .env');
    console.log('- Puerto 1433 accesible');
    process.exit(1);
  }
}

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('\n🔄 Cerrando servidor...');
  process.exit(0);
});

startServer().catch(console.error);