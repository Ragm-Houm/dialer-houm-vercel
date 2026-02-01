const { updateDealStage, updateDealOwner, updateDealStatus } = require('../../lib/pipedrive');
const { requireCsrf } = require('../../lib/csrf');
const { requireRateLimit } = require('../../lib/rate-limit');
const { requireUser } = require('../../lib/auth');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting para Pipedrive
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
    const { dealId, stageId, ownerId, status, lostReasonId } = req.body || {};

    if (!dealId || (!stageId && !ownerId && !status)) {
      return res.status(400).json({ error: 'dealId y al menos un campo a actualizar son requeridos' });
    }

    let deal = null;
    if (stageId) {
      deal = await updateDealStage(dealId, stageId);
    }
    if (ownerId) {
      deal = await updateDealOwner(dealId, ownerId);
    }
    if (status) {
      deal = await updateDealStatus(dealId, status, lostReasonId);
    }
    res.status(200).json({ deal });
  } catch (error) {
    console.error('Error actualizando deal:', error);
    res.status(500).json({ error: 'Error al actualizar deal en Pipedrive' });
  }
}
