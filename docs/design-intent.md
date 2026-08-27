# Depth Rush — Design Intent

**Target players.** Mobile arcade players who already run Subway Surfers, Temple Run or Alto's
Odyssey, plus players who enjoy light resource tension. One thumb, portrait, a single run of a
few minutes, no reading-heavy onboarding, ages 10+. The context is a commute, a queue, or a
break with the phone in one hand.

**Concept.** Your boat is wrecked, five of its parts are scattered across the seabed, and a
storm makes landfall in eight minutes. Dive, drill rocks open, haul parts back to the hull and
fit them before the weather arrives. Every second underwater is a bet against your air, and
every second spent fitting a part is a second not spent finding the next one.

**Core loop.** The run alternates between two places and one clock. On the boat you can dive,
or hold Repair to fit what you are carrying. Underwater you swim on a virtual stick, push into
rocks to drill them open, collect parts and gear, and dodge patrolling sharks. Swimming back to
the hull surfaces you and refills your tank. The storm timer runs in both places — that is the
whole design. Fit all five parts and the boat sails; that is the win. The run ends early if
your air runs out, a shark catches you, or the storm lands.

**What's in the prototype.** One Three.js seabed with a portrait camera; joystick movement;
oxygen with its base, drill and boost drain rates; the eight-minute clock with the water
darkening over the last ninety seconds; per-run randomised placement of parts, rocks, spare
tanks, fins, floodlights and sharks; a five-item checklist and a ship progress bar;
hold-to-repair; two sharks that patrol and chase; a boost burst with a cooldown; a marker
pointing at the nearest part still out there; the win state with the boat pulling away; and a
score breakdown with a local best. Sound is synthesised at runtime. Art is deliberately flat
and placeholder-grade — this exists to prove the loop feels good, not to look finished.

**Three choices worth naming.** First, drilling has no button: you push the stick into a rock
and hold, which keeps one control underwater and means the action cannot fire by accident.
Second, repair is a hold rather than a tap, so the seconds it costs are felt against a visibly
running clock instead of deducted off-screen. Third, nothing carries between runs. Progression
happens *within* a dive — a floodlight makes the next dark pocket readable, fins make every
later swim cheaper in air, a spare tank buys the time to risk one more drill — and then it is
gone.

**Future vision.** More biomes with hazards of their own; a meta-currency funding permanent
upgrades to tank size, fin speed, drill speed and sonar range; daily seeded runs, leaderboards
and ghost replays; a light narrative layer of stranded divers to rescue; storm escalation with
lightning that scrambles the sonar; colourblind-safe HUD states; rewarded-ad continues and
cosmetic-only purchases, never pay-to-win.
