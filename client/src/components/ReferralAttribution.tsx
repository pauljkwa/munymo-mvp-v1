import { useEffect, useRef } from "react";
import { useUser } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";

const REFERRAL_COOKIE = "munymo_ref";

function readCookie(name: string): string | null {
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; path=/`;
}

/**
 * Mounted once at the app root. Attributes a signup to the munymo_ref
 * referral cookie (set by GET /r/:code on a merch QR scan) the first time a
 * signed-in user is seen with that cookie present, then clears it.
 */
export default function ReferralAttribution() {
  const { isLoaded, isSignedIn } = useUser();
  const attributeSignup = trpc.referral.attributeSignup.useMutation();
  const attempted = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || attempted.current) return;
    const referralCookieValue = readCookie(REFERRAL_COOKIE);
    if (!referralCookieValue) return;

    attempted.current = true;
    attributeSignup.mutate(
      { referralCookieValue },
      { onSettled: () => clearCookie(REFERRAL_COOKIE) }
    );
  }, [isLoaded, isSignedIn, attributeSignup]);

  return null;
}
