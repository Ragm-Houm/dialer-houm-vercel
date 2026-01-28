const { startCampaignSession } = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { campaignKey, email, idToken } = req.body || {};
    if (!campaignKey || !email || !idToken) {
      return res.status(400).json({ error: 'campaignKey, email e idToken son requeridos' });
    }

    const auth = await requireUser({ email, idToken });
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const sessionId = await startCampaignSession(campaignKey, auth.user.email);
    return res.status(200).json({ ok: true, sessionId });
  } catch (error) {
    console.error('Error en campaign-session-start:', error);
    return res.status(500).json({ error: error.message });
  }
}
