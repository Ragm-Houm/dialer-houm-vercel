const { getCampaignByKey, listCampaignDeals, listCallOutcomes, getCampaignAvailability } = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');
const { getCredentials } = require('../../lib/session-cookie');
const { requireRateLimit } = require('../../lib/rate-limit');

function summarizeOutcome(outcome) {
  if (!outcome) return 'sin_resultado';
  return String(outcome);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  if (!requireRateLimit(req, res, 'api')) {
    return;
  }

  try {
    const { campaignKey } = req.query;

    // Obtener credenciales de cookies o query params
    const creds = getCredentials(req);
    const email = creds?.email || req.query.email;
    const idToken = creds?.idToken || req.query.idToken;

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

    const campaign = await getCampaignByKey(campaignKey);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }

    const deals = await listCampaignDeals(5000);
    const rows = deals.filter((row) => row.campaign_key === campaignKey);
    const outcomes = await listCallOutcomes();
    const outcomeKeys = outcomes.map((o) => o.key);
    const outcomeBuckets = outcomes.reduce((acc, item) => {
      acc[item.key] = item.metric_bucket || 'otro';
      return acc;
    }, {});

    const totals = {
      total: rows.length,
      contacted: 0,
      pending: 0,
      outcomes: {},
      buckets: {},
      executives: {}
    };

    const availability = await getCampaignAvailability(campaignKey);

    rows.forEach((row) => {
      const isDone = row.status === 'done';
      if (isDone) totals.contacted += 1;
      else totals.pending += 1;

      if (isDone) {
        const outcome = summarizeOutcome(row.last_outcome);
        totals.outcomes[outcome] = (totals.outcomes[outcome] || 0) + 1;
        const bucket = outcomeBuckets[outcome] || 'otro';
        totals.buckets[bucket] = (totals.buckets[bucket] || 0) + 1;
      }

      if (row.assigned_to) {
        if (!totals.executives[row.assigned_to]) {
          totals.executives[row.assigned_to] = { email: row.assigned_to, handled: 0, contacted: 0 };
        }
        totals.executives[row.assigned_to].handled += 1;
        if (isDone) {
          totals.executives[row.assigned_to].contacted += 1;
        }
      }
    });

    outcomeKeys.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(totals.outcomes, key)) {
        totals.outcomes[key] = 0;
      }
    });

    res.status(200).json({
      campaign,
      totals: {
        total: totals.total,
        contacted: totals.contacted,
        pending: totals.pending,
        outcomes: totals.outcomes,
        buckets: totals.buckets,
        availability
      },
      executives: Object.values(totals.executives),
      outcomes
    });
  } catch (error) {
    console.error('Error en campaign-detail:', error);
    res.status(500).json({ error: error.message });
  }
}
