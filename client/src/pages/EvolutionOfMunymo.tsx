import PublicLayout from "@/components/PublicLayout";
import { Link } from "wouter";
import { SignInButton } from "@clerk/clerk-react";
import { useAuth } from "@/_core/hooks/useAuth";

function Section({ id, label, title, children }: {
  id: string;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="py-12 border-b" style={{ borderColor: "var(--color-border)" }}>
      <p className="section-label mb-3">{label}</p>
      <h2 className="font-display mb-6" style={{ color: "var(--color-foreground)" }}>
        {title}
      </h2>
      <div className="space-y-5 text-base leading-relaxed max-w-3xl" style={{ color: "var(--color-muted)" }}>
        {children}
      </div>
    </section>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="my-6 px-5 py-4 rounded-xl text-sm leading-relaxed"
      style={{
        background: "var(--color-brand-muted)",
        borderLeft: "3px solid var(--color-brand)",
        color: "var(--color-foreground)",
      }}
    >
      {children}
    </div>
  );
}

export default function EvolutionOfMunymo() {
  const { isAuthenticated } = useAuth();

  return (
    <PublicLayout>
      {/* Hero */}
      <div className="border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="container py-14 md:py-20">
          <div className="max-w-3xl">
            <p className="section-label mb-4">The Story</p>
            <h1 className="font-display mb-5" style={{ color: "var(--color-foreground)", lineHeight: 1.1 }}>
              The Evolution of Munymo
            </h1>
            <p className="text-lg leading-relaxed mb-6" style={{ color: "var(--color-muted)" }}>
              How a simple question — "why don't more people understand markets?" — turned into a
              daily game, a scoring system, a research archive, and an intelligence score that does
              not yet exist but absolutely will.
            </p>
            <p className="text-sm" style={{ color: "var(--color-subtle)" }}>
              A detailed account of the thinking behind every decision. Grab a coffee.
            </p>
          </div>
        </div>
      </div>

      <div className="container">

        {/* 1 — The Problem */}
        <Section id="the-problem" label="Chapter 1" title="The Problem With Financial Education">
          <p>
            Financial literacy is one of those things that everyone agrees is important and almost
            nobody does anything useful about. Schools teach fractions and Shakespeare. They do not
            teach compound interest, balance sheets, or why a company's share price might move 8%
            on an earnings call. By the time most people encounter the stock market — usually when
            they get their first pension statement and realise they should probably understand what
            it says — the gap between what they know and what they need to know is enormous.
          </p>
          <p>
            The existing solutions are not great. Financial news is written for people who already
            know what they are reading. Investment courses are either too basic to be useful or too
            technical to be approachable. YouTube has plenty of content, but it ranges from
            genuinely educational to actively dangerous, and it is not always obvious which is which.
          </p>
          <p>
            The deeper problem is that financial intelligence is not something you can acquire by
            reading about it. It is a skill. And skills are developed through practice — through
            making decisions, seeing outcomes, and adjusting your thinking accordingly. The trouble
            is that practising with real money is expensive, and practising with fake money in a
            simulator does not feel real enough to engage the same cognitive processes.
          </p>
          <p>
            Munymo was built to solve this. Not by teaching finance in the traditional sense, but
            by creating a structured environment in which you develop financial intuition through
            repetition, feedback, and just enough competitive pressure to keep you honest.
          </p>
        </Section>

        {/* 2 — The Game Concept */}
        <Section id="the-concept" label="Chapter 2" title="Why a Game?">
          <p>
            The decision to build a game rather than a course or a tool was deliberate. Games have
            properties that educational content does not: they are intrinsically motivating, they
            provide immediate feedback, they create a sense of progression, and — crucially — they
            make you care about the outcome.
          </p>
          <p>
            When you care about the outcome, you pay attention. When you pay attention, you learn.
            This is not a novel insight — it is the entire basis of gamification — but it is
            frequently applied badly, in ways that prioritise engagement metrics over genuine skill
            development. Munymo tries to do it properly.
          </p>
          <p>
            The specific game format — two companies, one prediction, one result — was chosen for
            its simplicity and its depth. The binary choice is simple enough that anyone can play
            without prior knowledge. But the factors that determine a correct prediction are
            genuinely complex: sector dynamics, recent news, relative valuation, management quality,
            macroeconomic context. The game is easy to start and hard to master. That is exactly
            where you want to be.
          </p>
          <Callout>
            The name "Munymo" is a portmanteau of "money" and "dynamo" — the idea of financial
            energy in motion. It is also short, memorable, and does not already belong to a bank.
            These things matter.
          </Callout>
        </Section>

        {/* 3 — The Two-Step Mechanic */}
        <Section id="two-step" label="Chapter 3" title="The Two-Step Mechanic: Gut First, Research Second">
          <p>
            The most distinctive feature of Munymo — and the one that took the longest to get right
            — is the two-step prediction process. Before you see any research, you make a gut
            selection. Then you read the research. Then you make your final, scored prediction.
          </p>
          <p>
            This sequence is not arbitrary. It is the entire point.
          </p>
          <p>
            The gut selection exists to capture your raw intuition — the snap judgement you make
            before you have had time to rationalise or second-guess yourself. This is valuable data,
            both for you and for the platform. Over time, the gap between your gut selections and
            your final predictions reveals something important: how much your research is actually
            changing your mind, and in which direction.
          </p>
          <p>
            If your gut is consistently right and your research consistently leads you away from
            the correct answer, that tells you something about the quality of your instincts and
            the quality of your research process. If the reverse is true, that tells you something
            different. If they usually agree, that tells you something else entirely. The data is
            only useful if the gut selection is made before the research is seen — which is why
            the order is enforced, not merely suggested.
          </p>
          <p>
            The research phase is where the education actually happens. The curated summaries are
            not designed to make the decision obvious — if they were, the game would be trivial.
            They are designed to give you the context a thoughtful analyst would consider: sector
            position, recent performance, relevant news, and the rationale for why this particular
            pairing is interesting. What you do with that information is up to you.
          </p>
          <p>
            The final prediction is your official scored pick. It is the decision you are prepared
            to stand behind after reflection. It may match your gut selection or it may not. Both
            outcomes are informative.
          </p>
        </Section>

        {/* 4 — Scoring */}
        <Section id="scoring" label="Chapter 4" title="The Scoring System: Why 80/20?">
          <p>
            The Daily Score is split between two components: 80 points for a correct final
            prediction, and 20 points for a correct answer to the validation question. A perfect
            day is 100 points.
          </p>
          <p>
            The 80/20 split was chosen to reflect the relative importance of the two skills being
            tested. Getting the prediction right is the primary objective — it requires judgement,
            pattern recognition, and the ability to synthesise information under uncertainty. It
            is worth more because it is harder and more consequential.
          </p>
          <p>
            The validation question tests something different: whether you actually engaged with
            the research. It is a single question drawn from the day's research content, designed
            to be answerable by anyone who read carefully and unanswerable by anyone who did not.
            The 20 points it carries are not trivial — over a long period, the difference between
            a player who consistently answers the validation question correctly and one who does
            not is significant. It rewards the habit of reading, not just the habit of guessing.
          </p>
          <Callout>
            All scores are calculated server-side after results are published. This is not a
            technical detail — it is a design principle. It means no score can be manipulated,
            gamed, or disputed. The number is the number. You either got it right or you did not.
          </Callout>
          <p>
            The validation question also serves a secondary purpose: it creates a moment of
            accountability. You cannot claim to have "read the research" if you cannot answer a
            basic question about it. The 20 points are, in a sense, a honesty tax.
          </p>
        </Section>

        {/* 5 — Pairing Logic */}
        <Section id="pairing" label="Chapter 5" title="The Art of the Matchup">
          <p>
            Choosing which two companies to pair on a given day is the most labour-intensive part
            of running Munymo. It is also, arguably, the most important. A bad matchup — one where
            the outcome is obvious, or where the companies have nothing meaningful in common — is
            not just boring. It is a missed educational opportunity.
          </p>
          <p>
            Good matchups share a sector. This is non-negotiable. Comparing a pharmaceutical company
            to a logistics firm tells you almost nothing useful about either. Comparing two
            pharmaceutical companies tells you a great deal about both — about their relative
            pipeline strength, their regulatory exposure, their pricing power, and the dynamics of
            the sector they share. The sector constraint forces the comparison to be meaningful.
          </p>
          <p>
            Within that constraint, good matchups have genuine tension. Both companies should have
            a plausible case for outperformance. If one company is obviously superior in every
            relevant dimension, the game reduces to a test of basic research literacy rather than
            genuine analytical judgement. The best matchups are the ones where thoughtful people
            disagree — where the research supports both sides and the outcome is genuinely uncertain.
          </p>
          <p>
            The curation process also considers educational value. Some matchups are chosen because
            they illustrate a specific concept — the difference between revenue growth and margin
            expansion, for example, or the impact of currency exposure on international earnings.
            Others are chosen because they reflect something happening in the real world: a sector
            rotation, a regulatory change, a macroeconomic shift. The game is a lens through which
            to understand markets, not just a competition.
          </p>
        </Section>

        {/* 6 — Streaks */}
        <Section id="streaks" label="Chapter 6" title="Streaks, Consistency, and Away Status">
          <p>
            Streaks are tracked because consistency is a genuine marker of quality. A player who
            has played 200 consecutive days has demonstrated something that a player who has played
            200 games over three years has not: the discipline to show up every day, regardless of
            how the previous day went. That is a real skill, and it deserves recognition.
          </p>
          <p>
            The streak mechanic also creates a natural incentive to engage with the research on
            days when you might otherwise skip it. When there is something at stake — even something
            as intangible as a number on a screen — you pay more attention. This is not manipulation;
            it is motivation design.
          </p>
          <p>
            Away Status exists because life is not always cooperative. Holidays happen. Illnesses
            happen. Weeks where you simply cannot find five minutes happen. The streak mechanic
            should reward consistency, not punish the existence of a personal life. Away Status
            allows you to protect your streak for a defined period without playing, at the cost of
            not earning points during that period. It is a deliberate trade-off: you keep your
            streak, but you do not get credit for days you did not play. That seems fair.
          </p>
        </Section>

        {/* 7 — Leaderboard */}
        <Section id="leaderboard" label="Chapter 7" title="The Leaderboard: Why 20 Games to Qualify?">
          <p>
            The leaderboard requires 20 games before a player qualifies for ranking. This threshold
            was chosen for a specific reason: 20 games is enough to distinguish skill from luck.
          </p>
          <p>
            In any binary prediction game, a player can achieve a high success rate over a small
            number of games purely by chance. With 5 games, a 100% success rate is not particularly
            impressive — it happens by accident roughly 3% of the time. With 20 games, a 100%
            success rate is extraordinary. With 20 games, even an 80% success rate is statistically
            meaningful. The 20-game threshold ensures that the leaderboard reflects genuine
            performance, not a lucky streak.
          </p>
          <p>
            The leaderboard ranks players by their cumulative score, which rewards both accuracy
            and research engagement over time. A player who scores 100 every day will always
            outrank a player who scores 80 every day, regardless of how many games they have
            played. The ranking is a function of quality, not just quantity.
          </p>
        </Section>

        {/* 8 — Research Hub */}
        <Section id="research-hub" label="Chapter 8" title="The Research Hub: Why Keep the Archive?">
          <p>
            Every game that has been played on Munymo is preserved in the Research Hub. This was
            not an afterthought — it was a design decision made at the outset, for a specific reason.
          </p>
          <p>
            The research summaries prepared for each matchup are genuinely educational. They
            represent a curated view of two companies at a specific point in time, in the context
            of their sector and the broader market. That context does not become less valuable
            because the game has ended. If anything, it becomes more valuable — because you can
            now see the outcome and work backwards to understand why it happened.
          </p>
          <p>
            The Research Hub is, in effect, a growing library of case studies. Each entry is a
            small lesson in how markets work, how companies compete, and how publicly available
            information relates to price performance. Over time, it will become one of the most
            valuable parts of the platform — not because of its breadth, but because of its
            specificity. These are not generic lessons about "how to invest." They are specific
            analyses of specific companies on specific days, with outcomes attached.
          </p>
        </Section>

        {/* 9 — MunyIQ */}
        <Section id="munyiq" label="Chapter 9" title="MunyIQ: The Score That Does Not Exist Yet">
          <p>
            MunyIQ is the long-term vision for what Munymo measures. It is a composite intelligence
            score — a single number that reflects the full picture of your performance across all
            the dimensions the game tracks: instinct accuracy, research engagement, prediction
            accuracy, consistency, and improvement over time.
          </p>
          <p>
            The reason it does not exist yet is that it requires data. A meaningful composite score
            needs a meaningful sample size — enough games to distinguish genuine patterns from
            noise. The threshold for MunyIQ calculation will be set at a level that ensures the
            score is statistically robust, not just numerically interesting.
          </p>
          <p>
            The tiered credential system — Sapphire, Emerald, Ruby, Diamond — is designed to give
            MunyIQ meaning beyond the platform. A Diamond MunyIQ of 140+ will represent something
            genuinely rare: a player who has demonstrated, over hundreds of games, that their
            analytical judgement is in the top fraction of a percent of all participants. That is
            a credential worth having, and worth displaying.
          </p>
          <p>
            The IQ framing is deliberate. Financial intelligence is a real thing — it is measurable,
            it is improvable, and it correlates with outcomes in the real world. Munymo is building
            the infrastructure to measure it properly. MunyIQ is what that measurement looks like
            when it is done.
          </p>
        </Section>

        {/* 10 — What Munymo Is Not */}
        <Section id="what-it-is-not" label="Chapter 10" title="What Munymo Is Not">
          <p>
            It is worth being explicit about this, because the subject matter invites confusion.
          </p>
          <p>
            Munymo is not a trading platform. You cannot buy or sell anything here. There is no
            portfolio, no watchlist, no order book, and no brokerage integration. If you want to
            trade stocks, you will need to go somewhere else. We will not be offended.
          </p>
          <p>
            Munymo is not financial advice. Nothing on this platform — not the research summaries,
            not the scoring results, not the MunyIQ score — should be interpreted as a
            recommendation to buy, sell, or hold any security. Please see the Disclaimer for the
            full legal version of this statement, and please take it seriously.
          </p>
          <p>
            Munymo is not a gambling product. There is no money at stake. You cannot win money,
            and you cannot lose money. The competitive element is real, but it is entirely
            contained within the platform. A high leaderboard ranking is satisfying. It is not
            financially valuable.
          </p>
          <p>
            What Munymo is, is a game that takes financial education seriously. It is built on the
            belief that the best way to develop market intuition is to make predictions, see
            outcomes, and reflect on the gap between the two — repeatedly, over time, with
            structure and feedback. Everything else is in service of that.
          </p>
        </Section>

        {/* 11 — Where It Is Going */}
        <Section id="future" label="Chapter 11" title="Where It Goes From Here">
          <p>
            Munymo is early. The core game is built and working. The scoring system is live. The
            Research Hub is growing. The leaderboard is filling up. But the full vision is larger
            than what exists today.
          </p>
          <p>
            MunyIQ is the next major milestone. When it launches, it will transform Munymo from a
            game into something closer to a credential — a verifiable, portable measure of financial
            analytical ability. The tiered card system (Sapphire through Diamond) will give that
            credential a visual identity that players can share and that means something to anyone
            who understands what it represents.
          </p>
          <p>
            Beyond MunyIQ, the Research Hub will grow into a structured learning resource — not
            just an archive, but a curated curriculum built from real market events. The game
            itself will evolve: new formats, new sectors, new types of matchup. The community
            around the leaderboard will develop its own culture and its own stories.
          </p>
          <p>
            The long-term goal is simple to state and hard to achieve: to make Munymo the place
            where people go to develop genuine financial intelligence. Not to get rich quick. Not
            to follow tips. To actually understand how markets work, and to have the track record
            to prove it.
          </p>
          <p>
            That is worth building. So we are building it.
          </p>
        </Section>

        {/* CTA */}
        <div className="py-16 text-center">
          <h3 className="font-display mb-4" style={{ color: "var(--color-foreground)" }}>
            Ready to start building yours?
          </h3>
          <p className="text-base mb-8 max-w-md mx-auto" style={{ color: "var(--color-muted)" }}>
            One game a day. Five minutes of your time. A track record that compounds.
          </p>
          {isAuthenticated ? (
            <Link href="/game" className="btn-gold text-sm px-8 py-3">
              Play Today's Game
            </Link>
          ) : (
            <SignInButton mode="modal">
              <button className="btn-gold text-sm px-8 py-3">
                Start Playing Free
              </button>
            </SignInButton>
          )}
        </div>

      </div>
    </PublicLayout>
  );
}
