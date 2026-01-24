// API route para obtener el Caller ID asignado a un ejecutivo
// Busca en los Verified Caller IDs de Twilio por el friendly name (email)
const { getCallerIds } = require('../../lib/twilio');
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

    console.log('Buscando Caller ID para email:', email);

    // Verificar que el ejecutivo esté activo
    const ejecutivo = await getEjecutivoInfo(email);
    if (!ejecutivo) {
      return res.status(404).json({ error: 'Ejecutivo no encontrado en Google Sheets' });
    }

    if (!ejecutivo.activo) {
      return res.status(403).json({ error: 'Ejecutivo no está activo' });
    }

    // Obtener todos los Caller IDs de Twilio
    const callerIds = await getCallerIds();
    console.log('Total Caller IDs disponibles:', callerIds.length);

    // Buscar Caller ID cuyo friendly name coincida con el email
    const callerIdMatch = callerIds.find(caller => {
      // Comparar friendly name con el email (case insensitive)
      const friendlyName = (caller.friendlyName || '').toLowerCase();
      const emailLower = email.toLowerCase();

      console.log(`Comparando: "${friendlyName}" con "${emailLower}"`);

      return friendlyName === emailLower;
    });

    if (!callerIdMatch) {
      console.log('No se encontró Caller ID con friendly name:', email);
      return res.status(404).json({
        error: 'No se encontró Caller ID verificado con ese email como friendly name',
        hint: 'Verifica que el Caller ID en Twilio tenga el email como Friendly Name'
      });
    }

    console.log('✅ Caller ID encontrado:', callerIdMatch.phoneNumber);

    res.status(200).json({
      email: email,
      callerId: callerIdMatch.phoneNumber,
      friendlyName: callerIdMatch.friendlyName
    });
  } catch (error) {
    console.error('Error obteniendo Caller ID del ejecutivo:', error);
    res.status(500).json({ error: error.message });
  }
}
