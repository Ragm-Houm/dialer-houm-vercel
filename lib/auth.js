const { getUserByEmail } = require('./supabase');
const { verifyGoogleIdToken } = require('./google-auth');
const { getCredentials } = require('./session-cookie');

/**
 * Requiere autenticación de usuario
 * Soporta credenciales desde:
 * 1. Cookies HttpOnly (preferido, más seguro) - valida por DB
 * 2. Body/Query params (login fresco) - valida con Google
 *
 * @param {object} credentials - { email, idToken } o req object
 * @param {string[]} allowedRoles - Roles permitidos (vacío = cualquier rol)
 */
async function requireUser(credentials, allowedRoles = []) {
  let email, idToken, source;

  if (credentials.headers) {
    // Es un request object, extraer de cookies o body/query
    const creds = getCredentials(credentials);
    if (!creds) {
      return { ok: false, status: 401, error: 'No autorizado' };
    }
    email = creds.email;
    idToken = creds.idToken;
    source = creds.source;
  } else {
    // Credenciales pasadas directamente
    email = credentials.email;
    idToken = credentials.idToken;
    source = credentials.source || 'direct';
  }

  // Si las credenciales vienen de cookies, validar por DB
  // (el Google ID Token puede haber expirado, pero la sesión de cookie sigue activa)
  if (source === 'cookie' && email) {
    return _verifyUserByDB(email, allowedRoles, credentials);
  }

  // Login fresco o sin cookies: validar con Google
  return _verifyUserByGoogle({ email, idToken }, allowedRoles);
}

/**
 * Verificar usuario por base de datos (para sesiones con cookie activa)
 */
async function _verifyUserByDB(email, allowedRoles = [], sessionInfo = {}) {
  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await getUserByEmail(normalizedEmail);
    if (!user || !user.activo) {
      return { ok: false, status: 403, error: 'Usuario no autorizado' };
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return { ok: false, status: 403, error: 'No tienes permisos para esta accion', user };
    }

    return {
      ok: true,
      user,
      google: {
        email: user.email,
        name: sessionInfo?.name || '',
        picture: sessionInfo?.picture || ''
      }
    };
  } catch (error) {
    return { ok: false, status: 500, error: error.message || 'Error interno' };
  }
}

/**
 * Verificar usuario con Google ID Token (para login fresco)
 */
async function _verifyUserByGoogle({ email, idToken }, allowedRoles = []) {
  try {
    const verified = await verifyGoogleIdToken(idToken);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (normalizedEmail && normalizedEmail !== verified.email) {
      return { ok: false, status: 403, error: 'Email no coincide con Google' };
    }

    const user = await getUserByEmail(verified.email);
    if (!user || !user.activo) {
      return { ok: false, status: 403, error: 'Usuario no autorizado' };
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return { ok: false, status: 403, error: 'No tienes permisos para esta accion', user };
    }

    return { ok: true, user, google: verified };
  } catch (error) {
    return { ok: false, status: 401, error: error.message || 'No autorizado' };
  }
}

/**
 * Middleware que agrega credenciales de cookies al request
 * para compatibilidad con código existente
 */
function withAuth(handler) {
  return async (req, res) => {
    // Extraer credenciales de cookies y agregarlas al body
    const creds = getCredentials(req);
    if (creds) {
      req.body = req.body || {};
      if (!req.body.idToken) req.body.idToken = creds.idToken;
      if (!req.body.email) req.body.email = creds.email;
    }
    return handler(req, res);
  };
}

module.exports = {
  requireUser,
  withAuth
};
