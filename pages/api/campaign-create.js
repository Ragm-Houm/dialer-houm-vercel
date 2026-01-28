const { listDealsByPipelineStageAll, getPersonById } = require('../../lib/pipedrive');
const { getCountryConfig, buildPhoneCandidates } = require('../../lib/review');
const {
  listCampaigns,
  listCampaignDealsByKeys,
  createCampaign,
  upsertCampaignDeals
} = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');
const { requireCsrf } = require('../../lib/csrf');
const { requireRateLimit } = require('../../lib/rate-limit');

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


function matchesAgeFilter(ageDays, filter) {
  if (ageDays === null) return false;
  switch (filter) {
    case 'all':
      return true;
    case 'lt7':
      return ageDays < 7;
    case 'between7_15':
      return ageDays >= 7 && ageDays <= 15;
    case 'between15_30':
      return ageDays > 15 && ageDays <= 30;
    case 'gt30':
      return ageDays > 30;
    default:
      return true;
  }
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting estricto para creación de campañas
  if (!requireRateLimit(req, res, 'strict')) {
    return;
  }

  // Validar CSRF token
  if (!requireCsrf(req, res)) {
    return;
  }

  try {
    const {
      country,
      stageId: stageIdRaw,
      stageName,
      ageFilter,
      ownerIds,
      includeLabels,
      excludeLabels,
      campaignName,
      source,
      manualRows,
      closeAt,
      closeTz,
      noTimeLimit,
      allowAllExecs,
      allowedExecs,
      email,
      idToken
    } = req.body || {};
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

    const activeCampaigns = await listCampaigns({ country, status: 'active' });
    const activeKeys = activeCampaigns.map((c) => c.campaign_key);
    const activeDeals = await listCampaignDealsByKeys(activeKeys);
    const activeMap = new Map();
    activeDeals.forEach((row) => {
      activeMap.set(String(row.deal_id), row);
    });

    const sourceMode = source === 'manual' ? 'manual' : 'auto';
    let evaluated = [];
    if (sourceMode === 'manual') {
      if (!Array.isArray(manualRows) || manualRows.length === 0) {
        return res.status(400).json({ error: 'No se recibieron filas del archivo.' });
      }
      const normalizedRows = manualRows
        .map((row) => ({
          country: String(row.country || country || '').toUpperCase().trim(),
          pipeline_id: row.pipeline_id ? String(row.pipeline_id).trim() : '',
          stage_id: row.stage_id ? String(row.stage_id).trim() : '',
          stage_name: row.stage_name ? String(row.stage_name).trim() : '',
          deal_id: row.deal_id ? String(row.deal_id).trim() : '',
          deal_title: row.deal_title ? String(row.deal_title).trim() : '',
          phone_primary: row.phone_primary ? String(row.phone_primary).trim() : '',
          phone_secondary: row.phone_secondary ? String(row.phone_secondary).trim() : '',
          add_time: row.add_time
        }))
        .filter((row) => row.deal_id);

      const filteredRows = normalizedRows.filter(
        (row) =>
          (!row.country || row.country === country) &&
          String(row.pipeline_id) === String(pipelineId) &&
          String(row.stage_id) === String(stageId)
      );

      evaluated = filteredRows.map((row) => {
        const ageDays = parseAgeDays(row.add_time);
        const phoneInputs = [row.phone_primary, row.phone_secondary].filter(Boolean);
        const person = {
          phone: phoneInputs.map((value) => ({ value }))
        };
        const candidates = buildPhoneCandidates(person, country);
        const validCount = candidates.candidates.length;
        const activeRow = activeMap.get(String(row.deal_id));
        const blocked = activeRow && !isContacted(activeRow);
        return {
          deal: {
            id: row.deal_id,
            title: row.deal_title,
            add_time: row.add_time
          },
          ageDays,
          candidates,
          validCount,
          blocked
        };
      });
    } else {
      const includeLabelIds = Array.isArray(includeLabels)
        ? includeLabels.map((id) => String(id).trim()).filter(Boolean)
        : [];
      const excludeLabelIds = Array.isArray(excludeLabels)
        ? excludeLabels.map((id) => String(id).trim()).filter(Boolean)
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
      if (Array.isArray(ownerIds) && ownerIds.length > 0) {
        deals = deals.filter((deal) => ownerIds.includes(extractOwnerId(deal)));
      }

      const uniquePersonIds = Array.from(
        new Set(
          deals
            .map((deal) => extractPersonId(deal.person_id))
            .filter(Boolean)
            .map(String)
        )
      );
      const personCache = await fetchPersonsInBatches(uniquePersonIds, { batchSize: 25, delayMs: 120 });

      evaluated = await mapWithConcurrency(deals, 2, async (deal) => {
        const ageDays = parseAgeDays(deal.add_time);
        const personId = extractPersonId(deal.person_id);
        const person = personId ? personCache.get(String(personId)) : null;
        const candidates = buildPhoneCandidates(person, country);
        const validCount = candidates.candidates.length;
        const activeRow = activeMap.get(String(deal.id));
        const blocked = activeRow && !isContacted(activeRow);
        return {
          deal,
          ageDays,
          candidates,
          validCount,
          blocked
        };
      });
    }

    const validDeals = evaluated.filter((row) => row.validCount > 0);
    const eligibleDeals = validDeals.filter((row) => !row.blocked);
    const filteredDeals = eligibleDeals.filter((row) => matchesAgeFilter(row.ageDays, ageFilter));

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    const suffix = today.getTime().toString(36).slice(-4);
    const campaignKey = `${country}-${pipelineId}-${stageId}-${dateStr.replace(/-/g, '')}-${suffix}`;
    const safeStageName = stageName || `Etapa ${stageId}`;
    const safeCustom = campaignName ? String(campaignName).trim() : '';
    const prefix = safeCustom ? `${safeCustom} - ` : '';
    const name = `${prefix}${country}-${safeStageName}-${dateStr}`;

    const rows = filteredDeals.map((row) => ({
      campaign_key: campaignKey,
      country,
      pipeline_id: pipelineId,
      stage_id: stageId,
      stage_name: safeStageName,
      deal_id: row.deal.id,
      deal_title: row.deal.title,
      sort_time: row.deal.add_time || null,
      status: 'pending',
      phone_primary: row.candidates.primaryCandidate || null,
      phone_secondary: row.candidates.secondaryCandidate || null,
      has_valid_phone: row.validCount > 0
    }));

    await createCampaign({
      campaign_key: campaignKey,
      name,
      country,
      pipeline_id: pipelineId,
      stage_id: stageId,
      stage_name: safeStageName,
      age_filter: ageFilter || null,
      close_at: noTimeLimit ? null : closeAt || null,
      close_tz: noTimeLimit ? null : closeTz || null,
      no_time_limit: Boolean(noTimeLimit),
      allow_all_execs: allowAllExecs !== undefined ? Boolean(allowAllExecs) : true,
      allowed_execs: allowAllExecs ? null : allowedExecs || [],
      created_by: auth.user.email,
      total_leads: filteredDeals.length,
      valid_leads: filteredDeals.length,
      status: 'active'
    });

    if (rows.length > 0) {
      await upsertCampaignDeals(rows);
    }

    res.status(200).json({
      ok: true,
      campaignKey,
      name,
      totalLeads: filteredDeals.length,
      validLeads: filteredDeals.length
    });
  } catch (error) {
    console.error('Error en campaign-create:', error);
    // No exponemos detalles internos del error al cliente
    const safeMessage = error.message?.includes('rate limit')
      ? error.message
      : 'Error interno al crear la campaña';
    res.status(500).json({ error: safeMessage });
  }
}
