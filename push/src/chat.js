// The companion's chat: a friendly coach that knows the user's app data and can suggest changes.
// The app sends the conversation plus a fresh snapshot of its data; Claude answers and may propose
// actions as tool calls. Nothing is executed here: the app shows each proposal as a card the user
// accepts or skips, and reports the outcome back as the tool result on the next turn.
//
// Bindings:
//   ANTHROPIC_API_KEY   secret: npx wrangler secret put ANTHROPIC_API_KEY
//   COMPANION_CODE      secret: the pairing code the app sends (keeps strangers off your API bill)
//   CHAT_MODEL          var, default claude-haiku-5-5
//   CHAT_DAILY_LIMIT    var, max messages per day across all devices (default 200)
import Anthropic from '@anthropic-ai/sdk';

export const DEFAULT_MODEL = 'claude-haiku-5-5';
// Haiku has no server-side refusal fallback (sending one is an error); the other current models do
const hasFallback = model => !model.startsWith('claude-haiku');

// Kept byte-for-byte stable so it stays cached; everything that changes goes in the per-turn <app_state>.
export const SYSTEM = `You are the user's companion inside MetaMorph, a personal app for keeping four daily "Gates" (sleep, fitness, nutrition, hygiene) through time-blocked routines, plus water, food and macros, workouts, body measurements, to-dos and an attention practice.

Your one purpose is keeping the user consistent with the app and moving toward the goals they've set. You are a friendly companion who keeps them in check: warm, encouraging and on their side, but honest. When they slip, say so plainly and kindly, then point to the next small step. Celebrate real wins. Tie advice back to their own goals when you can. For food, hitting the daily calorie goal is the main focus; protein comes second.

Each user turn starts with an <app_state> block: a snapshot of their app taken when they sent the message, including your name, their goals, today's routines, water, food, recent workouts, body numbers and how consistent they've been. Treat it as the truth about their day and refer to it naturally; don't recite it back. If something isn't in it, you don't know it.

How to talk:
- They are on a phone. Keep replies short: usually two to four sentences, at most a short list. No headings or tables.
- Speak as yourself, in the first person, using your name only when it helps.
- Use their units and the clock times shown in the snapshot.
- You're not a doctor. For pain, injury, illness or anything medical, encourage them to check with a professional.

Changing things in the app:
- You can't change anything directly. To log or change something, call a tool: it appears as a card the user accepts or skips. Only propose things they asked for or clearly agreed to.
- Every response starts with your text reply, before any tool call. Never send a tool call on its own: the user decides on cards later and you won't get another turn until their next message, so answer everything they asked first, mention what you're suggesting, then call the tools.
- Never say something is done until a tool result says the user accepted it.
- When they tell you what they ate, call log_food once per distinct food. Use their saved foods' numbers when one matches; otherwise give a sensible estimate for a typical portion and say it's an estimate.
- Use routine ids exactly as they appear in the snapshot.
- Tool results tell you whether each suggestion was accepted, skipped or ignored. Don't re-propose something they skipped unless they ask again.`;

const s = (description, extra = {}) => ({ type: 'string', description, ...extra });
const n = description => ({ type: 'number', description });
const tool = (name, description, properties) => ({
  name, description, strict: true,
  input_schema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
});

