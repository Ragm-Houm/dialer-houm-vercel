const { getUserByEmail } = require('./supabase');
const { verifyGoogleIdToken } = require('./google-auth');
const { getCredentials } = require('./session-cookie');

/**
 * Requiere autenticación de usuario
 * Soporta credenciales desde:
 * 1. Cookies HttpOnly (preferido, más seguro)
 * 2. Body/Query params (legacy, para compatibilidad)
 *
 * @param {object} credentials - { email, idToken } o req object
 * @param {string[]} allowedRoles - Roles permitidos (vacío = cualquier rol)
 */
async function requireUser(credentials, allowedRoles = []) {
  // Si recibimos un req object, extraer credenciales
  let email, idToken;

  if (credentials.headers) {
    // Es un request object, extraer de cookies o body/query
    const creds = getCredentials(credentials);
    if (!creds) {
      return { ok: false, status: 401, error: 'No autorizado' };
    }
    email = creds.email;
    idToken = creds.idToken;
  } else {
    // Credenciales pasadas directamente
    email = credentials.email;
    idToken = credentials.idToken;
  }

  return _verifyUser({ email, idToken }, allowedRoles);
}

/**
 * Verificación interna de usuario
 */
async function _verifyUser({ email, idToken }, allowedRoles = []) {
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
