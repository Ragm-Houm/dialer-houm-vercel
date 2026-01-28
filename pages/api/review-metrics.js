const { getReviewMetrics, getCampaignState } = require('../../lib/supabase');
const { getCountryConfig } = require('../../lib/review');

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
    const stageId = stageIdRaw ? parseInt(stageIdRaw, 10) : config.defaultStageId;

    const metrics = await getReviewMetrics(config.pipelineId, stageId, country);
    const state = await getCampaignState(config.pipelineId, stageId, country);

    res.status(200).json({
      country,
      pipelineId: config.pipelineId,
      stageId,
      metrics,
      state
    });
  } catch (error) {
    console.error('Error en review-metrics:', error);
    res.status(500).json({ error: error.message });
  }
}
