const { listUsers, upsertUser, getUserByEmail } = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');
const { requireCsrf } = require('../../lib/csrf');
const { requireRateLimit } = require('../../lib/rate-limit');

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // Rate limiting para API general
      if (!requireRateLimit(req, res, 'api')) {
        return;
      }

      const auth = await requireUser(req, ['admin', 'supervisor']);
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

      const { targetEmail, role, country, activo } = req.body || {};

      const auth = await requireUser(req, ['admin', 'supervisor']);
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
