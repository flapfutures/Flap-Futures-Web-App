import { db } from "./storage";
import { visitorSessions, pageViews } from "@shared/schema";
import { eq, desc, gte, sql, countDistinct, count, and } from "drizzle-orm";
import { log } from "./vite";

// ── IP → Country cache (avoids hammering ip-api.com) ─────────────────────────
const geoCache = new Map<string, { code: string; name: string }>();

async function lookupCountry(ip: string): Promise<{ code: string; name: string }> {
  if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("10.") || ip.startsWith("192.168.")) {
    return { code: "LC", name: "Local" };
  }
  if (geoCache.has(ip)) return geoCache.get(ip)!;
  try {
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode,country`, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const j = await r.json();
      const geo = { code: j.countryCode || "??", name: j.country || "Unknown" };
      geoCache.set(ip, geo);
      return geo;
    }
  } catch {
    // geo lookup failed — non-fatal
  }
  const fallback = { code: "??", name: "Unknown" };
  geoCache.set(ip, fallback);
  return fallback;
}

// ── Track a page view + upsert session ───────────────────────────────────────
export async function trackPageView(fingerprint: string, page: string, ip: string) {
  const geo = await lookupCountry(ip);
  const now = new Date();

  // Upsert visitor session
  const existing = await db
    .select()
    .from(visitorSessions)
    .where(eq(visitorSessions.fingerprint, fingerprint))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(visitorSessions)
      .set({ page, lastSeen: now, countryCode: geo.code, countryName: geo.name })
      .where(eq(visitorSessions.fingerprint, fingerprint));
  } else {
    await db.insert(visitorSessions).values({
      fingerprint,
      countryCode: geo.code,
      countryName: geo.name,
      page,
      firstSeen: now,
      lastSeen: now,
    });
  }

  // Insert page view
  await db.insert(pageViews).values({
    fingerprint,
    countryCode: geo.code,
    countryName: geo.name,
    page,
    viewedAt: now,
  });
}

// ── Update heartbeat only (no new page view) ──────────────────────────────────
export async function heartbeat(fingerprint: string, page: string) {
  await db
    .update(visitorSessions)
    .set({ lastSeen: new Date(), page })
    .where(eq(visitorSessions.fingerprint, fingerprint));
}

// ── Analytics summary for dev88 ───────────────────────────────────────────────
export async function getAnalytics() {
  const now = new Date();
  const fiveMinAgo  = new Date(now.getTime() - 5 * 60 * 1000);
  const todayStart  = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart   = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Online now (active in last 5 min)
  const onlineRows = await db
    .select()
    .from(visitorSessions)
    .where(gte(visitorSessions.lastSeen, fiveMinAgo))
    .orderBy(desc(visitorSessions.lastSeen));

  const onlineNow = onlineRows.map(s => {
    const idleSec = Math.floor((now.getTime() - new Date(s.lastSeen).getTime()) / 1000);
    const idleLabel = idleSec < 60 ? "Just now" : `${Math.floor(idleSec / 60)}m ago`;
    const status = idleSec < 60 ? "Active" : idleSec < 180 ? "Idle" : "Away";
    return { fingerprint: s.fingerprint, countryCode: s.countryCode, countryName: s.countryName, page: s.page, idle: idleLabel, status };
  });

  // Summary counts
  const [todayRes] = await db
    .select({ count: countDistinct(pageViews.fingerprint) })
    .from(pageViews)
    .where(gte(pageViews.viewedAt, todayStart));

  const [weekRes] = await db
    .select({ count: countDistinct(pageViews.fingerprint) })
    .from(pageViews)
    .where(gte(pageViews.viewedAt, weekStart));

  const [totalRes] = await db
    .select({ count: countDistinct(pageViews.fingerprint) })
    .from(pageViews);

  // Daily traffic — last 30 days
  const dailyRows = await db
    .select({
      date: sql<string>`DATE(viewed_at)`.as("date"),
      views: count(pageViews.id).as("views"),
      visitors: countDistinct(pageViews.fingerprint).as("visitors"),
    })
    .from(pageViews)
    .where(gte(pageViews.viewedAt, monthStart))
    .groupBy(sql`DATE(viewed_at)`)
    .orderBy(desc(sql`DATE(viewed_at)`));

  // Top pages
  const topPages = await db
    .select({
      page: pageViews.page,
      views: count(pageViews.id).as("views"),
      visitors: countDistinct(pageViews.fingerprint).as("visitors"),
    })
    .from(pageViews)
    .groupBy(pageViews.page)
    .orderBy(desc(count(pageViews.id)))
    .limit(20);

  // Recent visitors — last 50 page views
  const recentRows = await db
    .select()
    .from(pageViews)
    .orderBy(desc(pageViews.viewedAt))
    .limit(50);

  const recent = recentRows.map(r => ({
    fingerprint: r.fingerprint.slice(0, 12) + "...",
    countryCode: r.countryCode,
    countryName: r.countryName,
    page: r.page,
    time: new Date(r.viewedAt).toLocaleString("en-US", { timeZone: "UTC" }),
  }));

  return {
    onlineNow,
    todayCount:  todayRes?.count ?? 0,
    weekCount:   weekRes?.count  ?? 0,
    totalCount:  totalRes?.count ?? 0,
    dailyTraffic: dailyRows,
    topPages,
    recent,
  };
}
