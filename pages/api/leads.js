// API route para obtener leads
const { getSiguienteLead, getEjecutivoInfo } = require('../../lib/sheets');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pais, email } = req.query;

    if (!pais || !email) {
      return res.status(400).json({ error: 'País y email son requeridos' });
    }

    const ejecutivo = await getEjecutivoInfo(email);
    if (!ejecutivo || !ejecutivo.activo) {
      return res.status(403).json({ error: 'Ejecutivo no autorizado' });
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
