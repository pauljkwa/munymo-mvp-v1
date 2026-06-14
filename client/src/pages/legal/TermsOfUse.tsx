import LegalPage, { LegalSection } from "@/components/LegalPage";

export default function TermsOfUse() {
  return (
    <LegalPage
      title="Terms of Use"
      subtitle="Please read these terms carefully before playing. They are written in plain English, because legal documents that nobody reads serve nobody."
      lastUpdated="June 2025"
    >
      <LegalSection title="1. Who We Are">
        <p>
          Munymo is a daily stock prediction game operated for educational purposes. We are not a
          financial services firm, a stockbroker, an investment adviser, or anything else that requires
          a licence to tell you what to do with your money. We are a game. A well-designed one, we
          think, but a game nonetheless.
        </p>
      </LegalSection>

      <LegalSection title="2. Acceptance of Terms">
        <p>
          By accessing or using Munymo — whether you are browsing the site, creating an account, or
          playing a game — you agree to be bound by these Terms of Use. If you do not agree, please
          do not use the platform. We will not take it personally.
        </p>
        <p>
          We may update these terms from time to time. When we do, we will update the "last updated"
          date above. Continued use of the platform after any changes constitutes acceptance of the
          revised terms.
        </p>
      </LegalSection>

      <LegalSection title="3. Eligibility">
        <p>
          You must be at least 18 years of age to use Munymo. By using the platform, you confirm
          that you meet this requirement. If you are under 18, please come back when you are older —
          the markets will still be there.
        </p>
        <p>
          You must also have the legal capacity to enter into a binding agreement under the laws of
          your jurisdiction. If you are unsure whether that applies to you, the answer is probably yes,
          but please check with a local legal professional if in doubt.
        </p>
      </LegalSection>

      <LegalSection title="4. Your Account">
        <p>
          Munymo uses Manus OAuth for authentication. You are responsible for maintaining the
          confidentiality of your account credentials and for all activity that occurs under your
          account. If you suspect unauthorised access, please notify us immediately.
        </p>
        <p>
          You agree not to create multiple accounts to gain competitive advantage, manipulate
          leaderboard standings, or circumvent any restrictions placed on your account. One player,
          one account. It is not a complicated rule.
        </p>
      </LegalSection>

      <LegalSection title="5. The Game and Scoring">
        <p>
          Munymo presents daily matchups between two publicly listed companies. You make a prediction
          about which company will outperform the other over a defined period. All scores are calculated
          server-side after results are published. The scoring system is fixed and cannot be influenced
          by any individual player.
        </p>
        <p>
          Game results are based on publicly available market data. Munymo makes no guarantee that
          the data used is free from errors, delays, or omissions. In the event of a data error that
          materially affects a result, we reserve the right to void or adjust the affected game.
        </p>
      </LegalSection>

      <LegalSection title="6. Intellectual Property">
        <p>
          All content on Munymo — including the game design, scoring system, research curation,
          MunyIQ concept, branding, and written materials — is the intellectual property of Munymo
          and its operators. You may not reproduce, distribute, or create derivative works from any
          part of the platform without prior written permission.
        </p>
      </LegalSection>

      <LegalSection title="7. Prohibited Conduct">
        <p>You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Use automated tools, bots, or scripts to interact with the platform</li>
          <li>Attempt to reverse-engineer, scrape, or extract data from the platform</li>
          <li>Interfere with the platform's infrastructure or security</li>
          <li>Use the platform for any unlawful purpose</li>
          <li>Harass, abuse, or threaten other users</li>
          <li>Misrepresent your identity or affiliation</li>
        </ul>
        <p className="mt-3">
          Violation of these terms may result in immediate account suspension or termination, at our
          sole discretion.
        </p>
      </LegalSection>

      <LegalSection title="8. Disclaimers">
        <p>
          Munymo is provided "as is" and "as available." We make no warranties, express or implied,
          regarding the platform's availability, accuracy, or fitness for any particular purpose.
          Nothing on Munymo constitutes financial, investment, or trading advice. Please see our
          separate Disclaimer for more detail on this point.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation of Liability">
        <p>
          To the fullest extent permitted by applicable law, Munymo and its operators shall not be
          liable for any indirect, incidental, special, consequential, or punitive damages arising
          from your use of the platform, including but not limited to any investment decisions made
          as a result of participating in the game.
        </p>
        <p>
          If you use Munymo's predictions as the basis for actual financial decisions, that is entirely
          your choice — and entirely your responsibility.
        </p>
      </LegalSection>

      <LegalSection title="10. Termination">
        <p>
          We reserve the right to suspend or terminate your account at any time, with or without
          notice, for any reason including but not limited to breach of these terms. You may also
          delete your account at any time by contacting us.
        </p>
      </LegalSection>

      <LegalSection title="11. Governing Law">
        <p>
          These terms are governed by and construed in accordance with applicable law. Any disputes
          arising from these terms or your use of the platform shall be subject to the exclusive
          jurisdiction of the relevant courts.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          If you have questions about these terms, please contact us through the platform. We are
          a small team and we do read our messages.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
