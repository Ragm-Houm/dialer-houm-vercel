const { releaseDealLock } = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { campaignKey, dealId } = req.body || {};
    if (!campaignKey || !dealId) {
      return res.status(400).json({ error: 'campaignKey y dealId son requeridos' });
    }

    const auth = await requireUser(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const { user } = auth;

    await releaseDealLock(campaignKey, Number(dealId), user.email);

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error en campaign-release:', error);
    res.status(500).json({ error: error.message });
  }
}
