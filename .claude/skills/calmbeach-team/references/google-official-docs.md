# Google Search — Official Documentation Extracts

**What this file is.** A cache of *primary sources*: verbatim extracts from Google's own
documentation (`developers.google.com/search`, `support.google.com/webmasters`,
`developers.google.com/search/blog`). It exists so the Google-specialist role can cite what
Google actually says instead of what SEO blogs claim Google says.

**Rules for using it.**

1. Everything in a blockquote is copied text from the URL named in that section. It is not a
   summary. Never paraphrase a policy and present it as a quote.
2. **Re-verify any extract older than ~3 months by opening the URL.** Google rewrites this
   documentation frequently and without notice — policies get renamed (e.g. "doorway pages" →
   "doorway abuse"), merged, or added outright. Treat the fetch date as an expiry date.
3. Anything marked 🟡 is **not from a fetched page** — it is model knowledge or inference, and
   must be treated as unverified until confirmed against a source.
4. Some blockquotes end with `[…]`. That means the fetch pipeline truncated the excerpt at
   ~120 characters, not that the sentence ends there. Open the URL for the full sentence before
   quoting it to anyone.

**Fetch date for every extract below: 2026-07-28.**

---

## Table of contents

1. [Spam policies for Google web search](#1-spam-policies-for-google-web-search)
2. [Google Search Essentials](#2-google-search-essentials)
3. [Technical requirements](#3-technical-requirements)
4. [How Search works — crawling, indexing, serving](#4-how-search-works--crawling-indexing-serving)
5. [Large site owner's guide to managing crawl budget](#5-large-site-owners-guide-to-managing-crawl-budget)
6. [Manual Actions report](#6-manual-actions-report)
7. [Page Indexing report — "Crawled" vs "Discovered" not indexed](#7-page-indexing-report--crawled-vs-discovered-not-indexed)
8. [AI-generated and scaled content](#8-ai-generated-and-scaled-content)
9. [Duplicate content and canonicalization](#9-duplicate-content-and-canonicalization)
10. [Affiliate content and thin affiliate pages](#10-affiliate-content-and-thin-affiliate-pages)
11. [Quality expectations for safety-adjacent content (E-E-A-T / YMYL)](#11-quality-expectations-for-safety-adjacent-content-e-e-a-t--ymyl)
12. [Pages that could not be retrieved](#12-pages-that-could-not-be-retrieved)

---

## 1. Spam policies for Google web search

**Source:** <https://developers.google.com/search/docs/essentials/spam-policies>
**Fetched:** 2026-07-28

The full policy list as published, with the defining sentence for each.

> **[intro]** "In the context of Google Search, spam refers to techniques used to deceive users
> or manipulate our Search systems into featuring content prominently"

> **[consequence]** "Sites that violate our policies may rank lower in results or not appear in
> results at all."

> **Cloaking** — "Cloaking refers to the practice of presenting different content to users and
> search engines with the intent to manipulate search rankings and mislead users."

> **Doorway abuse** — "Doorway abuse is when sites or pages are created to rank for specific,
> similar search queries."
>
> Examples: "Having multiple websites with slight variations to the URL and home page to maximize
> their […]" / "Having multiple domain names or pages targeted at specific regions or cities that
> funnel users […]"

> **Expired domain abuse** — "Expired domain abuse is where an expired domain name is purchased
> and repurposed primarily to manipulate search rankings by hosting content that provides little
> to no value to users."

> **Hacked content** — "Hacked content is any content placed on a site without permission, due to
> vulnerabilities in a site's security."

> **Hidden text and link abuse** — "Hidden text or link abuse is the practice of placing content
> on a page in a way solely to manipulate search engines and not to be easily viewable by human
> visitors."

> **Keyword stuffing** — "Keyword stuffing refers to the practice of filling a web page with
> keywords or numbers in an attempt to manipulate rankings in Google Search results."

> **Link spam** — "Link spam is the practice of creating links to or from a site primarily for the
> purpose of manipulating search rankings."

> **Machine-generated traffic** — "Machine-generated traffic (also called automated traffic) refers
> to the practice of sending automated queries to Google."

> **Malicious practices** — "Malicious practices create a mismatch between user expectations and
> the actual outcome, leading to a negative and deceptive user experience, or compromised user
> security or privacy."

> **Misleading functionality** — "Misleading functionality refers to the practice of intentionally
> creating sites that trick users into thinking they would be able to access some content or
> services but in reality can't."

> **Scaled content abuse** — "Scaled content abuse is when many pages are generated for the primary
> purpose of manipulating search rankings and not helping users."
>
> "This abusive practice is typically focused on creating large amounts of unoriginal content […]"
>
> Examples (untruncated, re-fetched 2026-07-30): "Using generative AI tools or other similar tools
> to generate many pages without adding value" / "Scraping feeds, search results, or other content
> to generate many pages" / "Stitching or combining content from different web pages without adding
> value" / "Creating multiple sites with the intent of hiding the scaled nature of the content" /
> "Creating many pages where the content makes little or no sense to a reader but contains search
> keywords"

> **Scraping** — "Scraping refers to the practice of taking content from other sites, often through
> automated means, and hosting it with the purpose of manipulating search rankings."

> **Site reputation abuse** — "Site reputation abuse is a tactic where third-party content is
> published on a host site mainly because of that host's already-established ranking signals."

> **Sneaky redirects** — "Sneaky redirecting is the practice of doing this maliciously in order to
> either show users and search engines different content or show users unexpected content."

> **Thin affiliation** — "Thin affiliation is the practice of publishing content with product
> affiliate links where the product descriptions and reviews are copied directly from the original
> merchant without any original content or added value."
>
> Re-fetched 2026-07-30, untruncated: "Affiliate pages can be considered thin if they are a part of
> a program that distributes its content across a network of affiliates without providing
> additional value." / "Good affiliate sites add value by offering meaningful content or features"
> such as price information, original reviews, testing, product navigation, and comparisons.

> **User-generated spam** — "User-generated spam is spammy content added to a site by users through
> a channel intended for user content."

> **Other practices — policy circumvention** — "If a site continues to engage in actions intended
> to bypass our spam policies or content policies for Google Search, we may take appropriate
> action."

> **Other practices — scam and fraud** — "Scam and fraud come in many forms, including but not
> limited to impersonating an official business or service through imposter sites."

🟡 *Not from the fetched page:* the list above contains **no "duplicate content" policy**. That
absence is visible in the fetched policy list, but the inference that duplicate content therefore
cannot itself trigger a spam action is mine, not Google's stated wording. See section 9.

### Τι σημαίνει για το CalmBeach

Από τις 19 πολιτικές, μόνο δύο αφορούν πραγματικά το site: το **scaled content abuse** και το
**thin affiliation**. Και οι δύο ορισμοί έχουν την ίδια λέξη-κλειδί — «primary purpose of
manipulating search rankings and not helping users» — και το CalmBeach έχει καθαρή απάντηση: κάθε
μία από τις 9.474 σελίδες κρατάει διαφορετικά δικά της δεδομένα (προσανατολισμός παραλίας, άνεμος,
προστασία), οπότε δεν είναι «unoriginal content». Το πραγματικό ρίσκο δεν είναι ο αριθμός των
σελίδων αλλά αν το *κείμενο* γύρω από τα δεδομένα είναι το ίδιο template χωρίς ουσία. Τα υπόλοιπα
17 (cloaking, hacked content, link spam, doorways, expired domains) δεν σε αγγίζουν καθόλου.

---

## 2. Google Search Essentials

**Source:** <https://developers.google.com/search/docs/essentials>
**Fetched:** 2026-07-28

> **Technical requirements** — "The technical requirements cover the bare minimum that Google
> Search needs from a web page in order to show it in search results."

> **Spam policies** — "The spam policies detail the behaviors and tactics that can lead to a page
> or an entire site being ranked lower or completely omitted from Google Search."

**Key best practices**, as listed:

> "Create helpful, reliable, people-first content."

> "Use words that people would use to look for your content, and place those words in prominent
> locations on the page, such as the title and main heading."

> "Make your links crawlable so that Google can find other pages on your site via the links on
> your page."

> "Tell people about your site. Be active in communities where you can tell like-minded people
> about your services and products."

> "If you have other content, such as images, videos, structured data, and JavaScript, make sure
> you're following those specific best practices."

### Τι σημαίνει για το CalmBeach

Οι Essentials είναι μόνο τρία πράγματα, όχι μια λίστα 200 σημείων: τεχνικά να διαβάζεται, να μην
είναι spam, και το περιεχόμενο να είναι χρήσιμο. Το «make your links crawlable» είναι το πιο
πρακτικό για σένα: με 9.474 παραλίες, αν κάποιες φτάνουν μόνο μέσω αναζήτησης ή JavaScript filter
και όχι μέσω κανονικών `<a href>` links, ο Google απλά δεν θα τις βρει ποτέ. Το «tell people about
your site» είναι η ειλικρινής αδυναμία ενός νέου site χωρίς links από αλλού.

---

## 3. Technical requirements

**Source:** <https://developers.google.com/search/docs/essentials/technical>
**Fetched:** 2026-07-28

> "Googlebot isn't blocked."

> "The page works, meaning that Google receives an HTTP `200 (success)` status code."

> "The page has indexable content."

> "Just because a page meets these requirements doesn't mean that a page will be indexed; indexing
> isn't guaranteed."

> **Googlebot isn't blocked (it can find and access the page)** — "Google only indexes pages on the
> web that are accessible to the public and which don't block our crawler, [Googlebot], from
> crawling them."

> **The page works (it's not an error page)** — "Google only indexes pages that are served with an
> [HTTP `200 (success)` status code]."

> **The page has indexable content** — "The textual content is in a [file type that Google Search
> supports]." / "The content doesn't violate our [spam policies]."

### Τι σημαίνει για το CalmBeach

Αυτά τα τρία τα περνάς αυτόματα: pre-rendered στατικό HTML στο Netlify σημαίνει 200 και πραγματικό
κείμενο στην πηγή, χωρίς εξάρτηση από JavaScript rendering. Η μόνη σημαντική πρόταση εδώ είναι η
τελευταία: το ότι είσαι τεχνικά σωστός **δεν** εγγυάται indexing — άρα όταν δεις χιλιάδες σελίδες
μη ευρετηριασμένες, δεν είναι τεχνικό bug, είναι κρίση ποιότητας/προτεραιότητας. Άξιζε να
επιβεβαιώσεις μόνο ότι το `robots.txt` του Netlify δεν μπλοκάρει τίποτα κατά λάθος.

---

## 4. How Search works — crawling, indexing, serving

**Source:** <https://developers.google.com/search/docs/fundamentals/how-search-works>
**Fetched:** 2026-07-28

> "Google Search is a fully-automated search engine that uses software known as web crawlers that
> explore the web regularly to find pages to add to our index."

> **Crawling** — "Google downloads text, images, and videos from pages it found on the internet
> with automated programs called crawlers."

> **Indexing** — "Google analyzes the text, images, and video files on the page, and stores the
> information in the Google index, which is a large database."

> **Serving search results** — "When a user searches on Google, Google returns information that's
> relevant to the user's query."

> "Googlebot uses an algorithmic process to determine which sites to crawl, how often, and how many
> pages to fetch from each site."

> "During the crawl, Google renders the page and runs any JavaScript it finds using a recent
> version of Chrome."

> "During the indexing process, Google determines if a page is a duplicate of another page on the
> internet or canonical."

> "Relevancy is determined by hundreds of factors, which could include information such as the
> user's location, language, and device."

> "Google doesn't accept payment to crawl a site more frequently, or rank it higher."

> "Google doesn't guarantee that it will crawl, index, or serve your page, even if your page follows
> the Google Search Essentials."

> "Indexing isn't guaranteed; not every page that Google processes will be indexed."

### Τι σημαίνει για το CalmBeach

Τα τρία στάδια είναι ξεχωριστά και αυτό εξηγεί σχεδόν κάθε απορία που θα έχεις: μια παραλία μπορεί
να έχει γίνει crawl αλλά να μην μπήκε στο index, ή να είναι στο index αλλά να μη βγαίνει για τη
λέξη που περιμένεις. Το «Google renders the page and runs any JavaScript» σημαίνει ότι αν οι
συνθήκες ανέμου φορτώνουν client-side, ο Google *μπορεί* να τις δει, αλλά δεν πρέπει να βασίζεσαι σε
αυτό — το βασικό κείμενο σωστά είναι ήδη στο pre-rendered HTML. Το «indexing isn't guaranteed» είναι
η πρόταση που πρέπει να θυμάσαι πριν πανικοβληθείς με 9.474 σελίδες.

---

## 5. Large site owner's guide to managing crawl budget

**Source:** <https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget>
**Fetched:** 2026-07-28

Who the guide is for:

> "Large sites (1 million+ unique pages) with content that changes moderately often (once a week)"

> "Medium or larger sites (10,000+ unique pages) with very rapidly changing content (daily)"

> "Sites with a large portion of their total URLs classified by Search Console as Discovered -
> currently not indexed"

General theory of crawling:

> "The allocation of these resources is commonly called a site's crawl budget."

> "Google's crawling infrastructure defines a site as a unique hostname."

> "A site's crawl budget is determined by two main elements: crawl capacity limit and crawl demand."

> **Crawl capacity limit** — "This limits the total amount of time your server spends holding
> connections open for Google." / "Every site starts with the same default, conservative crawl
> capacity limit." / "If there is demand to crawl more and the site remains healthy, Google's
> systems will automatically adjust this limit over time."

> **Crawl demand** — "Each crawler has its own demand when it comes to crawling the web, determined
> by factors unique to that crawler." Factors named: "Perceived inventory," "Popularity,"
> "Staleness."

Best practices:

> "Consolidate duplicate content to focus crawling on unique content rather than unique URLs."

> "Block crawling of URLs using robots.txt" [for pages users see but that shouldn't appear in
> results]

> "Don't use noindex, as Google will still request, but then drop the page when it sees a noindex
> meta tag or header in the HTTP response, wasting crawling time."

> "Return a 404 or 410 status code for permanently removed pages."

> "Keep your sitemaps up to date."

> "Improve loading speed: Optimize your server response times and resources to make pages load
> faster."

> "Support 304 (Not Modified) HTTP status codes"

### Τι σημαίνει για το CalmBeach

Αυτός ο οδηγός σε αφορά, αλλά όχι για τον λόγο που φαντάζεσαι. Δεν πιάνεις το 1 εκατ. σελίδες, όμως
πιάνεις σαφώς το κατώφλι «10.000+ unique pages» (9.474 × 3 γλώσσες), και κυρίως πιάνεις το τρίτο
κριτήριο: αν στο Search Console δεις πολλά **Discovered - currently not indexed**, τότε το crawl
budget είναι πραγματικό σου θέμα. Καλά νέα: το Netlify ως στατικό hosting δεν έχει «crawl capacity»
πρόβλημα — ο server σου δεν κουράζεται, οπότε το φρένο είναι το *crawl demand* (πόσο αξίζει κατά τον
Google να ξανακατεβάσει τις σελίδες σου), και αυτό κερδίζεται μόνο με ποιότητα και links, όχι με
τεχνικό tuning. Πρακτικό: μην βάλεις `noindex` στις «αδύναμες» παραλίες περιμένοντας να γλιτώσεις
crawl budget — η τεκμηρίωση λέει ρητά ότι αυτό σπαταλά χρόνο crawl.

---

## 6. Manual Actions report

**Source:** <https://support.google.com/webmasters/answer/9044175>
**Fetched:** 2026-07-28

> "See if your site has any manual actions issued against it and view the site's manual action
> history."

> "If a site has a manual action, some or all of that site will not be shown in Google search
> results."

> "Google issues a manual action against a site when a human reviewer at Google has determined that
> pages on the site are not compliant with Google's spam policies."

> "Most manual actions address attempts to manipulate our search index."

Manual action types, as listed:

> **Back button hijacking** — "Google has detected that a portion of your site may exhibit back
> button hijacking behavior, which violates our spam policy on malicious practices."

> **Site abused with third-party spam** — "Google has detected a significant portion of your site
> being abused with spam that violates Google's spam policies and adds little or no value to the
> web."

> **User-generated spam** — "Google has detected spam on your pages submitted by site visitors."

> **Spammy free host** — "A significant fraction of sites hosted on your free web hosting service
> are spammy."

> **Structured data issue** — "Google has detected that some of the markup on your pages may be
> using techniques that are outside our structured data guidelines."

> **Unnatural links to your site** — "Google has detected a pattern of unnatural, artificial,
> deceptive, or manipulative links pointing to your site."

> **Unnatural links from your site** — "Google has detected a pattern of unnatural artificial,
> deceptive, or manipulative outbound links on your site."

> **Thin content with little or no added value** — "Google has detected low-quality pages or shallow
> pages on your site."

> **Cloaking and/or sneaky redirects** — "Your site may be showing different pages to users than are
> shown to Google, or redirecting users to a different page than Google saw."

> **Major spam problems** — "The site appears to use aggressive spam techniques such as scaled
> content abuse, cloaking, and/or other repeated or egregious violations of Google's spam policies."

> **Cloaked images** — "Some of your site's images may display differently in Google's search
> results than when viewed on your site."

> **Hidden text and/or keyword stuffing** — "Some of your pages may contain hidden text or keyword
> stuffing, techniques that are not allowed by Google's spam policies."

> **AMP content mismatch** — "There is a difference in content between the AMP version and its
> canonical web page."

> **Sneaky mobile redirects** — "Some pages on this site appear to be redirecting mobile device
> users to content not available to search engine crawlers."

> **Site reputation abuse** — "Google has detected that a portion of your site is violating our spam
> policy on site reputation abuse."

Requesting a review:

> "When **all issues** listed in the report are fixed in **all pages**, select **Request Review** in
> this report."

> "A good request does three things: Explains the exact quality issue on your site. Describes the
> steps you've taken to fix the issue. Documents the outcome of your efforts."

> "Most reconsideration reviews can take several days or weeks, although in some cases, such as
> link-related reconsideration requests, it may take longer than usual."

**Manual vs algorithmic — what the page actually establishes:** a manual action requires "a human
reviewer at Google," appears *in this report*, and is cleared by a reconsideration request.
🟡 *Not from the fetched page:* the corollary — that an empty Manual Actions report means any traffic
loss is algorithmic and there is nothing to "appeal," only content to improve — is inference, though
it follows directly from the quoted definition.

### Τι σημαίνει για το CalmBeach

Το πιο χρήσιμο εδώ είναι διαγνωστικό, όχι προληπτικό: αν κάποια μέρα πέσει η επισκεψιμότητα, άνοιξε
πρώτα αυτό το report. Αν είναι **άδειο**, δεν υπάρχει «τιμωρία» να σηκώσεις και καμία αίτηση να
κάνεις — είναι αλγοριθμικό και λύνεται μόνο με καλύτερο περιεχόμενο. Από τη λίστα, το μόνο που
θεωρητικά σε αφορά είναι το **thin content with little or no added value** («low-quality pages or
shallow pages»), και αυτό είναι ανθρώπινη κρίση: ένας reviewer θα κοιτάξει μια σελίδα παραλίας και
θα ρωτήσει «τι μου λέει αυτό που δεν λέει το template». Τα unnatural links θα γίνουν σχετικά μόνο
αν αρχίσεις να αγοράζεις links — μην το κάνεις.

---

## 7. Page Indexing report — "Crawled" vs "Discovered" not indexed

**Source:** <https://support.google.com/webmasters/answer/7440203>
**Fetched:** 2026-07-28

> **Crawled - currently not indexed** — "The page was crawled by Google but not indexed. It may or
> may not be indexed in the future; no need to resubmit this URL for crawling."

> **Discovered - currently not indexed** — "The page was found by Google, but not crawled yet.
> Typically, Google wanted to crawl the URL but this was expected to overload the site; therefore
> Google rescheduled the crawl."

> **Duplicate without user-selected canonical** — "This page is a duplicate of another page,
> although it doesn't indicate a preferred canonical page. Google has chosen the other page as the
> canonical for this page, and so will not serve this page in Search."

> **Duplicate, Google chose different canonical than user** — "This page is marked as canonical for
> a set of pages, but Google thinks another URL makes a better canonical. Google has indexed the
> page that we consider canonical rather than this one."

> **Alternate page with proper canonical tag** — "This page is marked as an alternate of another
> page (that is, an AMP page with a desktop canonical, or a mobile version of a desktop canonical,
> or the desktop version of a mobile canonical)."

> **[general]** "Non-indexed URLs can be fine. Read and understand the specific reason for each
> non-indexed URL to confirm that the page shouldn't be indexed."

**The distinction that matters:** "Crawled - currently not indexed" = Google fetched the page and
chose not to index it. "Discovered - currently not indexed" = Google never fetched it, and the
documented reason is load/scheduling, not quality.

### Τι σημαίνει για το CalmBeach

Αυτά τα δύο status είναι το κύριο εργαλείο μέτρησης της υγείας του site σου και σημαίνουν τελείως
διαφορετικά πράγματα. **Crawled - currently not indexed** σε πλήθος = ο Google είδε τις σελίδες
παραλιών και τις έκρινε μη αρκετά αξιόλογες: πρόβλημα περιεχομένου, και το πιο πιθανό σενάριο για τη
μεγάλη ουρά των άγνωστων παραλιών. **Discovered - currently not indexed** = δεν πρόλαβε να τις
κατεβάσει, θέμα crawl budget/προτεραιότητας — και επειδή είσαι σε στατικό Netlify, η αιτία δεν είναι
ο server σου αλλά η χαμηλή «αξία» που σου αποδίδει ακόμα ο Google. Μην πανικοβάλλεσαι: η ίδια η
τεκμηρίωση λέει «non-indexed URLs can be fine» — σε ένα site 28.000 URLs είναι απολύτως φυσιολογικό
να μην μπουν όλα, και η σωστή αντίδραση είναι να δεις *ποιες* λείπουν, όχι πόσες.

---

## 8. AI-generated and scaled content

**Sources (two, both fetched 2026-07-28):**
- <https://developers.google.com/search/docs/fundamentals/using-gen-ai-content>
- <https://developers.google.com/search/blog/2023/02/google-search-and-ai-content>
  (the HTML page returned navigation only; the extract below is from the same URL's plain-text
  variant, `…/google-search-and-ai-content.md.txt`)

From the documentation page:

> "Generative AI can be particularly useful when researching a topic, and to add structure to
> original content."

> "Using generative AI tools or other similar tools to generate many pages without adding value for
> users may violate Google's spam policy on scaled content abuse."

> "If you're using generative AI content on your website, make sure your work meets the standards of
> the Search Essentials and our spam policies."

> "When creating content for the web, focus on accuracy, quality, and relevance, especially when
> automatically generating the content."

> "Sharing information about how a piece of content was created can help give your readers more
> context."

> "consider adding information on how your content was created in a way that makes sense for your
> audience"

From the 2023 blog post:

> "Google's ranking systems aim to reward original, high-quality content that demonstrates qualities
> of what we call E-E-A-T: expertise, experience, authoritativeness, and trustworthiness."

> "Using automation—including AI—to generate content with the primary purpose of manipulating
> ranking in search results is a violation of our spam policies."

> "Automation has long been used to generate helpful content, such as sports scores, weather
> forecasts, and transcripts. AI has the ability to power new levels of expression and creativity,
> and to serve as a critical tool to help people create great content for the web."

> "AI or automation disclosures are useful for content where someone might think 'How was this
> created?'. Consider adding these when it would be reasonably expected."

> "Giving AI an author byline is probably not the best way to follow our recommendation to make
> clear to readers when AI is part of the content creation process."

Related self-assessment questions from the helpful-content page
(<https://developers.google.com/search/docs/fundamentals/creating-helpful-content>):

> "If you use automation, including AI-generation, to produce content for the primary purpose of
> manipulating search rankings, that's a violation of our spam policies."

> "Are you using extensive automation to produce content on many topics?"

> "Is the use of automation, including AI-generation, self-evident to visitors through disclosures
> or in other ways?"

> "Are you explaining why automation or AI was seen as useful to produce content?"

### Τι σημαίνει για το CalmBeach

Εδώ είναι η πιο σημαντική πρόταση όλου του αρχείου για σένα: ο Google αναφέρει ρητά τα **«weather
forecasts»** ως παράδειγμα *χρήσιμου* αυτοματοποιημένου περιεχομένου. Αυτό είναι σχεδόν ακριβώς το
CalmBeach — αυτόματη παραγωγή σελίδων από πραγματικά δεδομένα καιρού/ανέμου δεν είναι το πρόβλημα
που περιγράφει η πολιτική. Το κριτήριο δεν είναι «γράφτηκε από AI ή άνθρωπο» αλλά «primary purpose
of manipulating ranking». Η πραγματική σου έκθεση: αν οι περιγραφές των 9.474 παραλιών παράχθηκαν
μαζικά από LLM και είναι γενικόλογες (χωρίς να δένουν με τα δικά τους δεδομένα προσανατολισμού και
ανέμου), τότε πατάς πάνω στο «extensive automation to produce content on many topics». Πρακτικό
βήμα που η τεκμηρίωση συστήνει και είναι εύκολο: μια σύντομη σελίδα/σημείωση που εξηγεί πώς
παράγονται οι σελίδες και από ποια δεδομένα (OSM + weather API) — και χωρίς να βάλεις AI ως
«συγγραφέα».

---

## 9. Duplicate content and canonicalization

**Source:** <https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls>
**Fetched:** 2026-07-28

> "If you don't specify a canonical URL, Google will identify which version of the URL is
> objectively the best version to show to users in Search."

Purpose, as stated: "To specify which URL that you want people to see in search results" and "to
consolidate signals for similar or duplicate pages."

Canonicalization methods, with the strength Google assigns:

> "Redirects: A strong signal that the target of the redirect should become canonical"

> "rel=\"canonical\" link annotations: A strong signal that the specified URL should become
> canonical"

> "Sitemap inclusion: A weak signal that helps the URLs that are included in a sitemap become
> canonical"

> "these methods can stack and thus become more effective when combined"

> "none of them are required; your site will likely do just fine without specifying a canonical
> preference"

Additional site-setup signals named on the page: preferring "HTTPS pages over equivalent HTTP pages"
and "URLs that are part of hreflang clusters."

Google's own consolidation framing: it merges the "signals they have for the individual URLs (such
as links to them) into a single, preferred URL."

**Confirmed 2026-07-30 — `rel=canonical` is a hint, not a rule.** Not on this page, but on a
related one: **<https://developers.google.com/search/docs/crawling-indexing/canonicalization>**
(fetched 2026-07-30):
> "You can indicate your preference to Google using these techniques, but Google may choose a
> different page as canonical than you do, for various reasons. That is, indicating a canonical
> preference is a hint, not a rule."
This closes the gap the first pass of this file (2026-07-28) flagged as unverified — it is now a
direct quote, not inference. The page did *not* contain a sentence stating that duplicate content
is not spam or grounds for a manual action; that remains supported only by absence (section 1's
policy list has no "duplicate content" entry) plus this quote's framing (a ranking choice, not a
penalty).

### Τι σημαίνει για το CalmBeach

Δύο πράγματα. Πρώτο: ο Google *θα* διαλέξει canonical μόνος του αν δεν του πεις, και το status
«Duplicate, Google chose different canonical than user» στο section 7 αποδεικνύει ότι μπορεί να
αγνοήσει και την επιλογή σου. Δεύτερο και πιο σοβαρό για σένα: αναφέρεται ρητά ότι τα **hreflang
clusters** είναι σήμα canonicalization — άρα με EN/EL/DE, αν οι τρεις εκδόσεις μιας παραλίας είναι
πολύ όμοιες (π.χ. ίδιοι αριθμοί ανέμου και μισο-μεταφρασμένο κείμενο), ο Google μπορεί να κρατήσει
μία και να αγνοήσει τις άλλες δύο. Αυτό είναι πραγματική έκθεση, όχι θεωρητική. Καλά νέα: το
duplicate content δεν εμφανίζεται πουθενά στη λίστα των spam policies του section 1 — είναι θέμα
ποια σελίδα θα δείξει, όχι ποινή.

---

## 10. Affiliate content and thin affiliate pages

**Sources (both fetched 2026-07-28):**
- <https://developers.google.com/search/docs/essentials/spam-policies> (the "Thin affiliation" policy)
- <https://developers.google.com/search/blog/2014/01/affiliate-programs-and-added-value>
  (extract taken from the plain-text variant of the same URL)

From the spam policies:

> "Thin affiliation is the practice of publishing content with product affiliate links where the
> product descriptions and reviews are copied directly from the original merchant without any
> original content or added value."

> "Good affiliate sites add value by offering meaningful content or features."

> "Offering additional information about price, original product reviews, rigorous testing and […]"

> "Using affiliate links throughout a page, with links treated appropriately, or embedding […]"

From the 2014 blog post (note: an old post; re-verify that Google still surfaces it):

> "These sites display content provided by an affiliate program---the same content that is available
> across hundreds or even thousands of other sites."

> "Our quality guidelines warn against running a site with thin or scraped content without adding
> substantial added value to the user."

> "Does this site provide significant added benefits that would make a user want to visit this site
> in search results instead of the original source of the content?"

> "If the answer is 'No,' the site may frustrate searchers and violate our quality guidelines. As
> with any violation of our quality guidelines, we may take action, including removal from our
> index."

### Τι σημαίνει για το CalmBeach

Διάβασε προσεκτικά τον ορισμό: το thin affiliation αφορά σελίδες όπου οι **περιγραφές προϊόντων
είναι αντιγραμμένες από τον merchant** χωρίς τίποτα δικό σου. Τα σχέδιά σου (ferry, ενοικίαση
αυτοκινήτου, δραστηριότητες) δεν είναι αυτό: ο πυρήνας της σελίδας είναι τα δικά σου δεδομένα ανέμου
και προσανατολισμού, και ο affiliate link είναι το επόμενο πρακτικό βήμα του χρήστη — αυτό ακριβώς
περιγράφει το «good affiliate sites add value by offering meaningful content or features». Το τεστ
του 2014 («γιατί να έρθει κάποιος σε εμένα αντί στην πηγή») το περνάς, γιατί η Blue Star Ferries δεν
σου λέει σε ποια παραλία φυσάει σήμερα. Πού υπάρχει έκθεση: αν φτιάξεις *ξεχωριστές* σελίδες τύπου
«ferry to X» ή «car rental in Y» χωρίς δικό σου περιεχόμενο, τότε πέφτεις και σε thin affiliation
και σε doorway abuse μαζί.

**Confirmed 2026-07-30 — `rel="sponsored"` is required, not optional.** Source:
**<https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links>** (fetched
2026-07-30):
> "Mark links that are advertisements or paid placements (commonly called *paid links*) with the
> `sponsored` value."
Every affiliate link (ferry/car rental/activities) needs `rel="sponsored"` — `rel="nofollow"` is
described as still acceptable but `sponsored` is now the preferred value. The page does not state
an explicit penalty for skipping it, but "paid links" that pass ranking credit without the
attribute are exactly what the **Link spam** policy (section 1) targets — so treat it as
mandatory, not cosmetic, before any affiliate link ships. This closes the gap the 2026-07-28 pass
of this file flagged as unfetched.

---

## 11. Quality expectations for safety-adjacent content (E-E-A-T / YMYL)

**Source:** <https://developers.google.com/search/docs/fundamentals/creating-helpful-content>
**Fetched:** 2026-07-28

> "They identify a mix of factors that can help determine which content demonstrates aspects of
> experience, expertise, authoritativeness, and trustworthiness, or what we call E-E-A-T."

> "Of these aspects, trust is most important."

> "Our systems give even more weight to content that aligns with strong E-E-A-T for topics that
> could significantly impact the health, financial stability, or safety of people, or the welfare or
> well-being of society."

> "We call these 'Your Money or Your Life' topics, or YMYL for short."

Self-assessment questions bearing on trust:

> "Does the content present information in a way that makes you want to trust it, such as clear
> sourcing, evidence of the expertise involved?"

> "Is this content written or reviewed by an expert or enthusiast who demonstrably knows the topic
> well?"

> "If someone researched the site producing the content, would they come away with an impression
> that it is well-trusted or widely-recognized as an authority on its topic?"

> "Does the content provide original information, reporting, research, or analysis?"

> "Is this the sort of page you'd want to bookmark, share with a friend, or recommend?"

The "Who, How, and Why" framework:

> "Is it self-evident to your visitors who authored your content?"

> "It's helpful to readers to know how a piece of content was produced: this is the 'How' to
> consider."

> "'Why' is perhaps the most important question to answer about your content."

🟡 *Not from documentation:* Google's Search Quality Rater Guidelines discuss YMYL in much more
detail, including sea/water safety-type examples. That document is published by Google but lives
outside the three domains in scope for this file and was not fetched. Do not cite it from memory.

### Τι σημαίνει για το CalmBeach

Αυτό είναι το section με τη μεγαλύτερη πραγματική έκθεση, και θέλει ειλικρίνεια. Το CalmBeach λέει
σε τουρίστες πού να κολυμπήσουν με βάση άνεμο και κύμα — το «safety of people» της πρότασης YMYL σε
αγγίζει άμεσα, οπότε ο Google εφαρμόζει αυστηρότερο κριτήριο εμπιστοσύνης από ό,τι σε ένα απλό
ταξιδιωτικό blog. Τα δύο σημεία που σου λείπουν είναι συγκεκριμένα και διορθώσιμα: **«clear
sourcing»** (να φαίνεται ρητά η πηγή — OpenStreetMap για τη γεωμετρία, ποιο weather API για τις
συνθήκες, και timestamp «τελευταία ενημέρωση») και **«who authored your content»** (ένα πραγματικό
πρόσωπο/ταυτότητα πίσω από το site, όχι ανώνυμο domain). Επίσης, επειδή δίνεις συμβουλή που αφορά
ασφάλεια, ένα καθαρό disclaimer ότι τα δεδομένα είναι πρόβλεψη και δεν αντικαθιστούν τις τοπικές
σημάνσεις/ναυαγοσώστη είναι και σωστό προς τον χρήστη και ενισχύει το trust που ζητά ο Google. Το
«trust is most important» δεν είναι φιλοσοφία εδώ — είναι το πιο φθηνό SEO που μπορείς να κάνεις.

---

## 12. Pages that could not be retrieved

Listed so the gaps are visible rather than silently missing.

| Intended URL | Outcome | Mitigation |
|---|---|---|
| `https://developers.google.com/search/docs/crawling-indexing/technical-requirements` | **404 Not Found.** Path appears to have moved. | Content obtained instead from <https://developers.google.com/search/docs/essentials/technical> — see section 3. Gap closed. |
| `https://developers.google.com/search/docs/essentials/affiliate-programs` | **404 Not Found.** No standalone affiliate-programs page exists at this path. | Affiliate guidance obtained from the "Thin affiliation" spam policy plus the 2014 Search Central blog post — see section 10. Gap closed, but note there is no current dedicated affiliate documentation page; if a first-party equivalent exists elsewhere it was not located. |
| `https://developers.google.com/search/blog/2023/02/google-search-and-ai-content` (HTML) | **Retrieved, but body not present** — the fetch returned only navigation, metadata and the blog archive listing. | Re-fetched successfully via the same URL's plain-text variant (`.md.txt`). Quotes in section 8 come from that variant. Gap closed. |

**Known content gaps — updated 2026-07-30:**

- ~~No sentence was retrieved stating explicitly that `rel=canonical` is a hint rather than a
  directive~~ **CLOSED 2026-07-30** — confirmed on a page not originally fetched,
  `crawling-indexing/canonicalization` (distinct from `consolidate-duplicate-urls`, which really
  doesn't contain it). See section 9.
- ~~Google's page on qualifying outbound links (`rel="sponsored"` / `nofollow`) was not fetched~~
  **CLOSED 2026-07-30** — fetched `crawling-indexing/qualify-outbound-links`. See section 10.
- ~~Sections 1 and 10's "Scaled content abuse" / "Thin affiliation" excerpts were truncated~~
  **CLOSED 2026-07-30** — both re-fetched in full; see the untruncated bullets in section 1 and
  the added quote in section 10.
- The Search Quality Rater Guidelines were **not fetched** (out of scope: not on
  `developers.google.com/search`, `support.google.com/webmasters`, or the Search Central blog).
  Still open.
- Google's hreflang / localized-versions documentation was **not fetched**, despite being relevant
  to the site's three languages. Still open — the most useful addition for a future pass.
