const {
  listCampaignDealsByKeys,
  listCampaigns,
  updateCampaignStatus,
  deleteCampaignByKey
} = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');
const { getCredentials } = require('../../lib/session-cookie');
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

      // Obtener credenciales de cookies o query params
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
      const rows = await listCampaigns({ country, status });
      const keys = rows.map((row) => row.campaign_key);
      const deals = await listCampaignDealsByKeys(keys);
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
      return res.status(200).json({ campaigns: enriched });
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
      // Obtener credenciales de cookies o body
      const creds = getCredentials(req);
      const email = creds?.email || req.body?.email;
      const idToken = creds?.idToken || req.body?.idToken;

      const { campaignKey, status, closeAt, closeTz, noTimeLimit } = req.body || {};
      if (!campaignKey || !status) {
        return res.status(400).json({ error: 'campaignKey y status son requeridos' });
      }
      if (!email || !idToken) {
        return res.status(401).json({ error: 'No autorizado' });
      }
      const auth = await requireUser({ email, idToken }, ['admin', 'supervisor']);
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
      // Obtener credenciales de cookies o body
      const creds = getCredentials(req);
      const email = creds?.email || req.body?.email;
      const idToken = creds?.idToken || req.body?.idToken;

      const { campaignKey } = req.body || {};
      if (!campaignKey) {
        return res.status(400).json({ error: 'campaignKey es requerido' });
      }
      if (!email || !idToken) {
        return res.status(401).json({ error: 'No autorizado' });
      }
      const auth = await requireUser({ email, idToken }, ['admin', 'supervisor']);
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
