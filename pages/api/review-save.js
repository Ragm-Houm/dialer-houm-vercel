const {
  upsertPhoneReview,
  insertReviewEvent,
  upsertCampaignState,
  getReviewMetrics,
  markCampaignDealDone
} = require('../../lib/supabase');
const { getCountryConfig, buildCampaignKey } = require('../../lib/review');
const { requireUser } = require('../../lib/auth');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      country,
      dealId,
      personId,
      dealTitle,
      personName,
      stageName,
      candidates,
      selectedPrimary,
      selectedSecondary,
      skipped,
      stageId: stageIdRaw,
      notes,
      stats
    } = req.body || {};

    const config = getCountryConfig(country);
    if (!config || !dealId) {
      return res.status(400).json({ error: 'Pais y dealId son requeridos' });
    }
    const auth = await requireUser(req, ['admin', 'supervisor']);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const stageId = stageIdRaw ? parseInt(stageIdRaw, 10) : config.defaultStageId;
    const campaignKey = buildCampaignKey(country, config.pipelineId, stageId);

    const record = await upsertPhoneReview({
      country,
      pipeline_id: config.pipelineId,
      stage_id: stageId,
      deal_id: Number(dealId),
      person_id: personId ? Number(personId) : null,
      reviewed_by: auth.user.email,
      deal_title: dealTitle || '',
      person_name: personName || '',
      stage_name: stageName || '',
      candidates: candidates || [],
      selected_primary: selectedPrimary || '',
      selected_secondary: selectedSecondary || '',
      notes: notes || '',
      stats: stats || {},
      skipped: skipped === true
    });

    insertReviewEvent({
      event_type: skipped ? 'deal_skipped' : 'review_saved',
      country,
      pipeline_id: config.pipelineId,
      stage_id: stageId,
      deal_id: Number(dealId),
      reviewed_by: auth.user.email,
      payload: {
        selectedPrimary: selectedPrimary || '',
        selectedSecondary: selectedSecondary || '',
        notes: notes || '',
        skipped: skipped === true
      }
    });

    const metrics = await getReviewMetrics(config.pipelineId, stageId, country);
    await upsertCampaignState({
      country,
      pipeline_id: config.pipelineId,
      stage_id: stageId,
      reviewed_total: metrics.reviewed
    });

    await markCampaignDealDone(
      campaignKey,
      Number(dealId),
      skipped ? 'skipped' : 'reviewed',
      auth.user.email
    );

    res.status(200).json({ ok: true, record });
  } catch (error) {
    console.error('Error en review-save:', error);
    res.status(500).json({ error: error.message });
  }
}
