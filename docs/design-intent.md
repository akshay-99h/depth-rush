# Depth Rush — Design Intent

**Target players.** Mobile arcade players who already run Subway Surfers or Alto's Odyssey, plus
players who enjoy light resource tension. Portrait, one phone, a few minutes per dive, ages 10+.
The context is a commute or a queue.

**Concept.** A salvage diver works a wreck site with eight minutes before the storm lands. Air is
the currency: it drains while you work, refills only at the surface, and the swim back always costs
more than you think. Every dive is a bet on how much you can finish before you have to go up.

**Core loop.** Three jobs share every underlying system — swimming, air, the storm clock, sonar,
enemies — and differ in the shape of the trip they ask for. *Salvage*: search the bed, carry parts
home, fit them. *Survey*: load beacons at the boat, carry them out, plant them on marked anchors.
*Cargo*: one crate at a time, slowed and burning air faster, so it is many trips and no batching.
Each of three biomes runs all three jobs, so a biome teaches the full set and the deeper biomes
re-test them in worse water.

**Learning objective.** Every dive is framed as a training exercise and names the skill it drills:
air discipline, trip planning, load handling, search pattern, reserve management, threat avoidance,
light discipline, dead reckoning, endurance. Each one is *measured* against real gameplay data —
lowest tank reading, number of dives taken, animal contacts, percentage of the site swept — and the
end-of-run debrief reports what you achieved against the target and whether you met it. It is a
secondary goal worth a score bonus, never a gate, so it teaches without blocking.

**Controls.** Left stick swims relative to where you are looking; a right-hand eye stick turns your
head. Swimming follows your pitch, so looking down and pushing forward takes you down — there is no
separate ascend control. Boost sits between them. For players who find two sticks too much, tilt-to-swim
drives movement from the phone's own orientation and re-centres on every dive.

**What's in the prototype.** Nine dives across three biomes, all unlocked, spanning 26m to 40m across
and 20m to 60m deep. Three enemy types with genuinely different threat models: sharks hunt and kill
and only boost breaks a pursuit; squid ambush and tear air out of the tank rather than killing;
jellies never hunt at all but sting and stall anything that drifts into them. Depth darkens the water
for real — fog, ambient and sun all fall off, and your lamp is what pushes back. A top-down sonar plot
with fog of war and a depth gutter. From the deck you can orbit the view and pan the camera out over
the site to plan a route before going in.

**Future vision.** Permanent upgrades to tank, fins and lamp; daily seeded dives with leaderboards
and ghost replays; storm escalation that scrambles the sonar; colourblind-safe HUD states;
rewarded-ad continues and cosmetic-only purchases, never pay-to-win.
