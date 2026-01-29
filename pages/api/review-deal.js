const { getDealContext } = require('../../lib/pipedrive');
const { insertReviewEvent } = require('../../lib/supabase');
const { getCountryConfig, buildPhoneCandidates } = require('../../lib/review');
const { requireUser } = require('../../lib/auth');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { dealId, country, stageId: stageIdRaw } = req.query;
    const config = getCountryConfig(country);
    if (!dealId || !config) {
      return res.status(400).json({ error: 'dealId y pais son requeridos' });
    }

    const auth = await requireUser(req, ['admin', 'supervisor']);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const stageId = stageIdRaw ? parseInt(stageIdRaw, 10) : config.defaultStageId;

    const pipedrive = await getDealContext(dealId);
    if (!pipedrive || !pipedrive.deal) {
      return res.status(404).json({ error: 'Deal no encontrado' });
    }

    const candidates = buildPhoneCandidates(pipedrive.person, country);

    insertReviewEvent({
      event_type: 'deal_loaded',
      country,
      pipeline_id: config.pipelineId,
      stage_id: stageId,
      deal_id: Number(dealId),
      reviewed_by: auth.user.email,
      payload: { candidates: candidates.candidates, stats: candidates.stats || {} }
    });

    res.status(200).json({
      country,
      pipelineId: config.pipelineId,
      stageId,
      deal: pipedrive.deal,
      person: pipedrive.person,
      stageName: pipedrive.stageName,
      ownerName: pipedrive.ownerName,
      candidates
    });
  } catch (error) {
    console.error('Error en review-deal:', error);
    res.status(500).json({ error: error.message });
  }
}
