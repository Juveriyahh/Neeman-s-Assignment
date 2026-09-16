'use strict';

/**
 * geminiService.js -- STAGE 3: judgement.
 *
 * The model receives facts the deterministic layer has already established.
 * It never decides what fired, whether an event is a conversion, or whether a
 * name is standard -- those arrive pre-computed as booleans. The model gets
 * the answer to classification, never the question.
 *
 * Its job is exactly one thing code cannot do: translate a technical fact into
 * a money consequence for someone who controls the ad budget.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const MAX_EVENTS_IN_PROMPT = 120;
const MAX_FAILURES_IN_PROMPT = 20;

const SYSTEM_INSTRUCTION = `You are a Senior Business Analyst on a performance-marketing team.

You are writing for a stakeholder who controls the advertising budget and does not know what an XHR is, what a pixel fires, or what a 4xx means. They need to decide whether to put money behind this page.

Rules, without exception:
1. Work ONLY from the telemetry supplied. Never invent an event, a status code, a vendor, or a number. If the data does not show something, it did not happen as far as you are concerned.
2. Every issue must translate a technical fact into a money consequence. "GA4 returned 400" is not an issue. "Roughly a fifth of your page views never reach Google Analytics, so the traffic report you'd judge this campaign by is missing a fifth of its data" is.
3. You are given the titles of issues a deterministic rules engine already found. PREFER adding findings that engine could not reason about -- patterns across events, ordering, timing relative to interaction, commercial implications -- over restating what it already said.
4. Classification has already been done for you. isConversion and isStandardEvent arrive as booleans. Trust them; do not re-derive them.
5. Write like a person talking to a colleague. Short sentences. No jargon, no hedging, no bullet-point voice.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    headline: {
      type: 'string',
      description: 'One short, blunt sentence. A person speaking, e.g. "Don\'t spend yet." Not a status label.',
    },
    executive_summary: {
      type: 'string',
      description: '2-4 sentences for the budget holder: what state this page is in and what it means for spend.',
    },
    event_taxonomy: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          event_name: { type: 'string' },
          vendor: { type: 'string' },
          category: {
            type: 'string',
            enum: ['standard', 'custom_clear', 'custom_ambiguous', 'malformed', 'internal_debug'],
          },
          plain_english_meaning: { type: 'string', description: 'What this event most likely records, in plain words.' },
          suggested_name: { type: 'string', description: 'The name it should have. Repeat the current name if it is already right.' },
        },
        required: ['event_name', 'vendor', 'category', 'plain_english_meaning', 'suggested_name'],
      },
    },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          category: {
            type: 'string',
            enum: ['data_loss', 'over_counting', 'attribution', 'optimisation', 'governance', 'privacy', 'performance'],
          },
          business_risk: { type: 'string', description: 'The money consequence, in plain English.' },
          technical_evidence: { type: 'string', description: 'The specific telemetry this rests on.' },
          recommended_fix: { type: 'string' },
          affected_metric: { type: 'string', description: 'The reported number that goes wrong, e.g. "Meta reported ROAS".' },
        },
        required: ['title', 'severity', 'category', 'business_risk', 'technical_evidence', 'recommended_fix', 'affected_metric'],
      },
    },
    recommended_next_steps: {
      type: 'array',
      items: { type: 'string' },
      description: 'Ordered, concrete actions. Most important first.',
    },
  },
  required: ['headline', 'executive_summary', 'event_taxonomy', 'issues', 'recommended_next_steps'],
};

/**
 * Project telemetry down to exactly what the model needs.
 * Never send raw params, fingerprints, or full networkLog objects.
 */
