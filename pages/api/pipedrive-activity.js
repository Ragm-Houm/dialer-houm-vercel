const { updateActivityDone } = require('../../lib/pipedrive');
const { requireCsrf } = require('../../lib/csrf');
const { requireRateLimit } = require('../../lib/rate-limit');
const { requireUser } = require('../../lib/auth');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  if (!requireRateLimit(req, res, 'pipedrive')) {
    return;
  }

  // Validar CSRF token
  if (!requireCsrf(req, res)) {
    return;
  }

  // Validar usuario autenticado
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const { activityId, done } = req.body || {};

    if (!activityId) {
      return res.status(400).json({ error: 'activityId es requerido' });
    }

    const activity = await updateActivityDone(activityId, done !== false);
    res.status(200).json({ activity });
  } catch (error) {
    console.error('Error actualizando actividad:', error);
    res.status(500).json({ error: 'Error al actualizar actividad en Pipedrive' });
  }
}
