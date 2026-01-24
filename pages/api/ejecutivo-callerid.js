// API route para obtener el Caller ID asignado a un ejecutivo
const { getEjecutivoInfo } = require('../../lib/sheets');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email es requerido' });
    }

    const ejecutivo = await getEjecutivoInfo(email);

    if (!ejecutivo) {
      return res.status(404).json({ error: 'Ejecutivo no encontrado' });
    }

    if (!ejecutivo.activo) {
      return res.status(403).json({ error: 'Ejecutivo no está activo' });
    }

    if (!ejecutivo.callerId) {
      return res.status(404).json({ error: 'No se encontró Caller ID asignado para este ejecutivo' });
    }

    res.status(200).json({
      email: ejecutivo.email,
      callerId: ejecutivo.callerId
    });
  } catch (error) {
    console.error('Error obteniendo Caller ID del ejecutivo:', error);
    res.status(500).json({ error: error.message });
  }
}
