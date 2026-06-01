# Beach Data Full Audit Tracker

Purpose: track the full island-by-island beach data audit for filter-facing attributes.

Scope for each region:
- terrain: fine sand, coarse sand, pebbles, stones, rocks
- access: asphalt, passable dirt road, difficult road wording, hiking path, boat-only
- amenities: organized, sunbeds, umbrellas, parking, shower, WC, natural shade
- food/drink: keep taverna, restaurant/cafe, and beach bar/beach club separate
- safety/services: lifeguard only when source-backed and usually seasonal
- experience filters: quiet, remote, family friendly, snorkeling
- wording: no unsupported calm/protected/safe/ideal claims

Rules:
- Unknown is better than false certainty.
- Do not use "4x4 only" in user-facing labels unless strictly verified.
- Access difficulty is based on the full route to the shoreline, not only the road to parking. A good road to parking followed by a steep, rocky, exposed, cliff-side, or otherwise difficult descent/path should be recorded as difficult access, not easy access.
- Do not mark a beach as quiet when it has a beach bar.
- Beach bar requires explicit beach bar, beach club, or equivalent source text.
- Tavernas/restaurants/cafes are not beach bars.
- Lifeguard claims must be source-backed and should be marked seasonal when relevant.

Completed in this cycle:
- Milos
- Paros
- Naxos
- Santorini
- Ios
- Rhodes
- Crete Chania
- Crete Lasithi
- Crete Rethymno
- Crete Heraklion
- Gavdos
- Zakynthos
- Halkidiki mainland
- Andros
- Kimolos
- Mykonos
- Sifnos
- Serifos
- Aegina
- Agistri
- Hydra
- Poros
- Spetses
- Corfu
- Kefalonia
- Lefkada
- Paxos
- Antipaxos
- Othonoi
- Erikoussa
- Mathraki
- Meganisi
- Ithaca
- Skyros
- Alonissos
- Skiathos
- Skopelos
- Thasos
- Samothraki
- Chios
- Psara
- Oinousses
- Ikaria
- Fournoi
- Lesvos
- Samos
- Agios Efstratios
- Lemnos
- Amorgos
- Anafi
- Antiparos
- Folegandros
- Kea
- Kythnos
- Sikinos
- Syros
- Tinos
- Donousa
- Koufonisia
- Schinoussa
- Iraklia
- Polyaigos
- Agathonisi
- Astypalaia
- Halki
- Kalymnos
- Karpathos
- Kastellorizo
- Kos
- Leros
- Lipsi
- Nisyros
- Patmos
- Symi
- Tilos
- Kasos
- Pserimos
- Telendos
- Arki
- Marathi
- Kythira
- Methana
- Salamina
- Evia

Pending island regions:
- None

Suggested batch order:
1. High-tourism Ionian: Corfu, Kefalonia, Lefkada, Paxos/Ithaca/Meganisi
2. High-tourism North Aegean/Sporades: Thasos, Skiathos, Skopelos, Alonissos, Samos, Chios, Lesvos
3. High-tourism Dodecanese remaining: Kos, Karpathos, Kalymnos, Patmos, Leros, Symi, Astypalaia
4. Remaining Cyclades: Tinos, Syros, Kea, Kythnos, Antiparos, Amorgos, Folegandros, Anafi, Sikinos, Koufonisia, Schinoussa, Donousa, Iraklia
5. Attica islands and smaller islands: Aegina, Agistri, Hydra, Poros, Spetses, Kythira, Salamina, Methana, plus small Dodecanese/North Aegean islands
