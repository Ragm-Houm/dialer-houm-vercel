/**
 * Endpoint unificado para manejo de sesión con cookies HttpOnly
 *
 * POST /api/auth/session - Login (establece cookies)
 * GET /api/auth/session - Obtener sesión actual
 * DELETE /api/auth/session - Logout (elimina cookies)
 */

const { requireUser } = require('../../../lib/auth');
const { getEjecutivoInfo, getUserByEmail } = require('../../../lib/supabase');
const { requireCsrf } = require('../../../lib/csrf');
const { requireRateLimit } = require('../../../lib/rate-limit');
const {
  setSessionCookies,
  clearSessionCookies,
  getSessionFromCookies,
  getCredentials
} = require('../../../lib/session-cookie');

export default async function handler(req, res) {
  // ========== GET: Obtener sesión actual ==========
  if (req.method === 'GET') {
    try {
      const session = getSessionFromCookies(req);

      if (!session || !session.email) {
        return res.status(200).json({ ok: false, session: null });
      }

      // Validar que el usuario exista y esté activo en Supabase
      // NO revalidar el Google ID Token (expira en 1hr, la sesión dura 24hr)
      const user = await getUserByEmail(session.email).catch(() => null);

      if (!user || !user.activo) {
        clearSessionCookies(res);
        return res.status(200).json({ ok: false, session: null, reason: 'user_inactive' });
      }

      // Obtener info actualizada del ejecutivo
      const ejecutivo = await getEjecutivoInfo(session.email).catch(() => null);

      return res.status(200).json({
        ok: true,
        session: {
          email: user.email,
          role: user.role || session.role || 'ejecutivo',
          country: user.country || session.country || '',
          picture: session.picture || '',
          name: session.name || ''
        },
        ejecutivo
      });
    } catch (error) {
      console.error('Error obteniendo sesión:', error);
      return res.status(500).json({ ok: false, error: 'Error interno' });
    }
  }

  // ========== POST: Login (establecer cookies) ==========
  if (req.method === 'POST') {
    // Rate limiting para autenticación
    if (!requireRateLimit(req, res, 'auth')) {
      return;
    }

    // CSRF protection
    if (!requireCsrf(req, res)) {
      return;
    }

    try {
      const { idToken } = req.body || {};

      if (!idToken) {
        return res.status(400).json({ ok: false, error: 'Google idToken es requerido' });
      }

      // Verificar token con Google
      const auth = await requireUser({ idToken });

      if (!auth.ok) {
        return res.status(auth.status).json({ ok: false, error: auth.error });
      }

      const { user, google } = auth;

      // Obtener info del ejecutivo
      const ejecutivo = await getEjecutivoInfo(user.email).catch(() => null);

      // Establecer cookies de sesión
      setSessionCookies(res, {
        email: user.email,
        idToken: idToken,
        role: user.role,
        country: user.country,
        picture: google?.picture || '',
        name: google?.name || ''
      });

      return res.status(200).json({
        ok: true,
        session: {
          email: user.email,
          role: user.role,
          country: user.country,
          picture: google?.picture || '',
          name: google?.name || ''
        },
        ejecutivo,
        // Mensaje si no tiene país asignado
        warning: !user.country ? 'Tu usuario no tiene país asignado. Pide a tu supervisor que lo configure.' : null
      });
    } catch (error) {
      console.error('Error en login:', error);
      return res.status(500).json({ ok: false, error: 'Error interno' });
    }
  }

  // ========== DELETE: Logout (eliminar cookies) ==========
  if (req.method === 'DELETE') {
    // CSRF protection para logout también
    if (!requireCsrf(req, res)) {
      return;
    }

    clearSessionCookies(res);
    return res.status(200).json({ ok: true, message: 'Sesión cerrada' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
