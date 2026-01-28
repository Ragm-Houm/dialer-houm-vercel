const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client = null;
const VALID_COUNTRIES = new Set(['CO', 'MX', 'CL']);
const COUNTRY_ALIASES = {
  COLOMBIA: 'CO',
  MEXICO: 'MX',
  CHILE: 'CL'
};

function getClient() {
  if (client) return client;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase configuration');
  }
  client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
  return client;
}

function normalizeCountry(country) {
  const raw = String(country || '').trim();
  if (!raw) return '';
  const value = raw.toUpperCase();
  if (VALID_COUNTRIES.has(value)) return value;

  // Normalize common text variants like "colombia" or "mexico"
  const compact = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, '');
  if (VALID_COUNTRIES.has(compact)) return compact;
  return COUNTRY_ALIASES[compact] || '';
}

async function getEjecutivoInfo(email) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('executives')
      .select('ejecutivo_email, telefono_ejecutivo_e164, caller_id_asignado, activo')
      .eq('ejecutivo_email', email)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) return null;

    return {
      email: data.ejecutivo_email,
      telefono: data.telefono_ejecutivo_e164,
      callerId: data.caller_id_asignado,
      activo: data.activo === true
    };
  } catch (error) {
    console.error('Error obteniendo ejecutivo en Supabase:', error.message);
    throw error;
  }
}

async function getUserByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  try {
    const supabase = getClient();

    // Primary source of truth for roles
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('email, role, country, activo')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (userError) throw userError;
    if (userRow) {
      return {
        email: userRow.email,
        role: userRow.role || 'ejecutivo',
        country: normalizeCountry(userRow.country),
        activo: userRow.activo === true
      };
    }

    // Backward compatibility with existing executives table
    const ejecutivo = await getEjecutivoInfo(normalizedEmail);
    if (!ejecutivo || !ejecutivo.activo) return null;

    return {
      email: ejecutivo.email,
      role: 'ejecutivo',
      country: '',
      activo: true,
      callerId: ejecutivo.callerId,
      telefono: ejecutivo.telefono
    };
  } catch (error) {
    console.error('Error obteniendo usuario en Supabase:', error.message);
    throw error;
  }
}

async function getSiguienteLead(pais) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('leads')
      .select('lead_id_interno, nombre, telefono_e164, pipedrive_deal_id, intentos, estado, pais')
      .eq('pais', pais)
      .or('estado.is.null,estado.eq.,estado.ilike.PENDIENTE')
      .order('intentos', { ascending: true, nullsFirst: true })
      .order('updated_at', { ascending: true, nullsFirst: true })
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) return null;

    return {
      leadId: data.lead_id_interno,
      nombre: data.nombre,
      telefono: data.telefono_e164,
      pipedriveDealId: data.pipedrive_deal_id,
      intentos: data.intentos || 0
    };
  } catch (error) {
    console.error('Error obteniendo siguiente lead en Supabase:', error.message);
    throw error;
  }
}

async function upsertCampaignDeals(rows) {
  if (!rows || rows.length === 0) return;
  try {
    const supabase = getClient();
    const payload = rows.map((row) => ({
      ...row,
      updated_at: new Date().toISOString()
    }));
    const { error } = await supabase.from('campaign_deals').upsert(payload, {
      onConflict: 'deal_id,pipeline_id,stage_id'
    });
    if (error) throw error;
  } catch (error) {
    console.error('Error sembrando campaign deals:', error.message);
    throw error;
  }
}

async function claimNextDeal(campaignKey, userEmail, lockMinutes = 10, options = {}) {
  try {
    const supabase = getClient();
    const maxAttempts = Number.isFinite(options.maxAttempts) ? options.maxAttempts : 3;
    const minHoursBetweenAttempts = Number.isFinite(options.minHoursBetweenAttempts)
      ? options.minHoursBetweenAttempts
      : 24;
    const maxGestions = Number.isFinite(options.maxGestions) ? options.maxGestions : 5;
    const { data, error } = await supabase.rpc('claim_next_deal', {
      p_campaign_key: campaignKey,
      p_user_email: userEmail,
      p_lock_minutes: lockMinutes,
      p_max_attempts: maxAttempts,
      p_min_hours_between_attempts: minHoursBetweenAttempts,
      p_max_gestions: maxGestions
    });
    if (error) throw error;
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error haciendo claim del siguiente deal:', error.message);
    throw error;
  }
}

