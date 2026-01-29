const { claimNextDeal, getCampaignByKey, countCampaignPending, updateCampaignStatus, getCampaignAvailability } = require('../../lib/supabase');
const { getDealContext } = require('../../lib/pipedrive');
const { requireUser } = require('../../lib/auth');

const MAX_ATTEMPTS = Number(process.env.DIALER_MAX_ATTEMPTS || 3);
const MIN_HOURS_BETWEEN_ATTEMPTS = Number(process.env.DIALER_MIN_HOURS_BETWEEN_ATTEMPTS || 1);
const MAX_GESTIONS = Number(process.env.DIALER_MAX_GESTIONS || 5);

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
    if (campaign.status !== 'active') {
      return res.status(400).json({ error: 'La campaña no está activa' });
    }

    const claimed = await claimNextDeal(campaignKey, auth.user.email, 10, {
      maxAttempts: MAX_ATTEMPTS,
      minHoursBetweenAttempts: MIN_HOURS_BETWEEN_ATTEMPTS,
      maxGestions: MAX_GESTIONS
    });
    if (!claimed) {
      const availability = await getCampaignAvailability(campaignKey, MAX_ATTEMPTS, MIN_HOURS_BETWEEN_ATTEMPTS, MAX_GESTIONS);
      if (availability.totalPending === 0 && campaign.status === 'active') {
        await updateCampaignStatus(campaignKey, 'terminated');
        return res.status(200).json({ completed: true, campaignKey });
      }

      let reason = 'none';
      if (availability.totalPending > 0) {
        if (availability.eligible > 0 && availability.locked > 0) {
          reason = 'locked';
        } else if (availability.noPhone === availability.totalPending) {
          reason = 'no_phone';
        } else if (availability.maxGestions === availability.totalPending) {
          reason = 'max_gestions';
        } else if (availability.maxAttempts === availability.totalPending) {
          reason = 'max_attempts';
        } else if (availability.cooldown === availability.totalPending) {
          reason = 'cooldown';
        } else if (availability.locked > 0) {
          reason = 'locked';
        }
      }

      return res.status(200).json({
        available: false,
        reason,
        stats: availability
      });
    }

    let pipedrive = null;
    if (claimed.deal_id) {
      pipedrive = await getDealContext(claimed.deal_id);
    }

    res.status(200).json({
      leadId: String(claimed.deal_id),
      nombre: claimed.deal_title || '',
      telefono: claimed.phone_primary || '',
      telefonoSecundario: claimed.phone_secondary || '',
      intentos: claimed.attempts || 0,
      gestiones: claimed.gestions || 0,
      pipedriveDealId: claimed.deal_id,
      stageId: claimed.stage_id,
      stageName: claimed.stage_name,
      campaignKey,
      pipedrive
    });
  } catch (error) {
    console.error('Error en campaign-next-lead:', error);
    res.status(500).json({ error: error.message });
  }
}
