const { endCampaignSession } = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId, email, idToken, activeSeconds, callSeconds, idleSeconds, status } = req.body || {};
    if (!sessionId || !email || !idToken) {
      return res.status(400).json({ error: 'sessionId, email e idToken son requeridos' });
    }

    const auth = await requireUser({ email, idToken });
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    await endCampaignSession(sessionId, {
      status: status || 'closed',
      active_seconds: Number(activeSeconds || 0),
      call_seconds: Number(callSeconds || 0),
      idle_seconds: Number(idleSeconds || 0)
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error en campaign-session-end:', error);
    return res.status(500).json({ error: error.message });
  }
}
