const {
  listCampaignDealsByKeys,
  listCampaigns,
  updateCampaignStatus,
  deleteCampaignByKey
} = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');
const { requireRateLimit } = require('../../lib/rate-limit');
const { requireCsrf } = require('../../lib/csrf');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Rate limiting
    if (!requireRateLimit(req, res, 'api')) {
      return;
    }

    try {
      const { country, status } = req.query;

      const auth = await requireUser(req);
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }
      let rows = await listCampaigns({ country, status });

      // Filtrar campañas expiradas (close_at en el pasado y no sin límite de tiempo)
      if (status === 'active') {
        const now = new Date();
        rows = rows.filter((row) => {
          if (row.no_time_limit) return true;
          if (!row.close_at) return true;
          return new Date(row.close_at) > now;
        });
      }

      const keys = rows.map((row) => row.campaign_key);
      const deals = keys.length > 0 ? await listCampaignDealsByKeys(keys) : [];
      const countsByKey = deals.reduce((acc, deal) => {
        if (!acc[deal.campaign_key]) {
          acc[deal.campaign_key] = { total: 0, handled: 0, pending: 0 };
        }
        acc[deal.campaign_key].total += 1;
        if (deal.status === 'done') acc[deal.campaign_key].handled += 1;
        else acc[deal.campaign_key].pending += 1;
        return acc;
      }, {});
      const enriched = rows.map((row) => {
        const counts = countsByKey[row.campaign_key] || { total: 0, handled: 0, pending: 0 };
        return { ...row, ...counts };
      });

      // Si se piden activas, solo mostrar las que tienen leads pendientes
      const result = status === 'active'
        ? enriched.filter((c) => c.pending > 0)
        : enriched;

      return res.status(200).json({ campaigns: result });
    } catch (error) {
      console.error('Error listando campañas:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'PATCH') {
    // Rate limiting y CSRF para escritura
    if (!requireRateLimit(req, res, 'strict')) {
      return;
    }
    if (!requireCsrf(req, res)) {
      return;
    }

    try {
      const { campaignKey, status, closeAt, closeTz, noTimeLimit } = req.body || {};
      if (!campaignKey || !status) {
        return res.status(400).json({ error: 'campaignKey y status son requeridos' });
      }
      const auth = await requireUser(req, ['admin', 'supervisor']);
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ error: 'Status invalido' });
      }
      const updates = {};
      if (status === 'active') {
        if (noTimeLimit === true) {
          updates.no_time_limit = true;
          updates.close_at = null;
          updates.close_tz = null;
        } else if (closeAt) {
          updates.no_time_limit = false;
          updates.close_at = closeAt;
          updates.close_tz = closeTz || null;
        }
      }
      const updated = await updateCampaignStatus(campaignKey, status, updates);
      return res.status(200).json({ campaign: updated });
    } catch (error) {
      console.error('Error actualizando campaña:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    // Rate limiting y CSRF para eliminación
    if (!requireRateLimit(req, res, 'strict')) {
      return;
    }
    if (!requireCsrf(req, res)) {
      return;
    }

    try {
      const { campaignKey } = req.body || {};
      if (!campaignKey) {
        return res.status(400).json({ error: 'campaignKey es requerido' });
      }
      const auth = await requireUser(req, ['admin', 'supervisor']);
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }
      const deleted = await deleteCampaignByKey(campaignKey);
      return res.status(200).json({ campaign: deleted });
    } catch (error) {
      console.error('Error eliminando campaña:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
