/**
 * Utilidades CSRF para el cliente (browser)
 *
 * Uso:
 * ```
 * import { csrfFetch, initCsrf, getCsrfToken } from '../lib/csrf-client';
 *
 * // Al inicio de la app
 * await initCsrf();
 *
 * // Para hacer requests protegidas
 * const res = await csrfFetch('/api/some-endpoint', {
 *   method: 'POST',
 *   body: JSON.stringify({ data: 'value' })
 * });
 * ```
 */

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Lee el token CSRF de las cookies
 */
export function getCsrfToken() {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_COOKIE_NAME) {
      return value;
    }
  }
  return null;
}

/**
 * Inicializa el token CSRF llamando al endpoint
 * Debe llamarse al inicio de la sesión
 */
export async function initCsrf() {
  try {
    const res = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'same-origin'
    });

    if (!res.ok) {
      console.error('Error inicializando CSRF token');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error inicializando CSRF:', error);
    return false;
  }
}

/**
 * Wrapper de fetch que agrega automáticamente el token CSRF
 * Usar en lugar de fetch() para requests POST/PUT/DELETE
 */
export async function csrfFetch(url, options = {}) {
  const csrfToken = getCsrfToken();

  // Agregar el header CSRF si hay token
  const headers = {
    ...options.headers
  };

  if (csrfToken) {
    headers[CSRF_HEADER_NAME] = csrfToken;
  }

  // Asegurar que se envíen cookies
  return fetch(url, {
    ...options,
    headers,
    credentials: options.credentials || 'same-origin'
  });
}

/**
 * Hook para obtener headers con CSRF incluido
 * Útil para usar con otras librerías de fetch
 */
export function getCsrfHeaders(existingHeaders = {}) {
  const csrfToken = getCsrfToken();

  return {
    ...existingHeaders,
    ...(csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : {})
  };
}
