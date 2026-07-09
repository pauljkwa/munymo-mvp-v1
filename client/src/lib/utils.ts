import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Appends UTM campaign params to an outbound article URL so the publisher's
 * analytics show a labelled "munymo daily-matchup referral" campaign rather
 * than a bare munymo.com referrer. See the article-attribution strategy: we
 * deliberately drive (and take credit for) traffic to the source publisher.
 * Uses the URL API so existing query strings are preserved; returns the input
 * unchanged if it can't be parsed.
 */
export function withReferralParams(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set("utm_source", "munymo");
    url.searchParams.set("utm_medium", "referral");
    url.searchParams.set("utm_campaign", "daily-matchup");
    return url.toString();
  } catch {
    return rawUrl;
  }
}
