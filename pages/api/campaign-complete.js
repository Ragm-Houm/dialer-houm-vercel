const { markCampaignDealDone, updateCampaignDealOutcome, getCampaignDealByKey, listCallOutcomes, incrementDealGestion } = require('../../lib/supabase');
const { requireUser } = require('../../lib/auth');

const MAX_ATTEMPTS = Number(process.env.DIALER_MAX_ATTEMPTS || 3);
const MAX_GESTIONS = Number(process.env.DIALER_MAX_GESTIONS || 5);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { campaignKey, dealId, outcome, email, idToken, skip, forceDone, nextAttemptAt } = req.body || {};
    if (!campaignKey || !dealId || !email || !idToken) {
      return res.status(400).json({ error: 'campaignKey, dealId, email e idToken son requeridos' });
    }

    const auth = await requireUser({ email, idToken });
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const outcomeKey = outcome || '';
    let shouldFinalize = Boolean(skip || forceDone);
    let attempts = 0;
    let gestiones = 0;

    const deal = await getCampaignDealByKey(campaignKey, Number(dealId));
    gestiones = (deal?.gestions || 0) + 1;

    if (!skip && outcomeKey && !shouldFinalize) {
      const outcomes = await listCallOutcomes();
      const outcomeDef = outcomes.find((item) => item.key === outcomeKey);
      const isIntermediate = outcomeDef?.outcome_type === 'intermediate';
      attempts = deal?.attempts || 0;
      shouldFinalize = !isIntermediate;
    }

    await incrementDealGestion(campaignKey, Number(dealId), auth.user.email);

    if (shouldFinalize || skip) {
      await markCampaignDealDone(campaignKey, Number(dealId), outcome || null, auth.user.email);
      return res.status(200).json({ ok: true, status: 'done', attempts, gestiones, maxGestiones: MAX_GESTIONS });
    }

    await updateCampaignDealOutcome(
      campaignKey,
      Number(dealId),
      outcome || null,
      'pending',
      auth.user.email,
      { nextAttemptAt }
    );
    return res.status(200).json({ ok: true, status: 'pending', attempts, gestiones, maxGestiones: MAX_GESTIONS });
  } catch (error) {
    console.error('Error en campaign-complete:', error);
    res.status(500).json({ error: error.message });
  }
}
