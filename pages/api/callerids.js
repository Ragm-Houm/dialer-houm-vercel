// API route para obtener Caller IDs de Twilio
const { getCallerIds } = require('../../lib/twilio');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const callerIds = await getCallerIds();
    res.status(200).json(callerIds);
  } catch (error) {
    console.error('Error obteniendo Caller IDs:', error);
    res.status(500).json({ error: error.message });
  }
}
