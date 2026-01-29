// API route para generar token de Twilio Client
const { generateAccessToken } = require('../../lib/twilio');
const { getEjecutivoInfo } = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');
const { requireCsrf } = require('../../lib/csrf');
const { requireRateLimit } = require('../../lib/rate-limit');
const { getCredentials } = require('../../lib/session-cookie');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting para autenticación
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

    let verifiedEmail;

    // Si tenemos credenciales de cookie, validar por DB (token Google puede estar expirado)
    if (creds?.source === 'cookie' && creds.email) {
      const { getUserByEmail } = require('../../lib/supabase');
      const user = await getUserByEmail(creds.email).catch(() => null);
      if (user && user.activo) {
        verifiedEmail = user.email;
      }
    }

    // Fallback: validar con Google ID Token (login fresco)
    if (!verifiedEmail) {
      if (!email || !idToken) {
        return res.status(400).json({ error: 'Email y Google idToken son requeridos' });
      }
      const auth = await requireUser({ email, idToken });
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }
      verifiedEmail = auth.user.email;
    }

    const ejecutivo = await getEjecutivoInfo(verifiedEmail);
    if (!ejecutivo || !ejecutivo.activo) {
      return res.status(403).json({ error: 'Ejecutivo no autorizado' });
    }

    // Limpiar email para usar como identity
    const identity = verifiedEmail.replace(/[^a-zA-Z0-9]/g, '_');

    // Generar token
    const token = generateAccessToken(identity);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      token,
      identity,
      email: verifiedEmail
    });
  } catch (error) {
    console.error('Error generando token:', error);
    res.status(500).json({ error: error.message });
  }
}
