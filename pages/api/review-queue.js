const { listDealsByPipelineStage } = require('../../lib/pipedrive');
const { getReviewedDealIds, upsertCampaignState, getReviewMetrics } = require('../../lib/supabase');
const { getCountryConfig } = require('../../lib/review');
const { requireUser } = require('../../lib/auth');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { country, stageId: stageIdRaw } = req.query;
    const config = getCountryConfig(country);
    if (!config) {
      return res.status(400).json({ error: 'Pais invalido' });
    }

    const auth = await requireUser(req, ['admin', 'supervisor']);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const stageId = stageIdRaw ? parseInt(stageIdRaw, 10) : config.defaultStageId;
    const deals = await listDealsByPipelineStage(config.pipelineId, stageId, 200);
    const dealIds = deals.map((d) => String(d.id));
    const reviewedSet = await getReviewedDealIds(dealIds, config.pipelineId, stageId);

    const queue = deals
      .filter((d) => !reviewedSet.has(String(d.id)))
      .map((d) => ({
        dealId: d.id,
        title: d.title,
        addTime: d.add_time,
        personId: d.person_id && typeof d.person_id === 'object' ? d.person_id.value : d.person_id
      }));

    const metrics = await getReviewMetrics(config.pipelineId, stageId, country);
    await upsertCampaignState({
      country,
      pipeline_id: config.pipelineId,
      stage_id: stageId,
      queue_total: deals.length,
      queue_pending: queue.length,
      reviewed_total: metrics.reviewed
    });

    res.status(200).json({
      country,
      pipelineId: config.pipelineId,
      stageId,
      queue,
      metrics,
      queueTotal: deals.length,
      queuePending: queue.length,
      reviewedBy: auth.user.email
    });
  } catch (error) {
    console.error('Error en review-queue:', error);
    res.status(500).json({ error: error.message });
  }
}
