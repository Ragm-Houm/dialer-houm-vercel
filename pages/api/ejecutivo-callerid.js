// API route para obtener el Caller ID asignado a un ejecutivo
// Busca en los Verified Caller IDs de Twilio por el friendly name (email)
const { getCallerIds } = require('../../lib/twilio');
const { getEjecutivoInfo } = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');
const { getCredentials } = require('../../lib/session-cookie');
const { requireRateLimit } = require('../../lib/rate-limit');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  if (!requireRateLimit(req, res, 'api')) {
    return;
  }

  try {
    // Obtener credenciales de cookies (preferido) o query params (legacy)
    const creds = getCredentials(req);
    const email = creds?.email || req.query.email;
    const idToken = creds?.idToken || req.query.idToken;

    if (!email || !idToken) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const auth = await requireUser({ email, idToken });
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const verifiedEmail = auth.user.email;

    console.log('Buscando Caller ID para email:', verifiedEmail);

    // Verificar que el ejecutivo esté activo
    const ejecutivo = await getEjecutivoInfo(verifiedEmail);
    if (!ejecutivo) {
      return res.status(404).json({ error: 'Ejecutivo no encontrado en Google Sheets' });
    }

    if (!ejecutivo.activo) {
      return res.status(403).json({ error: 'Ejecutivo no está activo' });
    }

    // Obtener todos los Caller IDs de Twilio
    const callerIds = await getCallerIds();
    console.log('Total Caller IDs disponibles:', callerIds.length);

    // Buscar Caller ID cuyo friendly name coincida con el email
    const callerIdMatch = callerIds.find(caller => {
      // Comparar friendly name con el email (case insensitive)
      const friendlyName = (caller.friendlyName || '').toLowerCase();
      const emailLower = verifiedEmail.toLowerCase();

      console.log(`Comparando: "${friendlyName}" con "${emailLower}"`);

      return friendlyName === emailLower;
    });

    if (!callerIdMatch) {
      console.log('No se encontró Caller ID con friendly name:', email);
      return res.status(404).json({
        error: 'No se encontró Caller ID verificado con ese email como friendly name',
        hint: 'Verifica que el Caller ID en Twilio tenga el email como Friendly Name'
      });
    }

    console.log('✅ Caller ID encontrado:', callerIdMatch.phoneNumber);

    res.status(200).json({
      email: verifiedEmail,
      callerId: callerIdMatch.phoneNumber,
      friendlyName: callerIdMatch.friendlyName
    });
  } catch (error) {
    console.error('Error obteniendo Caller ID del ejecutivo:', error);
    res.status(500).json({ error: error.message });
  }
}
