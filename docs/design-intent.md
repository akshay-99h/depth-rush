# Depth Rush — Design Intent

**Target players.** Mobile arcade players who already run Subway Surfers, Temple Run, or Alto's
Odyssey, plus players who enjoy light resource tension (Don't Starve-lite). One thumb, portrait,
90 seconds to 5 minutes per run, no reading-heavy onboarding, ages 10+. The context is a commute,
a queue, or a break with the phone in one hand.

**Concept.** Your ship is wrecked, its parts scattered across the seabed, and a storm is five
minutes from landfall. Dive, scavenge gear and salvage, dodge sharks, and race the clock back to
the ship — every second underwater is a bet against your oxygen. The seabed reshuffles every run,
so the only way to beat your last score is to dive again.

**Core loop.** Descend on a sonar bearing, drill rocks open, collect parts and gear, evade sharks,
and swim back to the ship to auto-repair and bank the score. Three inputs carry the game: tap to
swim toward a point, hold on a rock to drill it, and a BOOST button that breaks a shark's pursuit. Oxygen drains continuously,
at double rate while drilling and triple while boosting, so every action prices itself in air.
A run ends when oxygen hits zero, a shark catches you, or the storm timer reaches 0:00 — all three
resolve to the same Game Over with a score breakdown and a retry.

**What's in the prototype.** One seabed scene in Three.js with a portrait camera; tap-to-swim
movement with procedural bob and tilt; the oxygen system with its three drain multipliers; the
five-minute storm timer with late-game darkening and HUD pulse; per-run randomized placement of
parts, drillable rocks, spare tanks, fins, floodlights and shark lanes; a directional sonar bearing;
hold-to-drill with a fill ring; fins as a per-run speed stack and floodlights as a per-run vision
stack; two sharks with patrol and chase-if-close steering; the boost burst with its cooldown;
auto-repair on return; the unified Game Over; and the score formula with a local high score.
Art and audio are deliberately placeholder-grade — the prototype exists to prove the loop feels
good, not to look finished.

**Two design choices worth naming.** First, nothing carries over between runs. Progression happens
*within* a dive: a floodlight makes the next dark pocket readable, fins make every later swim
cheaper in oxygen, a spare tank buys the time to risk one more drill. Each pickup compounds the ones
before it, then it's gone. Second, score rewards proximity to danger rather than pure avoidance —
entering a shark's danger radius and escaping alive banks a close-call bonus. Playing safe works;
playing bold scores higher.

**Future vision.** More biomes with hazards of their own; a meta-currency funding permanent
upgrades to oxygen, fin speed, drill speed and sonar range; daily seeded runs, leaderboards and
ghost replays; a light narrative layer of stranded divers to rescue; storm escalation with
lightning that scrambles the sonar; colorblind-safe HUD states; rewarded-ad continues and
cosmetic-only purchases, never pay-to-win.
