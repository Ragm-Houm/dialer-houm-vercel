const { listStages } = require('../../lib/pipedrive');
const { getCountryConfig } = require('../../lib/review');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { country, debug } = req.query;
    const config = getCountryConfig(country);
    if (!config) {
      return res.status(400).json({ error: 'Pais invalido' });
    }

    const stages = await listStages(config.pipelineId);
    const result = {
      country,
      pipelineId: config.pipelineId,
      defaultStageId: config.defaultStageId,
      stages: stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        pipelineId: stage.pipeline_id
      }))
    };

    if (debug === 'true') {
      result._debug = {
        rawStagesCount: stages.length,
        hasDomain: !!process.env.PIPEDRIVE_DOMAIN,
        hasToken: !!process.env.PIPEDRIVE_API_TOKEN,
        tokenLen: (process.env.PIPEDRIVE_API_TOKEN || '').length,
        domainVal: (process.env.PIPEDRIVE_DOMAIN || '').slice(0, 15) + '...'
      };
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Error en review-stages:', error);
    res.status(500).json({ error: error.message });
  }
}
