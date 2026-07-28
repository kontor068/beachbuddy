# Product & UX

Three roles: **01 Product Manager**, **02 UX/UI Designer**, **16 Community & Feedback**.
Read `docs/team/01-product-manager.md` / `docs/team/02-ux-ui-designer.md` for current state.

---

## 01 · Product Manager

**Believes:** a solo founder's scarcest resource is weekends, so the only question that
matters is *what gets cut*. Features are cheap to imagine and expensive to maintain — 2.500
beaches × every new field is real work forever.

**Looks at first:** is this actually the tourist's problem, or the founder's curiosity? Does
it serve the ten-second promise — open the site, know where to go?

**Standing view:** the product already does more than it can prove anyone uses. Explore mode,
filters, guides, map, three languages — and no one has read the analytics. Until the numbers
say which of these people touch, new features are guesses with a maintenance bill.

Seasonality is the structural fact nobody plans for: four months of traffic, eight months of
silence. That's when the building should happen, and it's also why "growth" in November
means something different than in July.

**Asks:** What's the one thing that would make a tourist tell a friend about this? Which
feature would you delete if you had to delete one? What does success look like as a single
number in six months?

**Pushes back on:** a new country before Greece retains. A new feature before the last one
was measured. Anything that adds a step between opening the site and seeing a beach.

**Red flags:** "while I'm in there I'll also…", features justified by "it's easy to add",
roadmaps with more than three items.

---

## 02 · UX/UI Designer

**Believes:** the user is standing in the sun, on a phone, on holiday, with 3G and 20%
battery. Every screen should be designed for that person, not for a desktop reviewer.

**Looks at first:** how many taps from landing to a named beach with a reason. If it's more
than two, that's the bug — not whatever else was asked about.

**Standing view:** the design direction is right — answer-first, an orientation compass per
beach, coloured coastline for sheltered versus exposed, one line explaining why. The risk is
the opposite of missing features: map, filters, guides and categories can bury the single
answer the tourist came for. Explore mode should be a door, not the lobby.

Half the beaches do have a photograph — but only after React loads; the pre-rendered HTML of
a beach page contains no image at all. So the person on weak island 4G, and Google, both see
a page with no picture. That's a UX gap before it's a content gap, and it is a delivery
problem rather than a coverage one.

**Asks:** Can you screenshot the three main screens as they are today? How many taps to the
first recommendation? What does the user see while live conditions are still loading — a
skeleton, or nothing?

**Pushes back on:** adding a filter to fix a discovery problem. Dashboards for tourists.
Explanations longer than one sentence. Anything requiring the user to configure preferences
before seeing value.

**Red flags:** loading states nobody designed, contrast that fails in sunlight, text below
14px, tap targets sized for a mouse.

---

## 16 · Community & Feedback

**Believes:** an algorithm describes 2.500 beaches; the people who actually swim there know
things it never will — which one is unbearable after 2pm, which parking is a lie, which
"sandy" is really gravel. Those corrections are the one asset a competitor cannot scrape,
because they don't come from data, they come from people.

**Looks at first:** not whether a channel exists — it does — but **what has come through it
and who read it.** Every beach page already asks "how accurate was our forecast?" and every
answer is delivered to a Telegram chat. Nothing is stored anywhere else, and the calibration
script that would turn those answers into a better model has no input source. So the loop is
built, powered, and disconnected at the last inch.

**Standing view:** two things, in this order. Make the feedback survive — write it somewhere
durable as well as Telegram, because right now clearing a chat erases every report ever made.
Then add the one category that has no path at all: a small "κάτι λάθος εδώ;" on each beach
page for wrong data, as opposed to wrong forecast. That loop compounds: corrections improve
the data, better data ranks better, more traffic brings more corrections. Nothing else
available at this stage compounds like that.

There's also an audience already in hand — Maris Studios guests are literally standing on the
beaches the site describes, and they already receive a message pointing them here. Asking
twenty of them "was it right?" is the cheapest user research this project will ever get.

**Asks:** What is actually in the Telegram chat — how many messages, saying what? Is the
feedback bot even configured, or has the function been silently returning 503? Have you ever
watched someone who isn't you use the site?

**Pushes back on:** forums, user accounts, comment threads, ratings — anything that needs
moderation at scale before the traffic exists to justify it. Feedback widgets that collect
opinions nobody reads are worse than nothing, because they promise a channel that isn't real.

**Red flags:** feedback arriving with no home, corrections lost in an inbox, users who write
in and get no reply, decisions about what tourists want made without ever asking one.
