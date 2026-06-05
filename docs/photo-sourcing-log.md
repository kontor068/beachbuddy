# Photo Sourcing Log

## Purpose

This document is the source of truth for tracking where each curated destination photo came from before it is added to the project. Every image must pass legal, location, and performance checks before it is placed in `public/images` or referenced in `src/data/photoRegistry.ts`.

## Strict Rules

- Do not use images from Google Images.
- Do not use images from Instagram.
- Do not use images from Booking, Airbnb, TripAdvisor, or random blogs unless explicit permission is documented.
- Do not use any image unless source, author, license, and usage rights are known.
- Do not present a generic destination photo as an exact beach photo unless verified.
- Do not add photos with unclear copyright status.

## Approved Sources

- Own photos.
- Partner/friend photos with written permission.
- Wikimedia Commons with checked license and attribution.
- Pexels with checked usage requirements.
- Pixabay with checked usage requirements.
- Unsplash with checked usage requirements.

## Image Optimization Rules

- Hero images: 1600x900, WebP, target 150-300KB.
- Card images: 800x600, WebP, target 50-120KB.
- Fallback images: 1200x800, WebP, target 100-220KB.
- Use width and height in registry later.
- Avoid heavy files.
- Avoid visible watermarks.
- Avoid close-up identifiable faces when possible.

## File Naming Rules

- Use descriptive, lowercase, hyphenated WebP filenames.
- Include destination and visible subject where possible.
- End filenames with the photo role: `-hero.webp`, `-card.webp`, or `-fallback.webp`.
- Do not use generic filenames such as `hero.webp`, `card.webp`, `fallback.webp`, `image-1.webp`, or `final.webp` for new curated photos.
- Example: `/images/destinations/milos/milos-sarakiniko-hero.webp`.

## Metadata Template

Destination:
Photo type:
Final file path:
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

## Phase 1 Destinations

### milos

#### hero
Destination: milos
Photo type: hero
Final file path: /images/destinations/milos/milos-sarakiniko-hero.webp
Original source: Wikimedia Commons
Source URL: https://commons.wikimedia.org/wiki/File:Sarakiniko_Beach_on_Milos_Island,_Greece_with_a_view_of_the_Aegean_Sea.jpg
Author: dronepicr
License: CC BY 2.0
Attribution required: yes
Verified location: yes
Usage label: Μήλος
Optimized dimensions: 1600x900
Optimized file size: 279.6KB
Registry ready: yes
Notes: Sarakiniko beach, strong destination hero candidate. Crop to 16:9.
Status: optimized / ready for registry

#### card
Destination: milos
Photo type: card
Final file path: /images/destinations/milos/milos-kleftiko-card.webp
Original source: Wikimedia Commons
Source URL: https://commons.wikimedia.org/wiki/File:Cliffs_and_rock_formations_at_Kleftiko_on_Milos_Island,_Greece.jpg
Author: dronepicr
License: CC BY 2.0
Attribution required: yes
Verified location: yes
Usage label: Μήλος
Optimized dimensions: 800x600
Optimized file size: 118.7KB
Registry ready: yes
Notes: Kleftiko cliffs and rock formations. Good visual variety for destination card.
Status: optimized / ready for registry

#### fallback
Destination: milos
Photo type: fallback
Final file path: /images/destinations/milos/milos-kleftiko-sea-caves-fallback.webp
Original source: Wikimedia Commons
Source URL: https://commons.wikimedia.org/wiki/File:Sea_caves_at_Kleftiko_on_Milos_Island,_Greece.jpg
Author: dronepicr
License: CC BY 2.0
Attribution required: yes
Verified location: yes
Usage label: Εικόνα από τη Μήλο
Optimized dimensions: 1200x800
Optimized file size: 217.9KB
Registry ready: yes
Notes: Kleftiko sea caves. Use only as destination/regional fallback, not as exact beach photo.
Status: optimized / ready for registry

### crete

#### hero
Destination: crete
Photo type: hero
Final file path: /images/destinations/crete/{descriptive-name}-hero.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### card
Destination: crete
Photo type: card
Final file path: /images/destinations/crete/crete-balos-beach-card.webp
Original source: Wikimedia Commons
Source URL: https://commons.wikimedia.org/wiki/File:Aerial_view_of_Balos_beach.jpg
Author: Simao Arinto
License: CC BY-SA 4.0
Attribution required: yes
Verified location: yes
Usage label: Κρήτη
Optimized dimensions: 800x600
Optimized file size: 118.4KB
Registry ready: yes
Notes: Balos beach aerial view. Strong Crete destination card candidate; cropped to 4:3.
Status: optimized / ready for registry

