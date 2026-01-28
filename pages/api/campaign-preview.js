const { listDealsByPipelineStageAll, getPersonById } = require('../../lib/pipedrive');
const { getCountryConfig, buildPhoneCandidates } = require('../../lib/review');
const { listCampaigns, listCampaignDealsByKeys } = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');

function parseAgeDays(addTime) {
  if (!addTime) return null;
  const dt = new Date(addTime);
  if (Number.isNaN(dt.getTime())) return null;
  const diffMs = Date.now() - dt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function extractPersonId(value) {
  if (!value) return null;
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  if (typeof value === 'object') {
    if (value.id !== undefined && value.id !== null) return String(value.id);
    if (value.value !== undefined && value.value !== null) return String(value.value);
  }
  return null;
}

function isContacted(row) {
  if (!row) return false;
  if (row.status === 'done') return true;
  return Boolean(row.last_outcome);
}

function extractOwnerId(deal) {
  if (!deal) return null;
  const candidate = deal.user_id || deal.owner_id;
  if (candidate && typeof candidate === 'object') {
    if (candidate.id !== undefined && candidate.id !== null) return String(candidate.id);
    if (candidate.value !== undefined && candidate.value !== null) return String(candidate.value);
  }
  if (candidate !== undefined && candidate !== null) return String(candidate);
  return null;
}

 
function getDealLabels(deal) {
  if (!deal) return [];
  const value = deal.label;
  if (value === null || value === undefined || value === '') return [];
  if (typeof value === 'number') return [String(value)];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}


const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getPersonWithRetry(personId, { retryDelayMs = 60000 } = {}) {
  try {
    return await getPersonById(personId);
  } catch (error) {
    if (error?.response?.status === 429) {
      await sleep(retryDelayMs);
      return getPersonById(personId);
    }
    throw error;
  }
}

async function fetchPersonsInBatches(personIds, { batchSize = 25, delayMs = 120 } = {}) {
  const result = new Map();
  for (let i = 0; i < personIds.length; i += batchSize) {
    const batch = personIds.slice(i, i + batchSize);
    for (const personId of batch) {
      if (!personId) continue;
      try {
        const person = await getPersonWithRetry(personId);
        result.set(personId, person);
      } catch (error) {
        if (error?.response?.status === 429) {
          throw new Error('Pipedrive rate limit. Espera 1-2 minutos e intenta de nuevo.');
        }
      }
      await sleep(delayMs);
    }
    await sleep(400);
  }
  return result;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      results.push(await mapper(current));
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { country, stageId: stageIdRaw, ownerIds, includeLabels, excludeLabels, email, idToken } = req.query;
    if (!country || !stageIdRaw || !email || !idToken) {
      return res.status(400).json({ error: 'country, stageId, email e idToken son requeridos' });
    }

    const auth = await requireUser({ email, idToken }, ['admin', 'supervisor']);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const config = getCountryConfig(country);
    if (!config) {
      return res.status(400).json({ error: 'Pais invalido' });
    }
    const stageId = parseInt(stageIdRaw, 10);
    const pipelineId = config.pipelineId;

    const includeLabelIds =
      typeof includeLabels === 'string' && includeLabels.length > 0
        ? includeLabels.split(',').map((id) => id.trim()).filter(Boolean)
        : [];
    const excludeLabelIds =
      typeof excludeLabels === 'string' && excludeLabels.length > 0
        ? excludeLabels.split(',').map((id) => id.trim()).filter(Boolean)
        : [];

    let deals = await listDealsByPipelineStageAll(pipelineId, stageId);
    if (includeLabelIds.length > 0 || excludeLabelIds.length > 0) {
      deals = deals.filter((deal) => {
        const labels = getDealLabels(deal);
        let allowed = includeLabelIds.length === 0 || includeLabelIds.some((id) => labels.includes(id));
        if (allowed && includeLabelIds.length === 1 && includeLabelIds[0] === '156') {
          allowed = labels.length === 1 && labels[0] === '156';
        }
        if (allowed && excludeLabelIds.length > 0) {
          allowed = !excludeLabelIds.some((id) => labels.includes(id));
        }
        return allowed;
      });
    }
    const ownerList =
      typeof ownerIds === 'string' && ownerIds.length > 0 ? ownerIds.split(',').map((id) => id.trim()) : [];
    if (ownerList.length > 0) {
      deals = deals.filter((deal) => ownerList.includes(extractOwnerId(deal)));
    }

    const activeCampaigns = await listCampaigns({ country, status: 'active' });
    const activeKeys = activeCampaigns.map((c) => c.campaign_key);
    const activeDeals = await listCampaignDealsByKeys(activeKeys);
    const activeMap = new Map();
    activeDeals.forEach((row) => {
      activeMap.set(String(row.deal_id), row);
    });

    const uniquePersonIds = Array.from(
      new Set(
        deals
          .map((deal) => extractPersonId(deal.person_id))
          .filter(Boolean)
          .map(String)
      )
    );
    const personCache = await fetchPersonsInBatches(uniquePersonIds, { batchSize: 25, delayMs: 120 });

    const evaluations = await mapWithConcurrency(deals, 2, async (deal) => {
      const personId = extractPersonId(deal.person_id);
      const person = personId ? personCache.get(String(personId)) : null;
      const candidates = buildPhoneCandidates(person, country);
      const validCount = candidates.candidates.length;
      const ageDays = parseAgeDays(deal.add_time);
      const activeRow = activeMap.get(String(deal.id));
      const blocked = activeRow && !isContacted(activeRow);
      return {
        validCount,
        ageDays,
        blocked
      };
    });

    let total = 0;
    let withOne = 0;
    let withTwo = 0;
    let withoutValid = 0;
    let ready = 0;
    let blockedActive = 0;
    const ageBuckets = {
      lt7: 0,
      gt7: 0,
      lt15: 0,
      gt15: 0,
      lt30: 0,
      gt30: 0
    };

    evaluations.forEach((row) => {
      total += 1;
      if (row.validCount >= 2) {
        withTwo += 1;
      } else if (row.validCount === 1) {
        withOne += 1;
      } else {
        withoutValid += 1;
      }
      if (row.validCount >= 1 && !row.blocked) {
        ready += 1;
      }
      if (row.blocked) {
        blockedActive += 1;
      }
      if (row.ageDays !== null) {
        if (row.ageDays < 7) ageBuckets.lt7 += 1;
        if (row.ageDays >= 7 && row.ageDays <= 15) ageBuckets.gt7 += 1;
        if (row.ageDays < 15) ageBuckets.lt15 += 1;
        if (row.ageDays > 15) ageBuckets.gt15 += 1;
        if (row.ageDays < 30) ageBuckets.lt30 += 1;
        if (row.ageDays > 30) ageBuckets.gt30 += 1;
      }
    });

    res.status(200).json({
      total,
      withOne,
      withTwo,
      withoutValid,
      ready,
      blockedActive,
      ageBuckets
    });
  } catch (error) {
    console.error('Error en campaign-preview:', error);
    res.status(500).json({ error: error.message });
  }
}
