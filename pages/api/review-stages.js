const { listStages } = require('../../lib/pipedrive');
const { getCountryConfig } = require('../../lib/review');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { country } = req.query;
    const config = getCountryConfig(country);
    if (!config) {
      return res.status(400).json({ error: 'Pais invalido' });
    }

    const stages = await listStages(config.pipelineId);
    res.status(200).json({
      country,
      pipelineId: config.pipelineId,
      defaultStageId: config.defaultStageId,
      stages: stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        pipelineId: stage.pipeline_id
      }))
    });
  } catch (error) {
    console.error('Error en review-stages:', error);
    res.status(500).json({ error: error.message });
  }
}