#### fallback
Destination: crete
Photo type: fallback
Final file path: /images/destinations/crete/{descriptive-name}-fallback.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### rhodes

#### hero
Destination: rhodes
Photo type: hero
Final file path: /images/destinations/rhodes/{descriptive-name}-hero.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### card
Destination: rhodes
Photo type: card
Final file path: /images/destinations/rhodes/rhodes-lindos-beach-card.webp
Original source: Wikimedia Commons
Source URL: https://commons.wikimedia.org/wiki/File:Rhodos_Lindos_Beach_R01.jpg
Author: Marc Ryckaert (MJJR)
License: CC BY 3.0
Attribution required: yes
Verified location: yes
Usage label: Ρόδος
Optimized dimensions: 800x600
Optimized file size: 101.6KB
Registry ready: yes
Notes: Lindos beach and harbour. Strong recognizable Rhodes destination card candidate.
Status: optimized / ready for registry

#### fallback
Destination: rhodes
Photo type: fallback
Final file path: /images/destinations/rhodes/{descriptive-name}-fallback.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### corfu

#### hero
Destination: corfu
Photo type: hero
Final file path: /images/destinations/corfu/{descriptive-name}-hero.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### card
Destination: corfu
Photo type: card
Final file path: /images/destinations/corfu/corfu-paleokastritsa-beach-card.webp
Original source: Wikimedia Commons
Source URL: https://commons.wikimedia.org/wiki/File:Corfu_Paleokastritsa_Beach_R01.jpg
Author: Marc Ryckaert (MJJR)
License: CC BY 3.0
Attribution required: yes
Verified location: yes
Usage label: Κέρκυρα
Optimized dimensions: 800x600
Optimized file size: 108KB
Registry ready: yes
Notes: Paleokastritsa main beach. Good destination card candidate for Corfu.
Status: optimized / ready for registry

#### fallback
Destination: corfu
Photo type: fallback
Final file path: /images/destinations/corfu/{descriptive-name}-fallback.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### zakynthos

#### hero
Destination: zakynthos
Photo type: hero
Final file path: /images/destinations/zakynthos/{descriptive-name}-hero.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### card
Destination: zakynthos
Photo type: card
Final file path: /images/destinations/zakynthos/zakynthos-navagio-beach-card.webp
Original source: Wikimedia Commons
Source URL: https://commons.wikimedia.org/wiki/File:Navagio_beach_Zakynthos_3.jpg
Author: kallerna
License: CC BY-SA 4.0
Attribution required: yes
Verified location: yes
Usage label: Ζάκυνθος
Optimized dimensions: 800x600
Optimized file size: 113.6KB
Registry ready: yes
Notes: Navagio beach / Shipwreck beach. Highly recognizable Zakynthos destination card candidate.
Status: optimized / ready for registry

#### fallback
Destination: zakynthos
Photo type: fallback
Final file path: /images/destinations/zakynthos/{descriptive-name}-fallback.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### kefalonia

#### hero
Destination: kefalonia
Photo type: hero
Final file path: /images/destinations/kefalonia/{descriptive-name}-hero.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### card
Destination: kefalonia
Photo type: card
Final file path: /images/destinations/kefalonia/kefalonia-myrtos-beach-card.webp
Original source: Wikimedia Commons
Source URL: https://commons.wikimedia.org/wiki/File:Myrtos_Beach,_Kefalonia.jpg
Author: Matt Sims
License: CC BY 2.0
Attribution required: yes
Verified location: yes
Usage label: Κεφαλονιά
Optimized dimensions: 800x600
Optimized file size: 101.6KB
Registry ready: yes
Notes: Myrtos Beach. Strong Kefalonia destination card candidate with exact Commons category.
Status: optimized / ready for registry

#### fallback
Destination: kefalonia
Photo type: fallback
Final file path: /images/destinations/kefalonia/{descriptive-name}-fallback.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### lefkada

