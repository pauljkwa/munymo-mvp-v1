import LegalPage, { LegalSection } from "@/components/LegalPage";

export default function ResponsibleGaming() {
  return (
    <LegalPage
      title="Responsible Gaming"
      subtitle="Munymo is designed to be engaging. Engaging is good. Obsessive is less good. Here is how we think about keeping the balance right."
      lastUpdated="June 2025"
    >
      <LegalSection title="Our Approach">
        <p>
          Munymo is a daily game. The clue is in the word "daily" — there is one game per day,
          results are published once, and then it is done until tomorrow. The structure of the game
          is intentionally limited. You cannot play for six hours straight. You can play for about
          five minutes, and then you have to wait like everyone else.
        </p>
        <p>
          That said, we are aware that competitive games — even well-designed, time-limited ones —
          can become a source of anxiety or compulsive behaviour for some people. We take that
          seriously, and this page exists because of it.
        </p>
      </LegalSection>

      <LegalSection title="The Streak Mechanic">
        <p>
          Munymo tracks consecutive days of play as a "streak." Streaks are rewarded because
          consistency is a genuine marker of engagement and discipline. However, we also know that
          streak mechanics can create unhealthy pressure — the feeling that missing a day means
          losing something important.
        </p>
        <p>
          This is why Munymo includes Away Status. If you need to step away — for a holiday, an
          illness, a busy week, or simply because you want to — you can activate Away Status to
          protect your streak without playing. Your streak is yours. It should not own you.
        </p>
      </LegalSection>

      <LegalSection title="Munymo Is Not Gambling">
        <p>
          Munymo does not involve wagering money. There are no financial stakes, no prizes with
          monetary value, and no mechanism by which you can lose money by playing. Your score is
          a number. Your leaderboard position is a ranking. Neither has any financial consequence.
        </p>
        <p>
          We make this point clearly because the subject matter — stock markets — is adjacent to
          real financial activity. Playing Munymo is not the same as trading stocks, and the
          skills developed here, while genuinely useful, do not constitute financial expertise.
          Please do not confuse the two.
        </p>
      </LegalSection>

      <LegalSection title="Healthy Engagement">
        <p>
          We want Munymo to be a positive part of your day — something you look forward to, learn
          from, and enjoy. Here are some signs that your relationship with the game is healthy:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>You play once a day and move on</li>
          <li>Missing a day does not ruin your mood</li>
          <li>You find the research genuinely interesting, not just a means to a score</li>
          <li>You treat a losing streak as a learning opportunity, not a catastrophe</li>
        </ul>
        <p className="mt-3">
          And here are some signs worth paying attention to:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>You feel anxious or distressed when you cannot play</li>
          <li>Your mood is significantly affected by your score</li>
          <li>You are spending more time thinking about the game than you would like</li>
          <li>The game is affecting your sleep, work, or relationships</li>
        </ul>
        <p className="mt-3">
          If any of the second list resonates, please take a break. The game will be here when
          you come back. Your wellbeing is more important than your streak.
        </p>
      </LegalSection>

      <LegalSection title="Responsible Financial Thinking">
        <p>
          Because Munymo involves stock market content, we want to be explicit about one thing:
          the game is designed to develop analytical thinking, not to encourage speculative
          financial behaviour. If you find that playing Munymo is making you want to trade stocks
          more aggressively, or to take financial risks you would not otherwise take, please
          speak to a qualified financial adviser before acting on those impulses.
        </p>
        <p>
          Munymo teaches you to think more carefully about companies and markets. It does not
          teach you to be reckless with money. Those are very different things.
        </p>
      </LegalSection>

      <LegalSection title="If You Need Support">
        <p>
          If you are concerned about your relationship with any game or digital platform, the
          following organisations offer free, confidential support:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>
            <strong>GamCare</strong> (UK): <a href="https://www.gamcare.org.uk" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand)" }}>gamcare.org.uk</a> — 0808 8020 133
          </li>
          <li>
            <strong>National Problem Gambling Helpline</strong> (US): 1-800-522-4700
          </li>
          <li>
            <strong>Gambling Help Online</strong> (Australia): <a href="https://www.gamblinghelponline.org.au" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand)" }}>gamblinghelponline.org.au</a>
          </li>
        </ul>
        <p className="mt-3">
          We include these resources in the spirit of transparency. Munymo is not a gambling
          product, but we recognise that compulsive behaviour can attach itself to many things,
          and we would rather you had the information than not.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          If you have concerns about your use of Munymo, or if you would like to request account
          restrictions or deletion, please contact us through the platform. We will respond
          promptly and without judgement.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
