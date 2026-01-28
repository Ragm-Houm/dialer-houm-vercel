const { getDealContext } = require('../../lib/pipedrive');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { dealId } = req.query;
    if (!dealId) {
      return res.status(400).json({ error: 'dealId es requerido' });
    }

    const pipedrive = await getDealContext(dealId);
    res.status(200).json({ pipedrive });
  } catch (error) {
    console.error('Error obteniendo contexto del lead:', error);
    res.status(500).json({ error: error.message });
  }
}