#### hero
Destination: lefkada
Photo type: hero
Final file path: /images/destinations/lefkada/{descriptive-name}-hero.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### card
Destination: lefkada
Photo type: card
Final file path: /images/destinations/lefkada/lefkada-porto-katsiki-card.webp
Original source: Wikimedia Commons
Source URL: https://commons.wikimedia.org/wiki/File:Porto_Katsiki_Beach,_Lefkada,_Ionian_Islands,_Greece.jpg
Author: Dimitra Papadimitriou
License: CC BY-SA 4.0
Attribution required: yes
Verified location: yes
Usage label: Λευκάδα
Optimized dimensions: 800x600
Optimized file size: 116.7KB
Registry ready: yes
Notes: Porto Katsiki beach. Strong Lefkada destination card candidate; crop keeps cliff and beach readable.
Status: optimized / ready for registry

#### fallback
Destination: lefkada
Photo type: fallback
Final file path: /images/destinations/lefkada/{descriptive-name}-fallback.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### naxos

#### hero
Destination: naxos
Photo type: hero
Final file path: /images/destinations/naxos/{descriptive-name}-hero.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### card
Destination: naxos
Photo type: card
Final file path: /images/destinations/naxos/naxos-portara-sunset-card.webp
Original source: Wikimedia Commons
Source URL: https://commons.wikimedia.org/wiki/File:The_Portara_of_Naxos_at_Sunset.jpg
Author: Vasilismorfo
License: CC BY 4.0
Attribution required: yes
Verified location: yes
Usage label: Νάξος
Optimized dimensions: 800x600
Optimized file size: 95.8KB
Registry ready: yes
Notes: Portara of Naxos at sunset. Strong recognizable Naxos destination card candidate.
Status: optimized / ready for registry

#### fallback
Destination: naxos
Photo type: fallback
Final file path: /images/destinations/naxos/{descriptive-name}-fallback.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### paros

#### hero
Destination: paros
Photo type: hero
Final file path: /images/destinations/paros/{descriptive-name}-hero.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### card
Destination: paros
Photo type: card
Final file path: /images/destinations/paros/paros-kolymbithres-card.webp
Original source: Wikimedia Commons
Source URL: https://commons.wikimedia.org/wiki/File:Paros_Kolymbithres1_tango7174.jpg
Author: Tango7174
License: CC BY-SA 4.0
Attribution required: yes
Verified location: yes
Usage label: Πάρος
Optimized dimensions: 800x600
Optimized file size: 108.2KB
Registry ready: yes
Notes: Kolymbithres, Paros. Good destination card candidate; final crop/quality verified.
Status: optimized / ready for registry

#### fallback
Destination: paros
Photo type: fallback
Final file path: /images/destinations/paros/{descriptive-name}-fallback.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### mykonos

#### hero
Destination: mykonos
Photo type: hero
Final file path: /images/destinations/mykonos/{descriptive-name}-hero.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### card
Destination: mykonos
Photo type: card
Final file path: /images/destinations/mykonos/mykonos-chora-windmills-card.webp
Original source: Wikimedia Commons
Source URL: https://commons.wikimedia.org/wiki/File:Windmills_in_Mykonos_01.jpg
Author: Bernard Gagnon
License: CC BY-SA 4.0
Attribution required: yes
Verified location: yes
Usage label: Μύκονος
Optimized dimensions: 800x600
Optimized file size: 112.1KB
Registry ready: yes
Notes: Windmills in Mykonos. Recognizable Mykonos destination card candidate.
Status: optimized / ready for registry

#### fallback
Destination: mykonos
Photo type: fallback
Final file path: /images/destinations/mykonos/{descriptive-name}-fallback.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### santorini

#### hero
Destination: santorini
Photo type: hero
Final file path: /images/destinations/santorini/{descriptive-name}-hero.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### card
Destination: santorini
Photo type: card
Final file path: /images/destinations/santorini/santorini-oia-caldera-card.webp
Original source: Wikimedia Commons
Source URL: https://commons.wikimedia.org/wiki/File:Oia_-_Santorini_-_Greece_-_16.jpg
Author: Norbert Nagel
License: CC BY-SA 3.0
Attribution required: yes
Verified location: yes
Usage label: Σαντορίνη
Optimized dimensions: 800x600
Optimized file size: 118.2KB
Registry ready: yes
Notes: Oia seen from the caldera. Strong Santorini destination card candidate.
Status: optimized / ready for registry

