const { listUsers, upsertUser, getUserByEmail } = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');
const { requireCsrf } = require('../../lib/csrf');
const { requireRateLimit } = require('../../lib/rate-limit');
const { getCredentials } = require('../../lib/session-cookie');

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // Rate limiting para API general
      if (!requireRateLimit(req, res, 'api')) {
        return;
      }

      // Obtener credenciales de cookies o query params
      const creds = getCredentials(req);
      const email = creds?.email || req.query.email;
      const idToken = creds?.idToken || req.query.idToken;

      if (!email || !idToken) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const auth = await requireUser({ email, idToken }, ['admin', 'supervisor']);
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }
      const users = await listUsers(300);
      return res.status(200).json({ ok: true, users });
    }

    if (req.method === 'POST') {
      // Rate limiting estricto para cambios de usuarios
      if (!requireRateLimit(req, res, 'strict')) {
        return;
      }
      // Validar CSRF token para operaciones de escritura
      if (!requireCsrf(req, res)) {
        return;
      }

      // Obtener credenciales de cookies o body
      const creds = getCredentials(req);
      const email = creds?.email || req.body?.email;
      const idToken = creds?.idToken || req.body?.idToken;

      const { targetEmail, role, country, activo } = req.body || {};

      if (!email || !idToken) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const auth = await requireUser({ email, idToken }, ['admin', 'supervisor']);
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }
      if (!targetEmail) {
        return res.status(400).json({ error: 'targetEmail es requerido' });
      }
      const actorRole = auth.user.role;
      if (actorRole !== 'admin') {
        if (role === 'admin') {
          return res.status(403).json({ error: 'Solo admin puede asignar rol admin' });
        }
        const existing = await getUserByEmail(targetEmail);
        if (existing?.role === 'admin') {
          return res.status(403).json({ error: 'No puedes modificar un admin' });
        }
      }
      const user = await upsertUser({ email: targetEmail, role, country, activo });
      return res.status(200).json({ ok: true, user });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error en /api/users:', error);
    return res.status(500).json({ error: error.message });
  }
}
