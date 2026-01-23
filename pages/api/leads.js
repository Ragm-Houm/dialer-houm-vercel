// API route para obtener leads
const { getSiguienteLead } = require('../../lib/sheets');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pais } = req.query;

    if (!pais) {
      return res.status(400).json({ error: 'País es requerido' });
    }

    const lead = await getSiguienteLead(pais);

    if (!lead) {
      return res.status(404).json({ error: 'No hay leads disponibles' });
    }

    res.status(200).json(lead);
  } catch (error) {
    console.error('Error obteniendo lead:', error);
    res.status(500).json({ error: error.message });
  }
}