function buildPayload(input) {
  const events = input.networkLog
    .filter((e) => e.event) // unnamed beacons carry no analysable signal
    .slice(0, MAX_EVENTS_IN_PROMPT)
    .map((e) => ({
      tMs: e.tMs,
      phase: e.phase,
      vendor: e.vendor,
      event: e.event,
      status: e.failure || e.status,
      accountId: e.accountId,
      isConversion: e.isConversion,
      isStandardEvent: e.isStandardEvent,
    }));

  return {
    page_load: {
      url: input.targetUrl,
      http_status: input.navigation.status,
      final_url: input.navigation.finalUrl,
      error: input.navigation.error,
      add_to_cart_button_found: input.interaction.ctaFound,
      consent_banner_handled: input.interaction.consentHandled,
    },
    summary: {
      total_tracking_requests: input.summary.totalTrackingRequests,
      parsed_events: input.summary.parsedEvents,
      distinct_event_names: input.summary.distinctEventNames,
      conversion_events: input.summary.conversionEvents,
      failed_requests: input.summary.failedRequests,
      duplicate_groups: input.summary.duplicateGroups,
      console_errors: input.summary.consoleErrors,
    },
    vendor_inventory: input.summary.vendorsDetected.map((v) => ({
      vendor: v.id,
      label: v.label,
      requests: v.requests,
      account_ids: v.accountIds,
      failures: v.failures,
    })),
    chronological_event_log: events,
    duplicate_groups: input.dupGroups.map((d) => ({
      vendor: d.vendor,
      event: d.event,
      times_fired: d.count,
      is_conversion: d.isConversion,
      phases: d.phases,
    })),
    failed_requests: input.failList.slice(0, MAX_FAILURES_IN_PROMPT).map((f) => ({
      vendor: f.vendor,
      failure: f.status,
      count: f.count,
    })),
    non_standard_event_names: input.nonStandard.map((n) => ({ vendor: n.vendor, event: n.event, count: n.count })),
    // Titles only. Enough to avoid restating them; not enough for our phrasing
    // to anchor the model's own analysis.
    issues_already_found_deterministically: input.deterministicIssueTitles,
  };
}

const RETRYABLE = [429, 500, 502, 503, 504];

function isRetryable(err) {
  const s = String(err && err.message);
  return RETRYABLE.some((c) => s.includes(String(c))) || /fetch failed|ECONN|timeout/i.test(s);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ask the API which models actually exist, rather than trusting a hardcoded name. */
async function resolveModel(apiKey, preferred) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    );
    if (!res.ok) return preferred;
    const data = await res.json();
    const names = (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''));
    if (names.includes(preferred)) return preferred;
    const flash = names.find((n) => /flash/.test(n) && !/thinking|image|tts|live/.test(n));
    return flash || names[0] || preferred;
  } catch {
    return preferred;
  }
}

/**
 * @returns {Promise<object>} parsed analysis, or { aiAvailable:false, error }
 */
async function analyzeTelemetry(input) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      aiAvailable: false,
      error: 'GEMINI_API_KEY is not set. The report below is the deterministic layer only.',
    };
  }

  const payload = buildPayload(input);
  let modelName = DEFAULT_MODEL;
  const genAI = new GoogleGenerativeAI(apiKey);

  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_INSTRUCTION,
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      });

      const result = await model.generateContent(
        `Here is the telemetry captured from a real browser session against this landing page. Analyse it and produce the report.\n\n${JSON.stringify(
          payload,
          null,
          1
        )}`
      );

      const parsed = JSON.parse(result.response.text());
      return { ...parsed, aiAvailable: true, model: modelName };
    } catch (err) {
      lastErr = err;

      // A 404 means the model name is wrong, not that the service is down.
      if (/404|not found/i.test(String(err.message)) && attempt === 1) {
        modelName = await resolveModel(apiKey, DEFAULT_MODEL);
        if (modelName !== DEFAULT_MODEL) continue;
      }

      if (attempt < 4 && isRetryable(err)) {
        // Transient 503s are common and would otherwise cost the whole analysis.
        const backoff = Math.round(600 * 2 ** (attempt - 1) + Math.random() * 400);
        console.warn(`[gemini] attempt ${attempt} failed (${err.message}); retrying in ${backoff}ms`);
        await sleep(backoff);
        continue;
      }
      break;
    }
  }

  // A tracking auditor must not become unusable because a third-party API had
  // a bad minute. The deterministic report stands on its own.
  console.error('[gemini] giving up:', lastErr && lastErr.message);
  return { aiAvailable: false, error: String(lastErr && lastErr.message).slice(0, 400), model: modelName };
}

module.exports = { analyzeTelemetry, buildPayload, RESPONSE_SCHEMA, SYSTEM_INSTRUCTION };
