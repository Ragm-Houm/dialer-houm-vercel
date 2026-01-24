// API route para generar token de Twilio Client
const { generateAccessToken } = require('../../lib/twilio');
const { getEjecutivoInfo } = require('../../lib/sheets');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email es requerido' });
    }

    const ejecutivo = await getEjecutivoInfo(email);
    if (!ejecutivo || !ejecutivo.activo) {
      return res.status(403).json({ error: 'Ejecutivo no autorizado' });
    }

    // Limpiar email para usar como identity
    const identity = email.replace(/[^a-zA-Z0-9]/g, '_');

    // Generar token
    const token = generateAccessToken(identity);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      token,
      identity
    });
  } catch (error) {
    console.error('Error generando token:', error);
    res.status(500).json({ error: error.message });
  }
}
