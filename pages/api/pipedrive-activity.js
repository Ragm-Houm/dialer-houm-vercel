const { updateActivityDone } = require('../../lib/pipedrive');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { activityId, done } = req.body || {};

    if (!activityId) {
      return res.status(400).json({ error: 'activityId es requerido' });
    }

    const activity = await updateActivityDone(activityId, done !== false);
    res.status(200).json({ activity });
  } catch (error) {
    console.error('Error actualizando actividad:', error);
    res.status(500).json({ error: error.message });
  }
}
