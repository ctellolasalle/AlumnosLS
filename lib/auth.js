const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Lista de emails autorizados - PERSONALIZA ESTOS EMAILS CON TUS CUENTAS REALES
const AUTHORIZED_EMAILS = [
  // Usuarios del dominio lasalle.edu.ar
  'ctello@lasalle.edu.ar',
  'frevello@lasalle.edu.ar',
  'minveraldi@lasalle.edu.ar',
  'hgiongrandi@lasalle.edu.ar',
  // Usuarios del dominio lasalleflorida.edu.ar
  'porteriasecundario@lasalleflorida.edu.ar'
];

class AuthManager {
  constructor() {
    this.setupPassport();
  }

  setupPassport() {
    console.log('⚙️ Configurando estrategia Google OAuth 2.0...');
    
    // Configurar estrategia de Google OAuth
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback"
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('🔍 Procesando autenticacion Google para:', profile.emails[0].value);
        
        const user = {
          id: profile.id,
          email: profile.emails[0].value,
          name: profile.displayName,
          photo: profile.photos[0].value,
          domain: profile._json.hd, // Dominio de Google Workspace
          provider: 'google'
          // No es recomendable guardar el accessToken en la sesión por seguridad, a menos que sea necesario.
        };

        console.log(`🔍 Intento de login: ${user.email} (dominio: ${user.domain || 'Sin dominio'})`);

        // Verificar si el email esta en la lista autorizada
        if (!this.isAuthorizedEmail(user.email)) {
          console.log(`❌ Acceso denegado para: ${user.email} - No autorizado`);
          return done(null, false, { 
            message: `Acceso denegado. El email ${user.email} no esta autorizado.` 
          });
        }

        // Verificar que pertenezca al dominio correcto (opcional pero recomendado)
        const allowedDomains = this.getAllowedDomains();
        if (allowedDomains.length > 0 && user.domain && !allowedDomains.includes(user.domain)) {
          console.log(`❌ Acceso denegado para: ${user.email} - Dominio no autorizado (${user.domain})`);
          return done(null, false, { 
            message: `Acceso denegado. Solo usuarios de los dominios autorizados pueden acceder.` 
          });
        }

        console.log(`✅ Acceso autorizado para: ${user.email}`);
        return done(null, user);

      } catch (error) {
        console.error('❌ Error en autenticacion Google:', error);
        return done(error, null);
      }
    }));

    // Serializar usuario para la sesion (guardar el objeto de usuario completo)
    passport.serializeUser((user, done) => {
      console.log(`📝 Serializando usuario: ${user.email}`);
      done(null, user);
    });

    // Deserializar usuario de la sesion (el objeto viene directamente de la sesión)
    passport.deserializeUser((user, done) => {
      console.log(`🔍 Deserializando usuario: ${user.email}`);
      done(null, user);
    });
  }

  isAuthorizedEmail(email) {
    const emailLower = email.toLowerCase();
    
    // Primero verificar si está en la lista específica de emails autorizados
    if (AUTHORIZED_EMAILS.includes(emailLower)) {
      return true;
    }

    // Si no, verificar por dominio si hay dominios configurados
    const emailDomain = emailLower.split('@')[1];
    const allowedDomains = this.getAllowedDomains();
    
    if (allowedDomains.length === 0) {
      return false; // Si no hay dominios, solo se permiten los emails específicos
    }
    
    return allowedDomains.includes(emailDomain);
  }

  getAuthorizedEmails() {
    return [...AUTHORIZED_EMAILS];
  }

  // Obtener dominios permitidos desde variables de entorno
  getAllowedDomains() {
    const domains = process.env.GOOGLE_WORKSPACE_DOMAINS || '';
    return domains.split(',').map(d => d.trim()).filter(d => d.length > 0);
  }

  // Verificar si usuario tiene permisos de admin
  isAdmin(email) {
    const adminEmails = ['minveraldi@lasalle.edu.ar', 'ctello@lasalle.edu.ar'];
    return adminEmails.includes(email.toLowerCase());
  }

  // Middleware para proteger rutas - REQUIERE AUTENTICACION
  requireAuth(req, res, next) {
    if (req.isAuthenticated() && req.user) {
      return next();
    }
    
    console.log(`❌ Acceso no autorizado a: ${req.originalUrl}. Redirigiendo a login.`);
    
    if (req.xhr || req.headers.accept.includes('json')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Sesion requerida.',
        requiresAuth: true 
      });
    }
    
    res.redirect('/login?error=session_required');
  }

  // Middleware opcional para rutas que requieren admin
  requireAdminAuth(req, res, next) {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        success: false, 
        message: 'Sesion de administrador requerida.',
        requiresAuth: true 
      });
    }

    const userEmail = req.user.email;
    if (this.isAdmin(userEmail)) {
      return next();
    } else {
      console.log(`❌ Acceso admin denegado para: ${userEmail}`);
      return res.status(403).json({ 
        success: false, 
        message: 'Permisos de administrador requeridos.' 
      });
    }
  }
}

module.exports = AuthManager;