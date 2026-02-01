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
      const { country, status, view } = req.query;

      const auth = await requireUser(req);
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      // Para el dialer solo traer activas de BD; para review traer todas
      const dbStatus = view === 'dialer' ? 'active'
        : (status === 'inactive' ? 'inactive' : undefined);
      const rows = await listCampaigns({ country, status: dbStatus });

      // Enriquecer con conteos de leads
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

      // Calcular effective_status para cada campaña:
      // - active: status='active' en BD, no expirada Y con leads pendientes
      // - terminated: status='active' en BD pero expirada O sin leads pendientes
      // - inactive: status='inactive' en BD (desactivada manualmente)
      const now = new Date();
      const enriched = rows.map((row) => {
        const counts = countsByKey[row.campaign_key] || { total: 0, handled: 0, pending: 0 };
        let effectiveStatus = row.status;
        if (row.status === 'active') {
          const isExpired = !row.no_time_limit && row.close_at && new Date(row.close_at) <= now;
          if (isExpired || counts.pending === 0) {
            effectiveStatus = 'terminated';
          }
        }
        return { ...row, ...counts, effective_status: effectiveStatus };
      });

      // Filtrar según lo solicitado
      let result = enriched;
      if (view === 'dialer' || status === 'active') {
        result = enriched.filter((c) => c.effective_status === 'active');
      } else if (status === 'inactive') {
        result = enriched.filter((c) => c.effective_status === 'inactive');
      } else if (status === 'terminated') {
        result = enriched.filter((c) => c.effective_status === 'terminated');
      }
      // status='all' o sin status → devolver todo

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
