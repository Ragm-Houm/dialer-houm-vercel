/**
 * Manejo seguro de cookies de sesión (HttpOnly)
 *
 * Ventajas de HttpOnly cookies sobre localStorage:
 * - JavaScript no puede leer las cookies (protección XSS)
 * - Se envían automáticamente con cada request
 * - Pueden tener fecha de expiración controlada por el servidor
 *
 * Arquitectura:
 * - Cookie 'session_token': contiene el Google ID Token (HttpOnly, Secure)
 * - Cookie 'session_email': contiene el email (HttpOnly, Secure)
 * - Cookie 'session_info': info no sensible para el cliente (NO HttpOnly)
 */

const crypto = require('crypto');

// Nombres de las cookies
const COOKIE_NAMES = {
  TOKEN: 'session_token',      // HttpOnly - Google ID Token
  EMAIL: 'session_email',      // HttpOnly - Email del usuario
  INFO: 'session_info'         // NO HttpOnly - Info para el cliente (role, country, picture)
};

// Duración de la sesión: 24 horas (igual que el ID Token de Google)
const SESSION_MAX_AGE = 24 * 60 * 60; // segundos

/**
 * Opciones base para cookies seguras
 */
function getCookieOptions(isHttpOnly = true) {
  const isProduction = process.env.NODE_ENV === 'production';

  const options = {
    path: '/',
    maxAge: SESSION_MAX_AGE,
    sameSite: 'Lax', // Permite navegación normal pero bloquea CSRF de otros sitios
    secure: isProduction,
    httpOnly: isHttpOnly
  };

  return options;
}

/**
 * Serializa opciones de cookie a string
 */
function serializeCookieOptions(options) {
  const parts = [];

  if (options.path) parts.push(`Path=${options.path}`);
  if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push('Secure');
  if (options.httpOnly) parts.push('HttpOnly');

  return parts.join('; ');
}

/**
 * Establece las cookies de sesión
 */
function setSessionCookies(res, { email, idToken, role, country, picture, name }) {
  const httpOnlyOptions = getCookieOptions(true);
  const clientOptions = getCookieOptions(false);

  // Info para el cliente (NO sensible, NO HttpOnly)
  const clientInfo = JSON.stringify({
    role: role || 'ejecutivo',
    country: country || '',
    picture: picture || '',
    name: name || ''
  });

  // Codificar en base64 para evitar problemas con caracteres especiales
  const encodedInfo = Buffer.from(clientInfo).toString('base64');

  const cookies = [
    `${COOKIE_NAMES.TOKEN}=${idToken}; ${serializeCookieOptions(httpOnlyOptions)}`,
    `${COOKIE_NAMES.EMAIL}=${encodeURIComponent(email)}; ${serializeCookieOptions(httpOnlyOptions)}`,
    `${COOKIE_NAMES.INFO}=${encodedInfo}; ${serializeCookieOptions(clientOptions)}`
  ];

  res.setHeader('Set-Cookie', cookies);
}

/**
 * Elimina las cookies de sesión (logout)
 */
function clearSessionCookies(res) {
  const expiredOptions = {
    path: '/',
    maxAge: 0,
    sameSite: 'Lax'
  };

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    expiredOptions.secure = true;
  }

  const cookies = [
    `${COOKIE_NAMES.TOKEN}=; ${serializeCookieOptions({ ...expiredOptions, httpOnly: true })}`,
    `${COOKIE_NAMES.EMAIL}=; ${serializeCookieOptions({ ...expiredOptions, httpOnly: true })}`,
    `${COOKIE_NAMES.INFO}=; ${serializeCookieOptions(expiredOptions)}`
  ];

  res.setHeader('Set-Cookie', cookies);
}

/**
 * Lee las cookies de sesión de la request
 */
function getSessionFromCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = {};

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name && rest.length > 0) {
      cookies[name] = rest.join('=');
    }
  });

  const idToken = cookies[COOKIE_NAMES.TOKEN] || null;
  const email = cookies[COOKIE_NAMES.EMAIL] ? decodeURIComponent(cookies[COOKIE_NAMES.EMAIL]) : null;

  let info = { role: null, country: null, picture: null, name: null };
  if (cookies[COOKIE_NAMES.INFO]) {
    try {
      const decoded = Buffer.from(cookies[COOKIE_NAMES.INFO], 'base64').toString('utf8');
      info = JSON.parse(decoded);
    } catch (e) {
      // Cookie corrupta, ignorar
    }
  }

  if (!idToken || !email) {
    return null;
  }

  return {
    idToken,
    email,
    ...info
  };
}

/**
 * Verifica si hay una sesión válida en las cookies
 */
function hasSessionCookie(req) {
  const session = getSessionFromCookies(req);
  return session !== null && session.idToken && session.email;
}

/**
 * Middleware para requerir sesión de cookies
 * Extrae el token y email de las cookies y los agrega a req.body
 * para compatibilidad con el código existente
 */
function withSessionCookie(handler) {
  return async (req, res) => {
    // Solo para métodos que necesitan autenticación
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const session = getSessionFromCookies(req);

      if (session) {
        // Agregar credenciales al body si no vienen ya
        req.body = req.body || {};
        if (!req.body.idToken) {
          req.body.idToken = session.idToken;
        }
        if (!req.body.email) {
          req.body.email = session.email;
        }
      }
    }

    return handler(req, res);
  };
}

/**
 * Obtiene las credenciales de la sesión (de cookies o body/query)
 * Útil para compatibilidad con ambos métodos
 */
function getCredentials(req) {
  // Primero intentar desde cookies
  const cookieSession = getSessionFromCookies(req);
  if (cookieSession?.idToken && cookieSession?.email) {
    return {
      idToken: cookieSession.idToken,
      email: cookieSession.email,
      role: cookieSession.role,
      country: cookieSession.country,
      picture: cookieSession.picture,
      name: cookieSession.name,
      source: 'cookie'
    };
  }

  // Fallback a body o query (para compatibilidad)
  const idToken = req.body?.idToken || req.query?.idToken;
  const email = req.body?.email || req.query?.email;

  if (idToken && email) {
    return { idToken, email, source: 'request' };
  }

  return null;
}

module.exports = {
  setSessionCookies,
  clearSessionCookies,
  getSessionFromCookies,
  hasSessionCookie,
  withSessionCookie,
  getCredentials,
  COOKIE_NAMES,
  SESSION_MAX_AGE
};