async function incrementDealGestion(campaignKey, dealId, userEmail) {
  try {
    const supabase = getClient();
    const { error } = await supabase.rpc('increment_campaign_gestion', {
      p_campaign_key: campaignKey,
      p_deal_id: dealId,
      p_user_email: userEmail
    });
    if (error) throw error;
  } catch (error) {
    console.error('Error incrementando gestion del deal:', error.message);
    throw error;
  }
}

async function releaseDealLock(campaignKey, dealId, userEmail) {
  try {
    const supabase = getClient();
    const { error } = await supabase.rpc('release_deal_lock', {
      p_campaign_key: campaignKey,
      p_deal_id: dealId,
      p_user_email: userEmail
    });
    if (error) throw error;
  } catch (error) {
    console.error('Error liberando lock del deal:', error.message);
    throw error;
  }
}

async function markCampaignDealDone(campaignKey, dealId, outcome, userEmail) {
  try {
    const supabase = getClient();
    const { error } = await supabase
      .from('campaign_deals')
      .update({
        status: 'done',
        last_outcome: outcome || null,
        completed_at: new Date().toISOString(),
        assigned_to: userEmail,
        lock_expires_at: null,
        next_attempt_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('campaign_key', campaignKey)
      .eq('deal_id', dealId);
    if (error) throw error;
  } catch (error) {
    console.error('Error marcando deal como done:', error.message);
    throw error;
  }
}

async function updateCampaignDealOutcome(campaignKey, dealId, outcome, status, userEmail, options = {}) {
  try {
    const supabase = getClient();
    const now = new Date().toISOString();
    const payload = {
      status: status === 'done' ? 'done' : 'pending',
      last_outcome: outcome || null,
      updated_at: now
    };
    if (status === 'done') {
      payload.completed_at = now;
      payload.lock_expires_at = null;
      payload.assigned_to = userEmail || null;
      payload.next_attempt_at = null;
    } else {
      payload.completed_at = null;
      payload.lock_expires_at = new Date(Date.now() - 1000).toISOString();
      payload.assigned_to = null;
      payload.next_attempt_at = options.nextAttemptAt || null;
    }

    const { error } = await supabase
      .from('campaign_deals')
      .update(payload)
      .eq('campaign_key', campaignKey)
      .eq('deal_id', dealId);
    if (error) throw error;
  } catch (error) {
    console.error('Error actualizando outcome del deal:', error.message);
    throw error;
  }
}

async function getCampaignDealByKey(campaignKey, dealId) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('campaign_deals')
      .select('deal_id,status,attempts,last_attempt_at,last_outcome,lock_expires_at,gestions,next_attempt_at')
      .eq('campaign_key', campaignKey)
      .eq('deal_id', dealId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (error) {
    console.error('Error obteniendo campaign_deal:', error.message);
    throw error;
  }
}

async function markCampaignDealsDoneBulk(campaignKey, dealIds) {
  if (!dealIds || dealIds.length === 0) return;
  try {
    const supabase = getClient();
    const { error } = await supabase
      .from('campaign_deals')
      .update({
        status: 'done',
        lock_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('campaign_key', campaignKey)
      .in('deal_id', dealIds);
    if (error) throw error;
  } catch (error) {
    console.error('Error marcando deals done (bulk):', error.message);
  }
}

async function startCampaignSession(campaignKey, userEmail) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('campaign_sessions')
      .insert({
        campaign_key: campaignKey,
        user_email: userEmail,
        status: 'active',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();
    if (error) throw error;
    return data?.id || null;
  } catch (error) {
    console.error('Error iniciando sesion de campaña:', error.message);
    throw error;
  }
}

async function endCampaignSession(sessionId, payload) {
  try {
    const supabase = getClient();
    const update = {
      ended_at: new Date().toISOString(),
      status: payload?.status || 'closed',
      active_seconds: payload?.active_seconds || 0,
      call_seconds: payload?.call_seconds || 0,
      idle_seconds: payload?.idle_seconds || 0,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('campaign_sessions').update(update).eq('id', sessionId);
    if (error) throw error;
  } catch (error) {
    console.error('Error cerrando sesion de campaña:', error.message);
    throw error;
  }
}

async function insertCampaignEvent(event) {
  try {
    const supabase = getClient();
    const payload = {
      campaign_key: event.campaign_key,
      deal_id: event.deal_id || null,
      user_email: event.user_email,
      event_type: event.event_type,
      metadata: event.metadata || {},
      created_at: new Date().toISOString()
    };
    const { error } = await supabase.from('campaign_events').insert(payload);
    if (error) throw error;
  } catch (error) {
    console.error('Error guardando evento de campaña:', error.message);
    throw error;
  }
}

async function incrementDealAttempt(campaignKey, dealId, userEmail) {
  try {
    const supabase = getClient();
    const { error } = await supabase.rpc('increment_campaign_attempt', {
      p_campaign_key: campaignKey,
      p_deal_id: dealId,
      p_user_email: userEmail
    });
    if (error) throw error;
  } catch (error) {
    console.error('Error incrementando intento:', error.message);
    throw error;
  }
}

async function createCampaign(payload) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        campaign_key: payload.campaign_key,
        name: payload.name,
        country: payload.country,
        pipeline_id: payload.pipeline_id,
        stage_id: payload.stage_id,
        stage_name: payload.stage_name || null,
        age_filter: payload.age_filter || null,
        close_at: payload.close_at || null,
        close_tz: payload.close_tz || null,
        no_time_limit: Boolean(payload.no_time_limit),
        allow_all_execs: payload.allow_all_execs !== undefined ? Boolean(payload.allow_all_execs) : true,
        allowed_execs: payload.allowed_execs || null,
        status: payload.status || 'active',
        created_by: payload.created_by || null,
        total_leads: payload.total_leads || 0,
        valid_leads: payload.valid_leads || 0,
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creando campaign:', error.message);
    throw error;
  }
}

async function listCampaigns({ country, status } = {}) {
  try {
    const supabase = getClient();
    let query = supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    if (country) query = query.eq('country', country);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error listando campaigns:', error.message);
    throw error;
  }
}

async function getCampaignByKey(campaignKey) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('campaign_key', campaignKey)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (error) {
    console.error('Error obteniendo campaign:', error.message);
    throw error;
  }
}

async function updateCampaignStatus(campaignKey, status, updates = {}) {
  try {
    const supabase = getClient();
    const payload = { status, updated_at: new Date().toISOString() };
    if (updates.close_at !== undefined) payload.close_at = updates.close_at;
    if (updates.close_tz !== undefined) payload.close_tz = updates.close_tz;
    if (updates.no_time_limit !== undefined) payload.no_time_limit = updates.no_time_limit;
    const { data, error } = await supabase
      .from('campaigns')
      .update(payload)
      .eq('campaign_key', campaignKey)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (error) {
    console.error('Error actualizando campaign:', error.message);
    throw error;
  }
}

async function deleteCampaignByKey(campaignKey) {
  try {
    const supabase = getClient();
    await supabase.from('campaign_events').delete().eq('campaign_key', campaignKey);
    await supabase.from('campaign_sessions').delete().eq('campaign_key', campaignKey);
    await supabase.from('campaign_deals').delete().eq('campaign_key', campaignKey);
    const { data, error } = await supabase
      .from('campaigns')
      .delete()
      .eq('campaign_key', campaignKey)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (error) {
    console.error('Error eliminando campaign:', error.message);
    throw error;
  }
}

async function listCampaignDealsByKeys(campaignKeys) {
  if (!campaignKeys || campaignKeys.length === 0) return [];
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('campaign_deals')
      .select('campaign_key,deal_id,status,last_outcome,completed_at')
      .in('campaign_key', campaignKeys);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error listando campaign_deals por key:', error.message);
    throw error;
  }
}

async function countCampaignPending(campaignKey) {
  try {
    const supabase = getClient();
    const { count, error } = await supabase
      .from('campaign_deals')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_key', campaignKey)
      .neq('status', 'done');
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error contando pendientes de campana:', error.message);
    throw error;
  }
}

async function getCampaignAvailability(campaignKey, maxAttempts = 3, minHoursBetweenAttempts = 24, maxGestions = 5) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('campaign_deals')
      .select('status,has_valid_phone,attempts,gestions,last_attempt_at,next_attempt_at,lock_expires_at')
      .eq('campaign_key', campaignKey);
    if (error) throw error;

    const now = Date.now();
    const cooldownMs = Math.max(0, minHoursBetweenAttempts) * 60 * 60 * 1000;
    const stats = {
      totalPending: 0,
      noPhone: 0,
      maxAttempts: 0,
      maxGestions: 0,
      cooldown: 0,
      locked: 0,
      eligible: 0,
      nextRetryAt: null
    };

    (data || []).forEach((row) => {
      if (row.status === 'done') return;
      stats.totalPending += 1;

      if (row.has_valid_phone === false) {
        stats.noPhone += 1;
        return;
      }

      if ((row.attempts || 0) >= Math.max(1, maxAttempts)) {
        stats.maxAttempts += 1;
        return;
      }

      if ((row.gestions || 0) >= Math.max(1, maxGestions)) {
        stats.maxGestions += 1;
        return;
      }

      if (row.next_attempt_at) {
        const nextAttempt = new Date(row.next_attempt_at).getTime();
        if (nextAttempt > now) {
          stats.cooldown += 1;
          if (!stats.nextRetryAt || nextAttempt < stats.nextRetryAt) {
            stats.nextRetryAt = nextAttempt;
          }
          return;
        }
      }

      if (row.last_attempt_at) {
        const lastAttempt = new Date(row.last_attempt_at).getTime();
        if (cooldownMs > 0 && lastAttempt + cooldownMs > now) {
          stats.cooldown += 1;
          const retryAt = lastAttempt + cooldownMs;
          if (!stats.nextRetryAt || retryAt < stats.nextRetryAt) {
            stats.nextRetryAt = retryAt;
          }
          return;
        }
      }

      if (row.lock_expires_at) {
        const lockUntil = new Date(row.lock_expires_at).getTime();
        if (lockUntil > now) {
          stats.locked += 1;
          return;
        }
      }

      stats.eligible += 1;
    });

    if (stats.nextRetryAt) {
      stats.nextRetryAt = new Date(stats.nextRetryAt).toISOString();
    }

    return stats;
  } catch (error) {
    console.error('Error obteniendo disponibilidad de campaña:', error.message);
    throw error;
  }
}

async function getReviewedDealIds(dealIds, pipelineId, stageId) {
  if (!dealIds || dealIds.length === 0) return new Set();
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('phone_review')
      .select('deal_id')
      .eq('pipeline_id', pipelineId)
      .eq('stage_id', stageId)
      .in('deal_id', dealIds);

    if (error) {
      throw error;
    }
    return new Set((data || []).map((row) => String(row.deal_id)));
  } catch (error) {
    console.error('Error obteniendo deals revisados:', error.message);
    throw error;
  }
}

