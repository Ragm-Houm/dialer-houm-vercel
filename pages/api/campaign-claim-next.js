const { claimNextDeal, getCampaignByKey } = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');

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
    const { user } = auth;
    const campaign = await getCampaignByKey(campaignKey);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }
    if (campaign.status !== 'active') {
      return res.status(400).json({ error: 'La campaña no está activa' });
    }

    const claimed = await claimNextDeal(campaignKey, user.email, 10);

    res.status(200).json({
      ok: true,
      user: { email: user.email, role: user.role },
      campaignKey,
      claimed
    });
  } catch (error) {
    console.error('Error en campaign-claim-next:', error);
    res.status(500).json({ error: error.message });
  }
}
