import LegalPage, { LegalSection } from "@/components/LegalPage";

export default function Disclaimer() {
  return (
    <LegalPage
      title="Disclaimer"
      subtitle="The short version: Munymo is a game. Nothing here is financial advice. Please do not bet your retirement savings on the outcome of a daily stock prediction game. That would be inadvisable."
      lastUpdated="June 2025"
    >
      <LegalSection title="Not Financial Advice">
        <p>
          Nothing on Munymo — not the game matchups, not the research summaries, not the scoring
          results, not the leaderboard, not the commentary, not the MunyIQ score, and not anything
          else on this platform — constitutes financial advice, investment advice, trading advice,
          or any other form of advice regulated by financial services law.
        </p>
        <p>
          Munymo is designed to educate and to entertain. It is a structured way to develop market
          intuition and research habits. It is not a signal service, a tipsheet, or a substitute for
          professional financial guidance.
        </p>
      </LegalSection>

      <LegalSection title="For Educational Purposes Only">
        <p>
          The companies featured in Munymo's daily matchups are selected for their educational value
          — to illustrate sector dynamics, market behaviour, and the relationship between publicly
          available information and stock performance. Their inclusion in the game does not represent
          an endorsement, a recommendation to buy or sell, or any view on their investment merit.
        </p>
        <p>
          The research summaries provided alongside each matchup are curated for educational context.
          They are not comprehensive analyses, and they should not be treated as such. Real investment
          decisions require far more depth, professional expertise, and individual circumstance than
          any game can provide.
        </p>
      </LegalSection>

      <LegalSection title="Past Performance">
        <p>
          As anyone who has ever read a fund prospectus knows, past performance is not indicative of
          future results. This applies equally to Munymo. A strong MunyIQ score or a high leaderboard
          ranking reflects skill at playing this particular game — it does not predict future market
          performance, and it does not qualify you as a financial analyst.
        </p>
        <p>
          We say this not to diminish what a high score represents — genuine analytical skill and
          research discipline are genuinely valuable — but to be clear about what it does and does
          not mean in a financial context.
        </p>
      </LegalSection>

      <LegalSection title="Market Data">
        <p>
          Munymo uses publicly available market data to determine game results. We make reasonable
          efforts to ensure this data is accurate, but we cannot guarantee that it is free from
          errors, delays, or omissions. In the event of a data error, we reserve the right to
          void or adjust the affected game.
        </p>
        <p>
          Market data is provided for informational purposes only. Munymo is not a data provider
          and does not warrant the accuracy or completeness of any market information displayed on
          the platform.
        </p>
      </LegalSection>

      <LegalSection title="No Liability for Investment Decisions">
        <p>
          If you make any investment decision — in any asset, at any time — based on anything you
          have seen, read, or experienced on Munymo, that decision is entirely your own. Munymo,
          its operators, and its contributors accept no liability whatsoever for any financial loss
          or gain arising from such decisions.
        </p>
        <p>
          We genuinely hope Munymo makes you a sharper thinker about markets. We equally genuinely
          hope you consult a qualified financial adviser before doing anything consequential with
          your money.
        </p>
      </LegalSection>

      <LegalSection title="Third-Party Content">
        <p>
          Munymo may reference or link to third-party sources, publications, or data. We do not
          endorse these sources and are not responsible for their content, accuracy, or availability.
          Links to external sites are provided for convenience only.
        </p>
      </LegalSection>

      <LegalSection title="Regulatory Status">
        <p>
          Munymo is not regulated by any financial services authority. It is not authorised to
          provide investment advice, manage assets, or operate as a financial intermediary. If you
          are looking for regulated financial services, please consult an appropriately authorised
          professional.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
