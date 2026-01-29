const {
  listCampaignDeals,
  listPhoneReviews,
  listCampaignEvents,
  listCampaignSessions,
  listCallOutcomes
} = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');
const { getCredentials } = require('../../lib/session-cookie');
const { buildCampaignKey } = require('../../lib/review');

function initCampaign(acc, key, base) {
  if (!acc[key]) {
    acc[key] = {
      campaignKey: key,
      country: base.country || 'N/A',
      pipelineId: base.pipelineId || null,
      stageId: base.stageId || null,
      totals: {
        deals: 0,
        done: 0,
        pending: 0,
        locked: 0,
        reviewed: 0,
        skipped: 0,
        withSelection: 0,
        calls: 0,
        callSeconds: 0,
        leadsCompleted: 0,
        leadsSkipped: 0,
        leadsDeferred: 0,
        activeSeconds: 0,
        idleSeconds: 0,
        sessions: 0,
        buckets: {}
      },
      outcomes: {},
      executives: {}
    };
  }
  return acc[key];
}

function ensureExecutive(campaign, email) {
  if (!email) return;
  if (!campaign.executives[email]) {
    campaign.executives[email] = {
      email,
      reviewed: 0,
      skipped: 0,
      withSelection: 0,
      dealsDone: 0,
      calls: 0,
      callSeconds: 0,
      leadsCompleted: 0,
      leadsSkipped: 0,
      leadsDeferred: 0,
      activeSeconds: 0,
      idleSeconds: 0
    };
  }
  return campaign.executives[email];
}

function bumpExecutive(campaign, email, field, increment = 1) {
  const exec = ensureExecutive(campaign, email);
  if (!exec) return;
  exec[field] += increment;
}

function ensureUser(acc, email) {
  if (!email) return null;
  if (!acc[email]) {
    acc[email] = {
      email,
      reviewed: 0,
      withSelection: 0,
      skipped: 0,
      calls: 0,
      callSeconds: 0,
      activeSeconds: 0,
      idleSeconds: 0,
      leadsCompleted: 0,
      leadsSkipped: 0,
      leadsDeferred: 0,
      sessions: 0,
      outcomes: {},
      buckets: {}
    };
  }
  return acc[email];
}

