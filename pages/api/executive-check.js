const { getEjecutivoInfo } = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, idToken } = req.body || {};
    if (!email || !idToken) {
      return res.status(400).json({ error: 'Email y Google idToken son requeridos' });
    }

    const auth = await requireUser({ email, idToken });
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const { user } = auth;

    const ejecutivo = await getEjecutivoInfo(user.email).catch(() => null);

    res.status(200).json({ ok: true, user, ejecutivo });
  } catch (error) {
    console.error('Error verificando ejecutivo:', error);
    res.status(500).json({ error: error.message });
  }
}
