const { getCampaignByKey, getCampaignAvailability } = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');

const MAX_ATTEMPTS = Number(process.env.DIALER_MAX_ATTEMPTS || 3);
const MIN_HOURS_BETWEEN_ATTEMPTS = Number(process.env.DIALER_MIN_HOURS_BETWEEN_ATTEMPTS || 1);
const MAX_GESTIONS = Number(process.env.DIALER_MAX_GESTIONS || 5);

function buildReason(stats) {
  if (!stats) return 'none';
  if ((stats.totalPending || 0) === 0) return 'none';
  if ((stats.noPhone || 0) === stats.totalPending) return 'no_phone';
  if ((stats.maxGestions || 0) === stats.totalPending) return 'max_gestions';
  if ((stats.maxAttempts || 0) === stats.totalPending) return 'max_attempts';
  if ((stats.cooldown || 0) === stats.totalPending) return 'cooldown';
  if ((stats.locked || 0) > 0) return 'locked';
  return 'none';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { campaignKey } = req.body || {};
    if (!campaignKey) {
      return res.status(400).json({ error: 'campaignKey es requerido' });
    }

    const auth = await requireUser(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const campaign = await getCampaignByKey(campaignKey);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }

    const availability = await getCampaignAvailability(campaignKey, MAX_ATTEMPTS, MIN_HOURS_BETWEEN_ATTEMPTS, MAX_GESTIONS);
    return res.status(200).json({
      availability,
      reason: buildReason(availability)
    });
  } catch (error) {
    console.error('Error en campaign-availability:', error);
    return res.status(500).json({ error: error.message });
  }
}
