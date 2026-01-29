const { getEjecutivoInfo } = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');
const { requireRateLimit } = require('../../lib/rate-limit');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting para autenticación (10 intentos / 15 min)
  if (!requireRateLimit(req, res, 'auth')) {
    return;
  }

  // Nota: No requiere CSRF porque es solo lectura (verificación de sesión).
  // La protección viene de las cookies HttpOnly de sesión.

  try {
    // requireUser lee cookies automáticamente y valida por DB si hay sesión activa
    const auth = await requireUser(req);
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