async function listCampaignDeals(limit = 2000) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('campaign_deals')
      .select(
        'campaign_key,country,pipeline_id,stage_id,deal_id,status,assigned_to,last_outcome,completed_at,updated_at,sort_time,attempts,gestions,last_gestion_at,last_attempt_at'
      )
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error listando campaign_deals:', error.message);
    throw error;
  }
}

async function listCampaignEvents(limit = 5000) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('campaign_events')
      .select('campaign_key,deal_id,user_email,event_type,metadata,created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error listando campaign_events:', error.message);
    throw error;
  }
}

async function listCampaignSessions(limit = 2000) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('campaign_sessions')
      .select('campaign_key,user_email,status,active_seconds,call_seconds,idle_seconds,started_at,ended_at')
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error listando campaign_sessions:', error.message);
    throw error;
  }
}

async function listPhoneReviews(limit = 4000) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('phone_review')
      .select(
        'country,pipeline_id,stage_id,deal_id,reviewed_by,skipped,selected_primary,selected_secondary,stats,reviewed_at,updated_at'
      )
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error listando phone_review:', error.message);
    throw error;
  }
}

async function listUsers(limit = 200) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('users')
      .select('email, role, country, activo, updated_at, created_at')
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error listando users:', error.message);
    throw error;
  }
}

