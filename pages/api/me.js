const { getEjecutivoInfo } = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');
const { requireCsrf } = require('../../lib/csrf');
const { requireRateLimit } = require('../../lib/rate-limit');
const { getCredentials } = require('../../lib/session-cookie');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting para autenticación (10 intentos / 15 min)
  if (!requireRateLimit(req, res, 'auth')) {
    return;
  }

  // Validar CSRF token
  if (!requireCsrf(req, res)) {
    return;
  }

  try {
    // Leer credenciales de cookies primero, luego body como fallback
    const creds = getCredentials(req);
    const email = creds?.email || req.body?.email;
    const idToken = creds?.idToken || req.body?.idToken;

    if (!idToken) {
      return res.status(400).json({ error: 'Google idToken es requerido' });
    }

    const auth = await requireUser({ email, idToken });
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const { user, google } = auth;

    const ejecutivo = await getEjecutivoInfo(user.email).catch(() => null);

    res.status(200).json({ ok: true, user, ejecutivo, google });
  } catch (error) {
    console.error('Error en /api/me:', error);
    res.status(500).json({ error: error.message });
  }
}
