// API route para obtener leads
const { getSiguienteLead, getEjecutivoInfo } = require('../../lib/supabase');
const { getDealContext } = require('../../lib/pipedrive');
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
    const { pais } = req.query;

    // Obtener credenciales de cookies (preferido) o query params (legacy)
    const creds = getCredentials(req);
    const email = creds?.email || req.query.email;
    const idToken = creds?.idToken || req.query.idToken;

    if (!pais) {
      return res.status(400).json({ error: 'País es requerido' });
    }

    if (!email || !idToken) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const auth = await requireUser({ email, idToken });
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const verifiedEmail = auth.user.email;

    const ejecutivo = await getEjecutivoInfo(verifiedEmail);
    if (!ejecutivo || !ejecutivo.activo) {
      return res.status(403).json({ error: 'Ejecutivo no autorizado' });
    }

    const lead = await getSiguienteLead(pais);

    if (!lead) {
      return res.status(404).json({ error: 'No hay leads disponibles' });
    }

    let pipedrive = null;
    if (lead && lead.pipedriveDealId) {
      pipedrive = await getDealContext(lead.pipedriveDealId);
    }

    res.status(200).json({
      ...lead,
      pipedrive
    });
  } catch (error) {
    console.error('Error obteniendo lead:', error);
    res.status(500).json({ error: error.message });
  }
}
