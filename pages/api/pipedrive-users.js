const { listUsers } = require('../../lib/pipedrive');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const users = await listUsers(200);
    res.status(200).json({ users });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: error.message });
  }
}
