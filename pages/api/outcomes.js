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

/**
 * Devuelve la configuración de acciones predeterminada según la categoría.
 * Cada flag controla un paso visible en la UI estilo Zapier.
 */
function getDefaultActionConfig(category) {
  switch (category) {
    case 'positive':
      return {
        assign_owner: true,
        allow_change_owner: true,
        change_stage: 'optional',   // 'no' | 'optional' | 'required'
        log_pipedrive: true,
        mark_lost: false,
        require_lost_reason: false,
        create_followup: false,
        mark_done: true,
        allow_retry: false,
        require_retry_time: false,
        require_future_delay: false
      };
    case 'neutral':
      return {
        assign_owner: false,
        allow_change_owner: false,
        change_stage: 'no',
        log_pipedrive: true,
        mark_lost: false,
        require_lost_reason: false,
        create_followup: true,
        mark_done: false,
        allow_retry: true,
        require_retry_time: true,
        require_future_delay: false
      };
    case 'negative':
    default:
      return {
        assign_owner: true,
        allow_change_owner: true,
        change_stage: 'no',
        log_pipedrive: true,
        mark_lost: true,
        require_lost_reason: true,
        create_followup: false,
        mark_done: true,
        allow_retry: false,
        require_retry_time: false,
        require_future_delay: false
      };
  }
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
      const { label, outcomeType, metricBucket, category, actionConfig } = req.body || {};

      if (!label) {
        return res.status(400).json({ error: 'label es requerido' });
      }
      const validCategories = ['positive', 'neutral', 'negative'];
      const cat = validCategories.includes(category) ? category : 'negative';

      const auth = await requireUser(req, ['admin']);
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }
      const key = slugify(label);
      if (!key) {
        return res.status(400).json({ error: 'Label invalido' });
      }

      // Si se pasa actionConfig lo usamos, sino default por categoría
      const finalConfig = (actionConfig && typeof actionConfig === 'object')
        ? actionConfig
        : getDefaultActionConfig(cat);

      const outcome = await createCallOutcome({
        key,
        label,
        activo: true,
        outcome_type: outcomeType || 'final',
        metric_bucket: metricBucket || 'otro',
        category: cat,
        action_config: finalConfig
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
      const { id, label, outcomeType, metricBucket, sortOrder, activo, category, actionConfig } = req.body || {};

      if (!id) {
        return res.status(400).json({ error: 'id es requerido' });
      }
      const auth = await requireUser(req, ['admin']);
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const updates = {
        label,
        outcome_type: outcomeType,
        metric_bucket: metricBucket,
        sort_order: sortOrder,
        activo
      };

      // Solo incluir category/action_config si se enviaron
      if (category !== undefined) {
        const validCategories = ['positive', 'neutral', 'negative'];
        if (validCategories.includes(category)) {
          updates.category = category;
        }
      }
      if (actionConfig !== undefined && typeof actionConfig === 'object') {
        updates.action_config = actionConfig;
      }

      const updated = await updateCallOutcome(id, updates);
      return res.status(200).json({ outcome: updated });
    } catch (error) {
      console.error('Error actualizando outcome:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
