import LegalPage, { LegalSection } from "@/components/LegalPage";

export default function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="We collect what we need to run the game. We do not sell it, share it unnecessarily, or do anything with it that would make you uncomfortable if you knew about it."
      lastUpdated="June 2025"
    >
      <LegalSection title="1. What We Collect">
        <p>
          When you sign in to Munymo via Google, we receive your name, email address, and a unique
          identifier associated with your Google account. We do not receive your password — that
          stays between you and Google.
        </p>
        <p>
          As you use the platform, we record your game activity: the predictions you make, the
          scores you earn, your streak history, and your engagement with the research content. This
          data is what powers your profile, the leaderboard, and — in time — your MunyIQ score.
        </p>
        <p>
          We also collect standard server logs: IP addresses, browser type, pages visited, and
          timestamps. This is routine infrastructure data used to keep the platform running and to
          diagnose problems when they occur.
        </p>
      </LegalSection>

      <LegalSection title="2. What We Do Not Collect">
        <p>
          We do not collect financial information of any kind. We do not ask for your bank details,
          brokerage account, portfolio holdings, or investment history. Munymo is a game — we have
          no need for any of that, and no interest in it.
        </p>
        <p>
          We do not use third-party advertising trackers. We do not sell your data to data brokers.
          We do not build advertising profiles. If that sounds refreshing, it is because it should be.
        </p>
      </LegalSection>

      <LegalSection title="3. How We Use Your Data">
        <p>Your data is used for the following purposes:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>To operate your account and authenticate your sessions</li>
          <li>To record and display your game history, scores, and streaks</li>
          <li>To calculate leaderboard rankings</li>
          <li>To calculate your MunyIQ score (when that feature launches)</li>
          <li>To send you notifications about game results, if you have opted in</li>
          <li>To improve the platform based on aggregate usage patterns</li>
          <li>To comply with legal obligations</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Data Sharing">
        <p>
          We do not sell your personal data. We share it only in the following limited circumstances:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>
            <strong>Service providers:</strong> We use third-party infrastructure providers (hosting,
            database, authentication) to operate the platform. These providers process your data on
            our behalf and are contractually bound to protect it.
          </li>
          <li>
            <strong>Legal requirements:</strong> We may disclose your data if required to do so by
            law, court order, or regulatory authority.
          </li>
          <li>
            <strong>Business transfer:</strong> If Munymo is acquired or merged, your data may be
            transferred as part of that transaction. We would notify you before that happened.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Cookies">
        <p>
          Munymo uses a session cookie to keep you signed in between visits. This is a functional
          cookie — without it, you would have to sign in every time you opened the app, which would
          be annoying for everyone.
        </p>
        <p>
          We do not use advertising cookies, tracking pixels, or any third-party cookies for
          marketing purposes. Your browser's cookie settings will allow you to manage or delete
          cookies at any time, though doing so may affect your ability to stay signed in.
        </p>
      </LegalSection>

      <LegalSection title="6. Data Retention">
        <p>
          We retain your account data for as long as your account is active. If you delete your
          account, we will remove your personal data within a reasonable period, subject to any
          legal obligations to retain certain records.
        </p>
        <p>
          Aggregate, anonymised game statistics may be retained indefinitely for platform analytics
          and historical records.
        </p>
      </LegalSection>

      <LegalSection title="7. Your Rights">
        <p>
          Depending on where you live, you may have rights regarding your personal data, including
          the right to access, correct, or delete it. To exercise any of these rights, please
          contact us through the platform. We will respond within a reasonable timeframe.
        </p>
      </LegalSection>

      <LegalSection title="8. Security">
        <p>
          We take reasonable technical and organisational measures to protect your data from
          unauthorised access, loss, or disclosure. No system is perfectly secure, but we take
          this seriously and act accordingly.
        </p>
      </LegalSection>

      <LegalSection title="9. Children">
        <p>
          Munymo is not intended for users under the age of 18. We do not knowingly collect
          personal data from minors. If we become aware that we have done so, we will delete it
          promptly.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. We will update the "last updated"
          date at the top of this page when we do. We encourage you to review this policy
          periodically.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>
          If you have questions or concerns about how we handle your data, please contact us
          through the platform.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
