const { Connection, Request, TYPES } = require('tedious');
require('dotenv').config();

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
    tdsVersion: '7_1', // Compatible con SQL Server 2000
    enableArithAbort: true,
    isolationLevel: 1,
    debug: {
      packet: false,
      data: false,
      payload: false,
      token: false
    }
  }
};

function executeQuery(connection, query) {
  return new Promise((resolve, reject) => {
    const request = new Request(query, (err) => {
      if (err) {
        reject(err);
      }
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
      resolve(result);
    });

    request.on('error', (err) => {
      reject(err);
    });

    connection.execSql(request);
  });
}

async function testConnection() {
  console.log('🔄 Iniciando prueba de conexion a SQL Server 2000...\n');
  
  console.log('📋 Configuracion:');
  console.log(`   Servidor: ${dbConfig.server}:${dbConfig.options.port}`);
  console.log(`   Base de datos: ${dbConfig.options.database}`);
  console.log(`   Usuario: ${dbConfig.authentication.options.userName}`);
  console.log(`   TDS Version: ${dbConfig.options.tdsVersion} (SQL Server 2000)\n`);

  const connection = new Connection(dbConfig);
  
  connection.on('connect', async (err) => {
    if (err) {
      console.error('❌ Error de conexion:', err.message);
      return;
    }
    
    console.log('✅ Conexion establecida exitosamente!\n');
    
    try {
      // Prueba 1: Consulta basica
      console.log('🔍 Prueba 1: Consulta basica');
      const result1 = await executeQuery(connection, 'SELECT 1 as test, GETDATE() as fecha');
      console.log('✅ Resultado:', result1[0]);
      console.log('');
      
      // Prueba 2: Verificar version de SQL Server
      console.log('🔍 Prueba 2: Version de SQL Server');
      const result2 = await executeQuery(connection, 'SELECT @@VERSION as version');
      console.log('✅ Version:', result2[0].version.substring(0, 100) + '...');
      console.log('');
      
      // Prueba 3: Verificar tablas
      console.log('🔍 Prueba 3: Verificando tablas necesarias');
      const result3 = await executeQuery(connection, `
        SELECT 
          o.name as tabla
        FROM sysobjects o
        WHERE o.type = 'U' 
        AND o.name IN ('Alumnos', 'Cursos')
      `);
      
      if (result3.length > 0) {
        console.log('✅ Tablas encontradas:');
        result3.forEach(row => {
          console.log(`   - ${row.tabla}`);
        });
      } else {
        console.log('⚠️  No se encontraron las tablas Alumnos y/o Cursos');
      }
      console.log('');
      
      // Prueba 4: Consulta de ejemplo
      console.log('🔍 Prueba 4: Consulta de ejemplo (primeros 5 alumnos)');
      const result4 = await executeQuery(connection, `
        SELECT TOP 5 
          A.ApNom, 
          C.denominacion 
        FROM Alumnos A
        INNER JOIN Cursos C ON A.idCurso = C.idCurso
        ORDER BY A.ApNom
      `);
      
      if (result4.length > 0) {
        console.log('✅ Datos de ejemplo:');
        result4.forEach((row, index) => {
          console.log(`   ${index + 1}. ${row.ApNom} - ${row.denominacion}`);
        });
      } else {
        console.log('⚠️  No se encontraron datos en las tablas');
      }
      
      console.log('\n🎉 Todas las pruebas completadas exitosamente!');
      console.log('✅ La aplicacion deberia funcionar correctamente con SQL Server 2000.');
      
    } catch (queryError) {
      console.error('\n❌ Error en consultas:', queryError.message);
    } finally {
      connection.close();
      console.log('\n🔌 Conexion cerrada');
    }
  });

  connection.on('error', (err) => {
    console.error('\n❌ Error de conexion:', err.message);
    console.log('\n💡 Verificar:');
    console.log('   - SQL Server 2000 ejecutandose');
    console.log('   - Credenciales correctas en .env');
    console.log('   - Puerto 1433 accesible');
    console.log('   - TCP/IP habilitado en SQL Server');
  });

  console.log('🔌 Conectando...');
  connection.connect();
}

// Ejecutar la prueba
testConnection().catch(console.error);