function bumpUser(acc, email, field, increment = 1) {
  const user = ensureUser(acc, email);
  if (!user) return;
  user[field] += increment;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { dateFrom, dateTo } = req.query;

    // requireUser lee cookies automáticamente y valida por DB si hay sesión activa
    const auth = await requireUser(req, ['admin', 'supervisor']);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const [campaignDeals, phoneReviews, campaignEvents, campaignSessions, outcomeDefs] = await Promise.all([
      listCampaignDeals(2500),
      listPhoneReviews(5000),
      listCampaignEvents(6000),
      listCampaignSessions(3000),
      listCallOutcomes()
    ]);

    const campaignsMap = {};
    const usersMap = {};
    const outcomeBuckets = (outcomeDefs || []).reduce((acc, item) => {
      acc[item.key] = item.metric_bucket || 'otro';
      return acc;
    }, {});

    const parseDate = (value, fallback) => {
      if (!value) return fallback;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? fallback : parsed;
    };

    const rangeStart = parseDate(dateFrom, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const rangeEnd = parseDate(dateTo, new Date());
    rangeEnd.setHours(23, 59, 59, 999);

    const inRange = (value) => {
      if (!value) return false;
      const ts = new Date(value);
      if (Number.isNaN(ts.getTime())) return false;
      return ts >= rangeStart && ts <= rangeEnd;
    };

    campaignDeals.forEach((row) => {
      const key = row.campaign_key || buildCampaignKey(row.country, row.pipeline_id, row.stage_id);
      const campaign = initCampaign(campaignsMap, key, {
        country: row.country,
        pipelineId: row.pipeline_id,
        stageId: row.stage_id
      });

      campaign.totals.deals += 1;
      if (row.status === 'done') campaign.totals.done += 1;
      else if (row.status === 'locked') campaign.totals.locked += 1;
      else campaign.totals.pending += 1;

      if (row.status === 'done') bumpExecutive(campaign, row.assigned_to, 'dealsDone');
    });

  phoneReviews.forEach((row) => {
    const key = buildCampaignKey(row.country, row.pipeline_id, row.stage_id);
    const campaign = initCampaign(campaignsMap, key, {
      country: row.country,
      pipelineId: row.pipeline_id,
      stageId: row.stage_id
    });

    campaign.totals.reviewed += 1;
    if (row.skipped) campaign.totals.skipped += 1;
    if (row.selected_primary || row.selected_secondary) campaign.totals.withSelection += 1;

    bumpExecutive(campaign, row.reviewed_by, 'reviewed');
    if (row.skipped) bumpExecutive(campaign, row.reviewed_by, 'skipped');
    if (row.selected_primary || row.selected_secondary) bumpExecutive(campaign, row.reviewed_by, 'withSelection');

    bumpUser(usersMap, row.reviewed_by, 'reviewed');
    if (row.skipped) bumpUser(usersMap, row.reviewed_by, 'skipped');
    if (row.selected_primary || row.selected_secondary) bumpUser(usersMap, row.reviewed_by, 'withSelection');
  });

    campaignEvents.forEach((event) => {
      if (!inRange(event.created_at)) return;
      const key = event.campaign_key;
      if (!key) return;
      const campaign = initCampaign(campaignsMap, key, {});
      const metadata = event.metadata || {};
      const outcome = metadata.outcome || metadata.reason || null;

      if (event.event_type === 'call_started') {
        campaign.totals.calls += 1;
        bumpExecutive(campaign, event.user_email, 'calls');
        bumpUser(usersMap, event.user_email, 'calls');
      }
      if (event.event_type === 'call_ended') {
        const duration = Number(metadata.duration || 0);
        campaign.totals.callSeconds += duration;
        bumpExecutive(campaign, event.user_email, 'callSeconds', duration);
        bumpUser(usersMap, event.user_email, 'callSeconds', duration);
      }
      if (event.event_type === 'call_outcome_selected' && outcome) {
        campaign.outcomes[outcome] = (campaign.outcomes[outcome] || 0) + 1;
        const bucket = outcomeBuckets[outcome] || 'otro';
        campaign.totals.buckets = campaign.totals.buckets || {};
        campaign.totals.buckets[bucket] = (campaign.totals.buckets[bucket] || 0) + 1;
        const user = ensureUser(usersMap, event.user_email);
        if (user) {
          user.outcomes[outcome] = (user.outcomes[outcome] || 0) + 1;
          user.buckets = user.buckets || {};
          user.buckets[bucket] = (user.buckets[bucket] || 0) + 1;
        }
      }
      if (event.event_type === 'lead_completed') {
        campaign.totals.leadsCompleted += 1;
        bumpExecutive(campaign, event.user_email, 'leadsCompleted');
        bumpUser(usersMap, event.user_email, 'leadsCompleted');
      }
      if (event.event_type === 'lead_skipped') {
        campaign.totals.leadsSkipped += 1;
        bumpExecutive(campaign, event.user_email, 'leadsSkipped');
        bumpUser(usersMap, event.user_email, 'leadsSkipped');
      }
      if (event.event_type === 'lead_deferred') {
        campaign.totals.leadsDeferred += 1;
        bumpExecutive(campaign, event.user_email, 'leadsDeferred');
        bumpUser(usersMap, event.user_email, 'leadsDeferred');
      }
    });

    campaignSessions.forEach((session) => {
      if (!inRange(session.started_at)) return;
      if (!session.campaign_key) return;
      const campaign = initCampaign(campaignsMap, session.campaign_key, {});
      const activeSeconds = Number(session.active_seconds || 0);
      const callSeconds = Number(session.call_seconds || 0);
      const idleSeconds = Number(session.idle_seconds || 0);

      campaign.totals.sessions += 1;
      campaign.totals.activeSeconds += activeSeconds;
      campaign.totals.callSeconds += callSeconds;
      campaign.totals.idleSeconds += idleSeconds;
      bumpExecutive(campaign, session.user_email, 'activeSeconds', activeSeconds);
      bumpExecutive(campaign, session.user_email, 'callSeconds', callSeconds);
      bumpExecutive(campaign, session.user_email, 'idleSeconds', idleSeconds);

      bumpUser(usersMap, session.user_email, 'activeSeconds', activeSeconds);
      bumpUser(usersMap, session.user_email, 'callSeconds', callSeconds);
      bumpUser(usersMap, session.user_email, 'idleSeconds', idleSeconds);
      bumpUser(usersMap, session.user_email, 'sessions', 1);
    });

    const users = Object.values(usersMap).map((user) => {
      const handled = user.leadsCompleted + user.leadsSkipped;
      const skipRate = handled ? user.leadsSkipped / handled : 0;
      const hoursActive = user.activeSeconds ? user.activeSeconds / 3600 : 0;
      const callsPerHour = hoursActive ? user.calls / hoursActive : 0;
      const talkRatio = user.activeSeconds ? user.callSeconds / user.activeSeconds : 0;
      return {
        ...user,
        handled,
        skipRate,
        callsPerHour,
        talkRatio
      };
    }).sort((a, b) => b.handled - a.handled);

    const alerts = [];
    users.forEach((user) => {
      if (user.handled >= 10 && user.skipRate >= 0.35) {
        alerts.push({
          type: 'skip_rate',
          email: user.email,
          message: `${user.email} tiene ${Math.round(user.skipRate * 100)}% de saltos`
        });
      }
      if (user.activeSeconds >= 3600 && user.callsPerHour < 2) {
        alerts.push({
          type: 'low_calls',
          email: user.email,
          message: `${user.email} tiene pocas llamadas por hora (${user.callsPerHour.toFixed(1)})`
        });
      }
      if (user.activeSeconds >= 3600 && user.talkRatio < 0.2) {
        alerts.push({
          type: 'low_talk',
          email: user.email,
          message: `${user.email} tiene bajo tiempo en llamada (${Math.round(user.talkRatio * 100)}%)`
        });
      }
    });

    const campaigns = Object.values(campaignsMap)
      .map((c) => ({
        ...c,
        executives: Object.values(c.executives).sort((a, b) => b.reviewed - a.reviewed)
      }))
      .sort((a, b) => b.totals.reviewed - a.totals.reviewed);

    res.status(200).json({
      ok: true,
      campaigns,
      users,
      alerts,
      range: {
        from: rangeStart.toISOString(),
        to: rangeEnd.toISOString()
      },
      totals: {
        campaigns: campaigns.length,
        reviewed: campaigns.reduce((acc, c) => acc + c.totals.reviewed, 0),
        done: campaigns.reduce((acc, c) => acc + c.totals.done, 0),
        calls: campaigns.reduce((acc, c) => acc + c.totals.calls, 0),
        leadsCompleted: campaigns.reduce((acc, c) => acc + c.totals.leadsCompleted, 0),
        leadsSkipped: campaigns.reduce((acc, c) => acc + c.totals.leadsSkipped, 0),
        callSeconds: campaigns.reduce((acc, c) => acc + c.totals.callSeconds, 0),
        activeSeconds: campaigns.reduce((acc, c) => acc + c.totals.activeSeconds, 0)
      }
    });
  } catch (error) {
    console.error('Error en metrics-campaigns:', error);
    res.status(500).json({ error: error.message });
  }
}
