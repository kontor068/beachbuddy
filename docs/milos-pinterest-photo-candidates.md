# Milos Pinterest Photo Candidates

Research date: 2026-05-09

Purpose: track Pinterest photo candidates for Milos beaches that currently have no static entry in `services/beachPhotos.ts`.

Important: these are research/source candidates only. Do not embed Pinterest or `pinimg.com` assets directly in the app unless usage rights are confirmed. For production app photos, prefer Wikimedia Commons, Pexels, or another source with clear licensing and attribution.

## Current Missing Static Photos

After adding the licensed Agia Kyriaki lead, 21 Milos entries still return no static photo from `getBeachPhotos(..., "Milos")`:

- Agios Dimitrios
- Agios Ioannis
- Agios Sostis
- Ammoudaraki
- Gerontas
- Gerania
- Kalamos
- Kapros
- Katergo
- Kipos
- Kambanes
- Nautikos Omilos Milou
- Nerodafni
- Agathia
- Plathiena
- Rivari
- Tourkothalassa
- Triades
- Fatourena
- Psathi
- Psarovolada

Note: Agia Kyriaki appears twice in the source data; both rows are now covered through the `Agia Kyriaki` / `Agia Kiriaki` aliases.

## Pinterest Candidates Found

| Beach | Pinterest candidate | Notes |
| --- | --- | --- |
| Agia Kyriaki | https://www.pinterest.com/pin/152981718569045479/ | Pin points to Tripadvisor; verify rights before use. |
| Agia Kyriaki | https://www.pinterest.com/pin/milos-islandagia-kyriaki-cycladesgreece-photo-by-mina-karamitsou-instagram-minakara24-milos-milosislan--2533343518490984/ | Creator/Instagram attribution visible in search result; permission still needed. |
| Agios Ioannis | https://www.pinterest.com/pin/524739794055911992/ | Exact Milos beach candidate from Pinterest search result. |
| Agios Ioannis | https://it.pinterest.com/pin/agios-ioannis-beach-milos--618682067560708842/ | Exact Milos beach candidate from Pinterest search result. |
| Agios Sostis | https://www.pinterest.com/pin/801429696164005291/ | Search result says near Provatas, Milos; page title also mentions Paraga, so verify before use. |
| Gerontas | https://www.pinterest.com/pin/gerontas-beach-milos-greece--335940453425131891/ | Pin points to Flickr creator page; check Flickr license/permission. |
| Gerontas | https://au.pinterest.com/pin/joy--985231164692385/ | Instagram/travel creator pin; permission needed. |
| Kapros | https://it.pinterest.com/pin/milos-island-kapros-beach-cyclades-greece--325948091771305886/ | Exact Kapros/Milos candidate from Pinterest search result. |
| Kipos | https://www.pinterest.com/pin/kipos-beach-milos-island-cyclades--801429696163241482/ | Exact Kipos/Milos candidate from Pinterest search result. |
| Plathiena | https://it.pinterest.com/pin/2955555989412422/ | Exact Plathiena/Milos candidate from Pinterest search result. |
| Plathiena | https://fr.pinterest.com/pin/plathiena-beach-milos--569635052884186223/ | Exact Plathiena/Milos candidate from Pinterest search result. |
| Plathiena | https://au.pinterest.com/pin/platheina-beach-milos-greece-in-2025--616852480252758820/ | Spelling variant: Platheina. |
| Rivari | https://gr.pinterest.com/pin/801429696183725044/ | Rivari Lagoon, Milos candidate. |
| Tourkothalassa | https://www.pinterest.com/pin/428616089507115680/ | Exact Tourkothalassa/Milos candidate from Pinterest page. |
| Triades | https://dk.pinterest.com/pin/triades-beach-milos-greece--402931497889806680/ | Exact Triades/Milos candidate from Pinterest search result. |
| Fatourena | https://dk.pinterest.com/pin/stunning-beach-of-fatourena-in-milos-cyclades--562035228513263848/ | Exact Fatourena/Milos candidate from Pinterest search result. |

## No Solid Pinterest Candidate Found Yet

Initial targeted Pinterest searches did not return a solid result for:

- Agios Dimitrios
- Ammoudaraki
- Gerania
- Kalamos
- Kambanes
- Nautikos Omilos Milou
- Nerodafni
- Agathia
- Katergo
- Psathi
- Psarovolada

## App-Ready Photo Added

Wikimedia Commons has a licensed candidate for Agia Kyriaki, now added to `services/beachPhotos.ts`:

- `Milossouth.JPG`
- Source: https://commons.wikimedia.org/wiki/File:Milossouth.JPG
- Description confirms southeast Milos, showing Agia Kyriaki and Paliochori.
- License: CC BY-SA 4.0