#### fallback
Destination: santorini
Photo type: fallback
Final file path: /images/destinations/santorini/{descriptive-name}-fallback.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### samos

#### hero
Destination: samos
Photo type: hero
Final file path: /images/destinations/samos/{descriptive-name}-hero.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### card
Destination: samos
Photo type: card
Final file path: /images/destinations/samos/{descriptive-name}-card.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### fallback
Destination: samos
Photo type: fallback
Final file path: /images/destinations/samos/{descriptive-name}-fallback.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### skiathos

#### hero
Destination: skiathos
Photo type: hero
Final file path: /images/destinations/skiathos/{descriptive-name}-hero.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### card
Destination: skiathos
Photo type: card
Final file path: /images/destinations/skiathos/{descriptive-name}-card.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### fallback
Destination: skiathos
Photo type: fallback
Final file path: /images/destinations/skiathos/{descriptive-name}-fallback.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### skopelos

#### hero
Destination: skopelos
Photo type: hero
Final file path: /images/destinations/skopelos/{descriptive-name}-hero.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### card
Destination: skopelos
Photo type: card
Final file path: /images/destinations/skopelos/{descriptive-name}-card.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### fallback
Destination: skopelos
Photo type: fallback
Final file path: /images/destinations/skopelos/{descriptive-name}-fallback.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### thasos

#### hero
Destination: thasos
Photo type: hero
Final file path: /images/destinations/thasos/{descriptive-name}-hero.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### card
Destination: thasos
Photo type: card
Final file path: /images/destinations/thasos/{descriptive-name}-card.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### fallback
Destination: thasos
Photo type: fallback
Final file path: /images/destinations/thasos/{descriptive-name}-fallback.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### chalkidiki

#### hero
Destination: chalkidiki
Photo type: hero
Final file path: /images/destinations/chalkidiki/{descriptive-name}-hero.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### card
Destination: chalkidiki
Photo type: card
Final file path: /images/destinations/chalkidiki/{descriptive-name}-card.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### fallback
Destination: chalkidiki
Photo type: fallback
Final file path: /images/destinations/chalkidiki/{descriptive-name}-fallback.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### attica

#### hero
Destination: attica
Photo type: hero
Final file path: /images/destinations/attica/{descriptive-name}-hero.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### card
Destination: attica
Photo type: card
Final file path: /images/destinations/attica/{descriptive-name}-card.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### fallback
Destination: attica
Photo type: fallback
Final file path: /images/destinations/attica/{descriptive-name}-fallback.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### peloponnese

#### hero
Destination: peloponnese
Photo type: hero
Final file path: /images/destinations/peloponnese/{descriptive-name}-hero.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### card
Destination: peloponnese
Photo type: card
Final file path: /images/destinations/peloponnese/{descriptive-name}-card.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### fallback
Destination: peloponnese
Photo type: fallback
Final file path: /images/destinations/peloponnese/{descriptive-name}-fallback.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### syros

#### hero
Destination: syros
Photo type: hero
Final file path: /images/destinations/syros/{descriptive-name}-hero.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### card
Destination: syros
Photo type: card
Final file path: /images/destinations/syros/{descriptive-name}-card.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### fallback
Destination: syros
Photo type: fallback
Final file path: /images/destinations/syros/{descriptive-name}-fallback.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### andros

#### hero
Destination: andros
Photo type: hero
Final file path: /images/destinations/andros/{descriptive-name}-hero.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### card
Destination: andros
Photo type: card
Final file path: /images/destinations/andros/{descriptive-name}-card.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

#### fallback
Destination: andros
Photo type: fallback
Final file path: /images/destinations/andros/{descriptive-name}-fallback.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

## Generic Fallback Photos

### greekBeach

Destination: generic fallback
Photo type: greekBeach
Final file path: public/images/fallback/greek-beach.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### cyclades

Destination: generic fallback
Photo type: cyclades
Final file path: public/images/fallback/cyclades.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### ionian

Destination: generic fallback
Photo type: ionian
Final file path: public/images/fallback/ionian.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:

### aegean

Destination: generic fallback
Photo type: aegean
Final file path: public/images/fallback/aegean.webp
Original source:
Source URL:
Author:
License:
Attribution required:
Verified location:
Usage label:
Optimized dimensions:
Optimized file size:
Registry ready:
Notes:
Status:
