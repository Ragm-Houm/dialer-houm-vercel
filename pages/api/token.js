// API route para generar token de Twilio Client
const { generateAccessToken } = require('../../lib/twilio');
const { getEjecutivoInfo } = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');
const { requireRateLimit } = require('../../lib/rate-limit');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting para autenticación
  if (!requireRateLimit(req, res, 'auth')) {
    return;
  }

  // Nota: No requiere CSRF — la protección viene de las cookies HttpOnly de sesión.
  // El token de Twilio es específico al usuario autenticado.

  try {
    // requireUser lee cookies automáticamente y valida por DB si hay sesión activa
    const auth = await requireUser(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const verifiedEmail = auth.user.email;

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
