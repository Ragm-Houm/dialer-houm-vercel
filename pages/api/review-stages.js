const axios = require('axios');
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

    const token = process.env.PIPEDRIVE_API_TOKEN;
    const domain = process.env.PIPEDRIVE_DOMAIN;
    const url = `https://${domain}/api/v1/stages?pipeline_id=${config.pipelineId}&api_token=${encodeURIComponent(token || '')}`;

    let rawResponse = null;
    let rawStatus = null;
    let rawError = null;

    try {
      const response = await axios.get(url, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true
      });
      rawStatus = response.status;
      rawResponse = response.data;
    } catch (axErr) {
      rawError = axErr.message;
    }

    const stages = (rawResponse && rawResponse.success && rawResponse.data) ? rawResponse.data : [];

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
        httpStatus: rawStatus,
        apiSuccess: rawResponse?.success,
        apiError: rawResponse?.error || rawError || null,
        apiErrorInfo: rawResponse?.error_info || null,
        tokenLen: (token || '').length,
        domainVal: (domain || '').slice(0, 20),
        urlUsed: url.replace(token || '', '***')
      };
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Error en review-stages:', error);
    res.status(500).json({ error: error.message });
  }
}
