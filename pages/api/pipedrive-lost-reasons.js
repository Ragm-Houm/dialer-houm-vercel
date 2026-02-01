const { listLostReasons } = require('../../lib/pipedrive');
const { requireUser } = require('../../lib/auth');
const { requireRateLimit } = require('../../lib/rate-limit');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireRateLimit(req, res, 'api')) {
    return;
  }

  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const reasons = await listLostReasons();
    return res.status(200).json({ reasons });
  } catch (error) {
    console.error('Error obteniendo motivos de perdida:', error);
    return res.status(500).json({ error: 'Error al obtener motivos de pérdida de Pipedrive' });
  }
}
