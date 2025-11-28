const express = require('express');
const passport = require('passport');
const router = express.Router();

// Ruta para iniciar autenticacion con Google
router.get('/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account' // Permitir seleccionar cuenta
  })
);

// Callback de Google OAuth - Aqui llega Google despues de la autenticacion
router.get('/google/callback',
  (req, res, next) => {
    console.log('🔍 Callback recibido de Google');
    console.log('Query params:', req.query);
    next();
  },
  passport.authenticate('google', { 
    failureRedirect: '/login?error=access_denied',
    failureFlash: false 
  }),
  (req, res) => {
    // Autenticacion exitosa
    const user = req.user;
    console.log(`✅ Usuario autenticado exitosamente: ${user?.email || 'Email no disponible'}`);
    console.log('Datos del usuario:', {
      id: user?.id,
      email: user?.email,
      name: user?.name,
      domain: user?.domain
    });
    
    // Verificar que la sesion se establecio correctamente
    console.log('Estado de la sesion:', {
      isAuthenticated: req.isAuthenticated(),
      sessionId: req.sessionID,
      user: req.user ? 'Usuario presente' : 'No hay usuario'
    });
    
    // Redirigir al dashboard principal
    console.log('🔄 Redirigiendo a la aplicacion principal');
    res.redirect('/');
  }
);

// Ruta de logout
router.post('/logout', (req, res) => {
  const userEmail = req.user?.email || 'Usuario desconocido';
  
  console.log(`🔓 Iniciando logout para: ${userEmail}`);
  
  req.logout((err) => {
    if (err) {
      console.error('Error en logout:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Error al cerrar sesion' 
      });
    }
    
    // Limpiar sesion del servidor
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destruyendo sesion:', err);
        // Aún si hay un error destruyendo, se intenta responder al cliente.
      }
      
      // La llamada a clearUserSession fue eliminada porque ya no es necesaria.
      
      console.log(`✅ Sesion cerrada para: ${userEmail}`);
      res.json({ 
        success: true, 
        message: 'Sesion cerrada exitosamente' 
      });
    });
  });
});

// Ruta para verificar estado de autenticacion (usada por el frontend)
router.get('/status', (req, res) => {
  console.log('🔍 Verificando estado de autenticacion');
  
  if (req.isAuthenticated() && req.user) {
    const user = req.user;
    console.log(`✅ Usuario autenticado: ${user.email}`);
    res.json({
      authenticated: true,
      user: {
        email: user.email,
        name: user.name,
        photo: user.photo,
        domain: user.domain,
        isAdmin: req.app.locals.authManager?.isAdmin(user.email) || false
      }
    });
  } else {
    console.log('❌ Usuario no autenticado');
    res.json({ 
      authenticated: false 
    });
  }
});

// Ruta para obtener informacion de usuarios autorizados (solo admins)
router.get('/authorized-users', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      success: false, 
      message: 'Autenticacion requerida' 
    });
  }

  const authManager = req.app.locals.authManager;
  if (!authManager.isAdmin(req.user.email)) {
    return res.status(403).json({ 
      success: false, 
      message: 'Permisos de administrador requeridos' 
    });
  }

  res.json({
    success: true,
    data: {
      authorizedEmails: authManager.getAuthorizedEmails(),
    }
  });
});

// Ruta de debug para ver informacion de la sesion
router.get('/debug', (req, res) => {
  res.json({
    isAuthenticated: req.isAuthenticated(),
    sessionID: req.sessionID,
    user: req.user,
    session: req.session,
  });
});

module.exports = router;