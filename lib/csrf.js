/**
 * CSRF Protection usando Double Submit Cookie Pattern
 *
 * Este patrón funciona así:
 * 1. El servidor genera un token aleatorio y lo envía como cookie
 * 2. El cliente lee la cookie y la envía también en un header
 * 3. El servidor verifica que ambos valores coincidan
 *
 * Un atacante CSRF no puede leer cookies de otro dominio (Same-Origin Policy),
 * por lo que no puede enviar el header correcto.
 */

const crypto = require('crypto');

// Nombre de la cookie y header CSRF
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

// Duración del token: 24 horas
const CSRF_TOKEN_MAX_AGE = 24 * 60 * 60;

/**
 * Genera un token CSRF seguro
 */
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Obtiene el token CSRF de la cookie
 */
function getCsrfTokenFromCookie(req) {
  const cookies = req.headers.cookie || '';
  const match = cookies.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

/**
 * Obtiene el token CSRF del header
 */
function getCsrfTokenFromHeader(req) {
  return req.headers[CSRF_HEADER_NAME] || null;
}

/**
 * Establece la cookie CSRF en la respuesta
 */
function setCsrfCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';

  const cookieOptions = [
    `${CSRF_COOKIE_NAME}=${token}`,
    `Path=/`,
    `Max-Age=${CSRF_TOKEN_MAX_AGE}`,
    `SameSite=Strict`
  ];

  // En producción, agregar Secure
  if (isProduction) {
    cookieOptions.push('Secure');
  }

  // Nota: NO usamos HttpOnly porque el cliente necesita leer esta cookie
  // para enviarla en el header. Esto es seguro porque:
  // 1. El token solo protege contra CSRF, no es un secreto de sesión
  // 2. Un XSS ya comprometería la sesión de otras formas

  // Usar appendHeader para no sobrescribir otras cookies (session cookies)
  const cookieValue = cookieOptions.join('; ');
  const existing = res.getHeader('Set-Cookie');
  if (existing) {
    const cookies = Array.isArray(existing) ? existing : [existing];
    cookies.push(cookieValue);
    res.setHeader('Set-Cookie', cookies);
  } else {
    res.setHeader('Set-Cookie', cookieValue);
  }
}

/**
 * Valida el token CSRF
 * Compara el token de la cookie con el del header
 */
function validateCsrfToken(req) {
  const cookieToken = getCsrfTokenFromCookie(req);
  const headerToken = getCsrfTokenFromHeader(req);

  // Ambos deben existir
  if (!cookieToken || !headerToken) {
    return {
      valid: false,
      error: 'Token CSRF faltante'
    };
  }

  // Comparación segura contra timing attacks
  try {
    const cookieBuffer = Buffer.from(cookieToken, 'hex');
    const headerBuffer = Buffer.from(headerToken, 'hex');

    if (cookieBuffer.length !== headerBuffer.length) {
      return {
        valid: false,
        error: 'Token CSRF inválido'
      };
    }

    const isValid = crypto.timingSafeEqual(cookieBuffer, headerBuffer);
    return {
      valid: isValid,
      error: isValid ? null : 'Token CSRF inválido'
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Token CSRF malformado'
    };
  }
}

/**
 * Middleware para validar CSRF en requests POST/PUT/DELETE
 *
 * Uso:
 * ```
 * import { withCsrfProtection } from '../../lib/csrf';
 *
 * async function handler(req, res) {
 *   // tu código aquí
 * }
 *
 * export default withCsrfProtection(handler);
 * ```
 */
function withCsrfProtection(handler) {
  return async (req, res) => {
    // Solo validar en métodos que modifican datos
    const methodsToProtect = ['POST', 'PUT', 'DELETE', 'PATCH'];

    if (methodsToProtect.includes(req.method)) {
      const validation = validateCsrfToken(req);

      if (!validation.valid) {
        return res.status(403).json({
          error: validation.error,
          code: 'CSRF_VALIDATION_FAILED'
        });
      }
    }

    // Continuar con el handler original
    return handler(req, res);
  };
}

/**
 * Verifica CSRF manualmente (para uso en handlers existentes)
 * Retorna true si es válido, o envía error 403 y retorna false
 */
function requireCsrf(req, res) {
  const validation = validateCsrfToken(req);

  if (!validation.valid) {
    res.status(403).json({
      error: validation.error,
      code: 'CSRF_VALIDATION_FAILED'
    });
    return false;
  }

  return true;
}

module.exports = {
  generateCsrfToken,
  getCsrfTokenFromCookie,
  getCsrfTokenFromHeader,
  setCsrfCookie,
  validateCsrfToken,
  withCsrfProtection,
  requireCsrf,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME
};
