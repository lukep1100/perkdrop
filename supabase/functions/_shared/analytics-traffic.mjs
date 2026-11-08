// Crawler and preview requests may follow real links without being customers.
// Keep redirects usable, but exclude positively identified automation from KPIs.
const automationAgent = /bot\b|crawler|spider|slurp|googleother|facebookexternalhit|facebot|meta-external(?:agent|fetcher)|bingpreview|lighthouse|headlesschrome|vercel-screenshot|curl\/|wget\/|python-requests|python-urllib|node\.js|chatgpt-user/i;

export function isAutomatedAgent(userAgent) {
  return typeof userAgent === 'string' && automationAgent.test(userAgent);
}

export function isBotAnalyticsEvent(event) {
  return event.metadata?.traffic_type === 'bot' || event.metadata?.is_bot === true || isAutomatedAgent(event.user_agent);
}

export function isPublicAnalyticsEvent(event) {
  return event.metadata?.traffic_type !== 'internal' && !isBotAnalyticsEvent(event);
}