export const TOOLS = [
  tool('log_food', 'Suggest logging one food to today\'s nutrition log. Macros are for the whole portion eaten.', {
    name: s('Food name as the user would recognise it, including the portion, e.g. "3 scrambled eggs"'),
    meal: s('Which meal it belongs to', { enum: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] }),
    kcal: n('Calories for the portion'),
    protein_g: n('Protein in grams'),
    carbs_g: n('Carbohydrates in grams'),
    fat_g: n('Fat in grams'),
  }),
  tool('log_water', 'Suggest logging water the user drank.', {
    amount_ml: n('Amount in millilitres (convert from ounces if needed: 1 oz = 29.57 ml)'),
  }),
  tool('add_todo', 'Suggest adding a task to the to-do list.', {
    text: s('The task'),
    date: s('Due date as YYYY-MM-DD, or an empty string for no date'),
    time: s('Due time as HH:MM in 24-hour time, or an empty string for no time'),
  }),
  tool('move_routine', 'Suggest changing the usual start time of one of the user\'s routines.', {
    routine_id: s('The routine id from the snapshot'),
    time: s('New start time as HH:MM in 24-hour time'),
  }),
  tool('log_weight', 'Suggest logging a body weight reading for today.', {
    weight: n('Body weight in the user\'s weight unit from the snapshot'),
  }),
  tool('add_goal', 'Suggest saving a goal the user wants you to keep them accountable to.', {
    text: s('The goal in the user\'s own words, short'),
  }),
];

const MAX_MESSAGES = 80;
const MAX_BYTES = 400_000;

function validMessages(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) return false;
  if (messages[0].role !== 'user' || messages[messages.length - 1].role !== 'user') return false;
  return messages.every(m => (m.role === 'user' || m.role === 'assistant') && (typeof m.content === 'string' || Array.isArray(m.content)));
}

// constant-time comparison so the pairing code can't be guessed a character at a time
export function sameCode(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !b) return false;
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

// counts messages per UTC day in KV; returns false once the day's limit is reached
async function underDailyLimit(env) {
  const limit = Number(env.CHAT_DAILY_LIMIT) || 200, key = 'chat:' + new Date().toISOString().slice(0, 10);
  const used = Number(await env.SUBS.get(key)) || 0;
  if (used >= limit) return false;
  await env.SUBS.put(key, String(used + 1), { expirationTtl: 3 * 86400 });
  return true;
}

export async function handleChat(req, env, json) {
  if (!env.ANTHROPIC_API_KEY || !env.COMPANION_CODE) return json({ error: 'not_configured' }, 503);
  if (!sameCode(req.headers.get('X-Companion-Code') || '', env.COMPANION_CODE)) return json({ error: 'bad_code' }, 401);
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return json({ error: 'too_large' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch (e) { return json({ error: 'bad_request' }, 400); }
  if (!validMessages(body.messages)) return json({ error: 'bad_request' }, 400);
  if (!(await underDailyLimit(env))) return json({ error: 'daily_limit' }, 429);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, authToken: null, ...(env.ANTHROPIC_FETCH ? { fetch: env.ANTHROPIC_FETCH } : {}), maxRetries: 1, timeout: 60_000 });
  try {
    const model = env.CHAT_MODEL || DEFAULT_MODEL, fb = hasFallback(model);
    const res = await client.beta.messages.create({
      model,
      max_tokens: 8000,
      betas: [...(fb ? ['server-side-fallback-2026-07-01'] : []), 'thinking-binding-controls-2026-08-01'],
      // if a safety check declines a turn, the API retries it on a suitable model instead of failing
      ...(fb ? { fallbacks: 'default' } : {}),
      // the app trims old turns from the front of long chats; drop any thinking that no longer matches instead of erroring
      thinking: { type: 'adaptive', block_binding: { prefix_mismatch_behavior: 'drop_block' } },
      output_config: { effort: 'low' },
      cache_control: { type: 'ephemeral' },
      system: SYSTEM,
      tools: TOOLS,
      messages: body.messages,
    });
    const content = res.content.filter(b => ['text', 'tool_use', 'thinking', 'redacted_thinking'].includes(b.type));
    return json({ content, stop_reason: res.stop_reason, model: res.model });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return json({ error: 'bad_api_key' }, 502);
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 429);
    if (e instanceof Anthropic.BadRequestError) return json({ error: 'rejected', detail: String(e.message).slice(0, 300) }, 400);
    if (e instanceof Anthropic.APIError) return json({ error: 'upstream', status: e.status }, 502);
    throw e;
  }
}
