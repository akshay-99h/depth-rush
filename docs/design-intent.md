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

**Controls.** Two, because it is a phone. The diver moves on a vertical plane — the stick maps
straight onto it, so push up and you go up — while the world stays fully 3D around you and animals
swim through it in depth. Nothing needs aiming, so there is no camera to manage. Boost is the only
other button. Tilt-to-swim can replace the stick outright for players who prefer it.

**What's in the prototype.** Nine dives across three biomes, all unlocked, spanning 26m to 40m
across and 20m to 60m deep. Three enemy types with genuinely different threat models: sharks hunt
and kill, and only boost breaks a pursuit; squid ambush and tear air out of the tank rather than
killing; jellies never hunt but sting and stall anything that drifts into them. Depth darkens the
water for real — fog, ambient and sun all fall off, and your lamp pushes back. A top-down sonar plot
with fog of war. From the deck you can orbit and pan the camera over the site to plan a route.

**Future vision.** Permanent upgrades to tank, fins and lamp; daily seeded dives with leaderboards
and ghost replays; storm escalation that scrambles the sonar; colourblind-safe HUD states;
rewarded-ad continues and cosmetic-only purchases, never pay-to-win.