async function upsertUser({ email, role, country, activo }) {
  try {
    const supabase = getClient();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error('Email es requerido');
    }
    const normalizedCountry = normalizeCountry(country);
    if (!normalizedCountry) {
      throw new Error('Country invalido (usa CO, MX o CL)');
    }
    const payload = {
      email: normalizedEmail,
      role: role || 'ejecutivo',
      country: normalizedCountry,
      activo: activo === false ? false : true,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase
      .from('users')
      .upsert(payload, { onConflict: 'email' })
      .select('email, role, country, activo')
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error guardando user:', error.message);
    throw error;
  }
}

async function upsertPhoneReview(record) {
  try {
    const supabase = getClient();
    const payload = {
      ...record,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase
      .from('phone_review')
      .upsert(payload, { onConflict: 'deal_id,pipeline_id,stage_id' })
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error guardando phone review:', error.message);
    throw error;
  }
}

async function insertReviewEvent(event) {
  try {
    const supabase = getClient();
    const payload = {
      ...event,
      created_at: new Date().toISOString()
    };
    const { error } = await supabase.from('review_events').insert(payload);
    if (error) throw error;
  } catch (error) {
    console.error('Error guardando review event:', error.message);
  }
}

async function upsertCampaignState(state) {
  try {
    const supabase = getClient();
    const payload = {
      ...state,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase
      .from('review_campaign_state')
      .upsert(payload, { onConflict: 'country,pipeline_id,stage_id' });
    if (error) throw error;
  } catch (error) {
    console.error('Error guardando estado de campana:', error.message);
  }
}

async function getReviewMetrics(pipelineId, stageId, country) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('phone_review')
      .select('deal_id, skipped, selected_primary, selected_secondary', { count: 'exact', head: false })
      .eq('pipeline_id', pipelineId)
      .eq('stage_id', stageId)
      .eq('country', country);

    if (error) throw error;

    const rows = data || [];
    const reviewed = rows.length;
    const skipped = rows.filter((r) => r.skipped).length;
    const withSelection = rows.filter((r) => r.selected_primary || r.selected_secondary).length;

    return { reviewed, skipped, withSelection };
  } catch (error) {
    console.error('Error obteniendo metricas review:', error.message);
    return { reviewed: 0, skipped: 0, withSelection: 0 };
  }
}

