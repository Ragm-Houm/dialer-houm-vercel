const { listLostReasons } = require('../../lib/pipedrive');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const reasons = await listLostReasons();
    return res.status(200).json({ reasons });
  } catch (error) {
    console.error('Error obteniendo motivos de perdida:', error);
    return res.status(500).json({ error: error.message });
  }
}
