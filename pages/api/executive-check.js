const { getEjecutivoInfo } = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = await requireUser(req);
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