async function getCampaignState(pipelineId, stageId, country) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('review_campaign_state')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .eq('stage_id', stageId)
      .eq('country', country)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (error) {
    console.error('Error obteniendo estado de campana:', error.message);
    return null;
  }
}

async function listCallOutcomes() {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('call_outcomes')
      .select('id,key,label,activo,outcome_type,metric_bucket,sort_order')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error listando outcomes:', error.message);
    throw error;
  }
}

async function createCallOutcome(payload) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('call_outcomes')
      .insert({
        key: payload.key,
        label: payload.label,
        activo: payload.activo !== false,
        outcome_type: payload.outcome_type || 'final',
        metric_bucket: payload.metric_bucket || 'otro',
        sort_order: payload.sort_order || 0,
        updated_at: new Date().toISOString()
      })
      .select('id,key,label,activo,outcome_type,metric_bucket,sort_order')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creando outcome:', error.message);
    throw error;
  }
}

async function updateCallOutcome(outcomeId, updates) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('call_outcomes')
      .update({
        label: updates.label,
        outcome_type: updates.outcome_type,
        metric_bucket: updates.metric_bucket,
        sort_order: updates.sort_order,
        activo: updates.activo,
        updated_at: new Date().toISOString()
      })
      .eq('id', outcomeId)
      .select('id,key,label,activo,outcome_type,metric_bucket,sort_order')
      .single();
    if (error) throw error;
    return data || null;
  } catch (error) {
    console.error('Error actualizando outcome:', error.message);
    throw error;
  }
}

async function deleteCallOutcome(outcomeId) {
  try {
    const supabase = getClient();
    const { error } = await supabase.from('call_outcomes').delete().eq('id', outcomeId);
    if (error) throw error;
  } catch (error) {
    console.error('Error eliminando outcome:', error.message);
    throw error;
  }
}

module.exports = {
  getEjecutivoInfo,
  getUserByEmail,
  getSiguienteLead,
  upsertCampaignDeals,
  claimNextDeal,
  releaseDealLock,
  markCampaignDealDone,
  updateCampaignDealOutcome,
  getCampaignDealByKey,
  markCampaignDealsDoneBulk,
  startCampaignSession,
  endCampaignSession,
  insertCampaignEvent,
  incrementDealAttempt,
  incrementDealGestion,
  createCampaign,
  listCampaigns,
  getCampaignByKey,
  updateCampaignStatus,
  deleteCampaignByKey,
  listCampaignDealsByKeys,
  countCampaignPending,
  getCampaignAvailability,
  listCallOutcomes,
  createCallOutcome,
  deleteCallOutcome,
  updateCallOutcome,
  getReviewedDealIds,
  listCampaignDeals,
  listPhoneReviews,
  listCampaignEvents,
  listCampaignSessions,
  listUsers,
  upsertUser,
  upsertPhoneReview,
  insertReviewEvent,
  upsertCampaignState,
  getReviewMetrics,
  getCampaignState
};
