/**
 * Endpoint para obtener/renovar el token CSRF
 *
 * GET /api/csrf-token
 *
 * Respuesta:
 * - Establece cookie 'csrf_token' con el token
 * - Retorna { ok: true } para indicar éxito
 *
 * El cliente debe llamar a este endpoint al inicio de la sesión
 * y luego enviar el valor de la cookie en el header 'x-csrf-token'
 * en todas las requests POST/PUT/DELETE
 */

const { generateCsrfToken, setCsrfCookie, getCsrfTokenFromCookie } = require('../../lib/csrf');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Si ya existe un token válido, reutilizarlo
    let token = getCsrfTokenFromCookie(req);

    // Si no existe o queremos forzar regeneración, crear uno nuevo
    if (!token || req.query.refresh === 'true') {
      token = generateCsrfToken();
    }

    // Establecer la cookie
    setCsrfCookie(res, token);

    // Responder con éxito y el token (fallback si cookie no se lee bien)
    res.status(200).json({ ok: true, token });
  } catch (error) {
    console.error('Error generando CSRF token:', error);
    res.status(500).json({ error: 'Error interno' });
  }
}
