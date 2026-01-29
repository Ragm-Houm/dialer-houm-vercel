const { insertCampaignEvent, incrementDealAttempt } = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { eventType, campaignKey, dealId, metadata } = req.body || {};
    if (!eventType || !campaignKey) {
      return res.status(400).json({ error: 'eventType y campaignKey son requeridos' });
    }

    const auth = await requireUser(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    if (eventType === 'call_started' && dealId) {
      await incrementDealAttempt(campaignKey, Number(dealId), auth.user.email);
    }

    await insertCampaignEvent({
      campaign_key: campaignKey,
      deal_id: dealId ? Number(dealId) : null,
      user_email: auth.user.email,
      event_type: eventType,
      metadata: metadata || {}
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error en track-event:', error);
    return res.status(500).json({ error: error.message });
  }
}
