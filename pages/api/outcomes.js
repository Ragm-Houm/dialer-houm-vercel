const { listCallOutcomes, createCallOutcome, deleteCallOutcome, updateCallOutcome } = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');
const { requireRateLimit } = require('../../lib/rate-limit');
const { requireCsrf } = require('../../lib/csrf');

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!requireRateLimit(req, res, 'api')) {
      return;
    }

    try {
      const auth = await requireUser(req);
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }
      const rows = await listCallOutcomes();
      return res.status(200).json({ outcomes: rows });
    } catch (error) {
      console.error('Error listando outcomes:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    if (!requireRateLimit(req, res, 'strict')) {
      return;
    }
    if (!requireCsrf(req, res)) {
      return;
    }

    try {
      const { label, outcomeType, metricBucket } = req.body || {};

      if (!label) {
        return res.status(400).json({ error: 'label es requerido' });
      }
      const auth = await requireUser(req, ['admin']);
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }
      const key = slugify(label);
      if (!key) {
        return res.status(400).json({ error: 'Label invalido' });
      }
      const outcome = await createCallOutcome({
        key,
        label,
        activo: true,
        outcome_type: outcomeType || 'final',
        metric_bucket: metricBucket || 'otro'
      });
      return res.status(200).json({ outcome });
    } catch (error) {
      console.error('Error creando outcome:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    if (!requireRateLimit(req, res, 'strict')) {
      return;
    }
    if (!requireCsrf(req, res)) {
      return;
    }

    try {
      const { id } = req.body || {};

      if (!id) {
        return res.status(400).json({ error: 'id es requerido' });
      }
      const auth = await requireUser(req, ['admin']);
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }
      await deleteCallOutcome(id);
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Error eliminando outcome:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'PATCH') {
    if (!requireRateLimit(req, res, 'strict')) {
      return;
    }
    if (!requireCsrf(req, res)) {
      return;
    }

    try {
      const { id, label, outcomeType, metricBucket, sortOrder, activo } = req.body || {};

      if (!id) {
        return res.status(400).json({ error: 'id es requerido' });
      }
      const auth = await requireUser(req, ['admin']);
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }
      const updated = await updateCallOutcome(id, {
        label,
        outcome_type: outcomeType,
        metric_bucket: metricBucket,
        sort_order: sortOrder,
        activo
      });
      return res.status(200).json({ outcome: updated });
    } catch (error) {
      console.error('Error actualizando outcome:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
