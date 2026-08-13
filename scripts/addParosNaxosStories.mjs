// Adds the curated "Πληροφορίες" texts for Paros + Naxos beaches that had none.
//
//   node scripts/addParosNaxosStories.mjs --dry
//   node scripts/addParosNaxosStories.mjs
//
// Rule followed for every entry: a story only exists if it says something the beach card
// does NOT already show. Terrain, access, depth and the amenity list are printed elsewhere
// on the page — repeating them here would be twenty near-identical paragraphs, which is
// worse than silence. So each text carries a fact of place, history or use: what the clay
// cliffs of Kalogeros are for, why Lionas has a cable-way ruin above it, which side of
// Mikri Vigla the meltemi actually lands on.
//
// Nothing here claims calm, shelter or safety — those are the live engine's to say, and
// static copy that promises them ages badly.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storiesPath = path.join(rootDir, 'data', 'beachStories.data.json');
const DRY = process.argv.includes('--dry');

const PAROS = {
  2029: {
    title: { gr: 'Ο πηλός στα βράχια', en: 'The clay in the rocks' },
    paragraphs: {
      gr: [
        'Ο Καλόγερος είναι γνωστός για κάτι που δεν έχει καμία άλλη παραλία της Πάρου: τους γκρίζους πηλώδεις βράχους πάνω από την ακτή, που οι επισκέπτες ξύνουν και αλείφονται με τον πηλό πριν πέσουν στο νερό.',
        'Βρίσκεται στην ανατολική πλευρά, ανάμεσα στον Μώλο και τη Χρυσή Ακτή, στο τέλος χωματόδρομου. Δεν υπάρχει τίποτα εκεί — ούτε ομπρέλα, ούτε καντίνα, ούτε σκιά.',
      ],
      en: [
        'Kalogeros is known for something no other Paros beach has: the grey clay rocks above the shore, which visitors scrape and smear on themselves before going into the water.',
        'It sits on the east side, between Molos and Golden Beach, at the end of a dirt road. There is nothing there — no umbrella, no canteen, no shade.',
      ],
    },
  },
  2020: {
    title: { gr: 'Ο φοινικώνας της νοτιοδυτικής Πάρου', en: 'The palm grove of south-west Paros' },
    paragraphs: {
      gr: [
        'Η Αγία Ειρήνη ξεχωρίζει από τον φοινικώνα που φτάνει σχεδόν μέχρι το νερό — σπάνια εικόνα στις Κυκλάδες, όπου η σκιά συνήθως σημαίνει αρμυρίκι.',
        'Είναι στη νοτιοδυτική άκρη του νησιού, κοντά στην Πούντα απ’ όπου φεύγει το φεριμπότ για την Αντίπαρο, και έχει οργανωμένες παροχές το καλοκαίρι.',
      ],
      en: [
        'Agia Eirini stands out for the palm grove that reaches almost to the water — a rare sight in the Cyclades, where shade usually means tamarisk.',
        'It is on the south-west corner of the island, near Pounta where the Antiparos ferry leaves, and has seasonal facilities in summer.',
      ],
    },
  },
  2040: {
    title: { gr: 'Μακριά αμμουδιά χωρίς τίποτα πάνω της', en: 'A long strand with nothing on it' },
    paragraphs: {
      gr: [
        'Ο Μώλος είναι από τις μεγαλύτερες αμμουδιές της ανατολικής Πάρου και έχει μείνει αδόμητη: καμία ξαπλώστρα, κανένα μπαρ. Η σκιά της είναι φυσική, από αρμυρίκια και κέδρα στο πίσω μέρος.',
        'Ο δρόμος από τα Μάρμαρα είναι ασφαλτοστρωμένος και το μήκος της ακτής σημαίνει ότι ακόμα και τον Αύγουστο υπάρχει χώρος να απλωθείς μακριά από τους άλλους.',
      ],
      en: [
        'Molos is one of the longest strands on eastern Paros and has stayed undeveloped: no sunbeds, no bar. Its shade is natural, from tamarisk and juniper at the back.',
        'The road from Marmara is paved, and the sheer length of the shore means that even in August there is room to spread out away from everyone else.',
      ],
    },
  },
  2033: {
    title: { gr: 'Η παραλία της ίδιας της Παροικιάς', en: 'Parikia’s own beach' },
    paragraphs: {
      gr: [
        'Τα Λιβάδια είναι η αμμουδιά που αρχίζει λίγα λεπτά με τα πόδια από το λιμάνι της Παροικιάς — η επιλογή για όποιον έχει καράβι το απόγευμα και δεν προλαβαίνει να πάει πουθενά αλλού.',
        'Είναι οργανωμένη, με ρηχό νερό και τον ναυτικό όμιλο στην άκρη της, και το να επιστρέψεις στα πράγματά σου ή σε ένα καφέ είναι θέμα λεπτών.',
      ],
      en: [
        'Livadia is the sand that starts a few minutes’ walk from Parikia harbour — the choice for anyone with an afternoon ferry and no time to go further.',
        'It is organised, with shallow water and the sailing club at one end, and getting back to your luggage or to a cafe is a matter of minutes.',
      ],
    },
  },
  2032: {
    title: { gr: 'Πίσω από τους αμμόλοφους', en: 'Behind the dunes' },
    paragraphs: {
      gr: [
        'Στη Λάγγερη δεν φτάνει αυτοκίνητο: αφήνεις τον δρόμο και περνάς με τα πόδια ένα μονοπάτι μέσα από αμμόλοφους και κέδρα, βόρεια της Νάουσας.',
        'Αυτό είναι και ο λόγος που παρέμεινε άδεια από ξαπλώστρες και μαγαζιά. Πάρε νερό και σκιά μαζί σου — δεν υπάρχει τίποτα από τα δύο εκεί.',
      ],
      en: [
        'No car reaches Langeri: you leave the road and cross a footpath through dunes and juniper, north of Naoussa.',
        'That is exactly why it has stayed free of sunbeds and shops. Bring water and shade with you — there is neither on the beach.',
      ],
    },
  },
  2035: {
    title: { gr: 'Απέναντι από το Πίσω Λιβάδι', en: 'Across from Piso Livadi' },
    paragraphs: {
      gr: [
        'Ο Λογαράς είναι η οργανωμένη αμμουδιά δίπλα στο ψαροχώρι του Πίσω Λιβαδιού, στην ανατολική Πάρο: ταβέρνες στην άκρη της άμμου και ρηχό νερό μπροστά.',
        'Οι δύο παραλίες μοιράζονται τον ίδιο κόλπο και ενώνονται με τα πόδια, οπότε το φαγητό και το μπάνιο δεν χρειάζονται μετακίνηση.',
      ],
      en: [
        'Logaras is the organised sand beside the fishing village of Piso Livadi on eastern Paros: tavernas at the edge of the sand and shallow water in front.',
        'The two beaches share one bay and are joined on foot, so lunch and a swim need no drive between them.',
      ],
    },
  },
  2037: {
    title: { gr: 'Δέκα λεπτά βόρεια από την πόλη', en: 'Ten minutes north of town' },
    paragraphs: {
      gr: [
        'Το Μαρτσέλο είναι η επόμενη αμμουδιά μετά την Παροικιά, με αρμυρίκια στο πίσω μέρος και νερό που βαθαίνει αργά — γι’ αυτό γεμίζει οικογένειες.',
        'Φτάνεις με τα πόδια ή με πέντε λεπτά αυτοκίνητο από την πόλη, και η ακτή συνεχίζει βόρεια προς τον Κριό.',
      ],
      en: [
        'Martselo is the next sand along from Parikia, with tamarisks at the back and water that deepens slowly — which is why families fill it.',
        'You reach it on foot or five minutes by car from town, and the shore carries on north towards Krios.',
      ],
    },
  },
  2038: {
    title: { gr: 'Ο μικρός όρμος δίπλα στη Σάντα Μαρία', en: 'The small cove next to Santa Maria' },
    paragraphs: {
      gr: [
        'Η Μικρή Σάντα Μαρία είναι ο μικρότερος όρμος στην ίδια βορειοανατολική ακτή με τη μεγάλη Σάντα Μαρία, χωρισμένος από αυτήν με βραχώδη γλώσσα.',
        'Το νερό μπροστά της είναι ρηχό και καθαρό, με μικρά νησάκια απέναντι, και έχει οργανωμένες παροχές χωρίς την κίνηση της διπλανής.',
      ],
      en: [
        'Mikri Santa Maria is the smaller cove on the same north-east coast as the big Santa Maria, separated from it by a rocky spit.',
        'The water in front is shallow and clear, with small islets opposite, and it has facilities without the traffic of its neighbour.',
      ],
    },
  },
  2047: {
    title: { gr: 'Αμμόλοφοι νότια της Παροικιάς', en: 'Dunes south of Parikia' },
    paragraphs: {
      gr: [
        'Ο Παρασπόρος είναι η πρώτη μεγάλη αμμουδιά νότια της Παροικιάς, με χαμηλούς αμμόλοφους και κέδρα πίσω από την ακτή.',
        'Έχει οργανωμένο τμήμα και beach bar, αλλά και μεγάλα κομμάτια όπου δεν υπάρχει τίποτα — διαλέγεις σε ποιο θα στρώσεις.',
      ],
      en: [
        'Parasporos is the first big sand south of Parikia, with low dunes and juniper behind the shore.',
        'It has an organised section and a beach bar, but also long stretches with nothing on them — you pick which one you settle on.',
      ],
    },
  },
  2036: {
    title: { gr: 'Ο όρμος κάτω από το Άσπρο Χωριό', en: 'The bay below Aspro Chorio' },
    paragraphs: {
      gr: [
        'Ο Λωλαντώνης είναι ένας κλειστός όρμος στη νοτιοανατολική Πάρο, κάτω από τον οικισμό Άσπρο Χωριό, με μείγμα άμμου, βότσαλου και βράχων.',
        'Η μορφή του κόλπου τον κρατά έξω από την κίνηση των μεγάλων παραλιών της ανατολικής ακτής, παρότι έχει ταβέρνα και ξαπλώστρες.',
      ],
      en: [
        'Lolantonis is an enclosed bay on south-east Paros, below the settlement of Aspro Chorio, mixing sand, pebbles and rock.',
        'The shape of the bay keeps it out of the traffic of the big east-coast beaches, even though it has a taverna and sunbeds.',
      ],
    },
  },
};

const NAXOS = {
  2007: {
    title: { gr: 'Η πλευρά που διαλέγει ο άνεμος', en: 'The side the wind picks' },
    paragraphs: {
      gr: [
        'Η Μικρή Βίγλα είναι ένας βραχώδης λόφος που χωρίζει δύο παραλίες. Η νότια πλευρά είναι εκείνη που δέχεται το μελτέμι κατάματα, και γι’ αυτό εδώ μαζεύονται οι σχολές windsurf και kitesurf του νησιού.',
        'Αν ψάχνεις μπάνιο και όχι άνεμο, η βόρεια πλευρά του ίδιου λόφου είναι άλλη υπόθεση — δύο παραλίες, εκατό μέτρα απόσταση, τελείως διαφορετική μέρα.',
      ],
      en: [
        'Mikri Vigla is a rocky headland separating two beaches. The south side is the one that takes the meltemi head-on, which is why the island’s windsurf and kitesurf schools gather here.',
        'If you want a swim rather than wind, the north side of the same headland is a different story — two beaches, a hundred metres apart, a completely different day.',
      ],
    },
  },
  2003: {
    title: { gr: 'Το χωριό της σμύριδας', en: 'The emery village' },
    paragraphs: {
      gr: [
        'Ο Λίωνας ήταν σημείο φόρτωσης σμύριδας: το ορυκτό κατέβαινε από τα ορυχεία της ορεινής Νάξου με εναέριο σύρμα και φορτωνόταν εδώ σε καράβια. Τα ερείπια της εγκατάστασης φαίνονται ακόμα πάνω από τον όρμο.',
        'Η παραλία είναι βοτσαλωτή και το νερό βαθαίνει γρήγορα — δεν είναι παραλία για μικρά παιδιά, αλλά έχει ταβέρνες με ψάρι πάνω στον όρμο.',
      ],
      en: [
        'Lionas was an emery loading point: the mineral came down from the mines of mountainous Naxos on an aerial cable-way and was loaded onto ships here. The ruins of the installation still stand above the bay.',
        'The beach is pebbled and the water deepens fast — not a beach for small children, but there are fish tavernas right on the bay.',
      ],
    },
  },
  1990: {
    title: { gr: 'Ο Κούρος που δεν τελείωσε ποτέ', en: 'The kouros that was never finished' },
    paragraphs: {
      gr: [
        'Λίγο πάνω από τον Απόλλωνα, μέσα στο αρχαίο λατομείο, κείτεται μισοτελειωμένος ένας κούρος 10,7 μέτρων — τον εγκατέλειψαν εκεί πριν από 2.500 χρόνια και δεν μετακινήθηκε ποτέ.',
        'Το χωριό στη βόρεια άκρη του νησιού είναι μιάμιση ώρα δρόμος από τη Χώρα· η παραλία του έχει χοντρή άμμο και βότσαλο και ταβέρνες στην ακτή.',
      ],
      en: [
        'Just above Apollonas, inside the ancient quarry, lies an unfinished kouros 10.7 metres long — abandoned there 2,500 years ago and never moved.',
        'The village on the island’s northern tip is an hour and a half from Chora; its beach is coarse sand and pebble, with tavernas along the shore.',
      ],
    },
  },
  1993: {
    title: { gr: 'Δίπλα στο κεδρόδασος του Αλυκού', en: 'Beside the Alyko cedar forest' },
    paragraphs: {
      gr: [
        'Η Γλυφάδα ανήκει στη σειρά μικρών αμμουδερών όρμων γύρω από τη χερσόνησο του Αλυκού, εκεί όπου το πιο μεγάλο κεδρόδασος των Κυκλάδων κατεβαίνει στους αμμόλοφους.',
        'Είναι μη οργανωμένη, με ψιλή άμμο και ρηχό νερό, και η σκιά που θα βρεις είναι αυτή των κέδρων στο πίσω μέρος.',
      ],
      en: [
        'Glyfada belongs to the string of small sandy coves around the Alyko peninsula, where the largest cedar forest in the Cyclades comes down to the dunes.',
        'It is unorganised, with fine sand and shallow water, and any shade you find is from the cedars at the back.',
      ],
    },
  },
  2010: {
    title: { gr: 'Οι όρμοι ανάμεσα σε δύο μεγάλες παραλίες', en: 'The coves between two big beaches' },
    paragraphs: {
      gr: [
        'Ο Όρκος δεν είναι μία παραλία αλλά μια σειρά μικρών όρμων με άμμο και βράχια, ανάμεσα στην Πλάκα και τη Μικρή Βίγλα στη δυτική ακτή.',
        'Επειδή κάθε όρμος είναι μικρός, γεμίζει γρήγορα — αλλά αν ο πρώτος είναι γεμάτος, ο επόμενος είναι λίγα λεπτά περπάτημα.',
      ],
      en: [
        'Orkos is not one beach but a series of small sand-and-rock coves between Plaka and Mikri Vigla on the west coast.',
        'Because each cove is small it fills quickly — but if the first one is full, the next is a few minutes’ walk away.',
      ],
    },
  },
  1982: {
    title: { gr: 'Το τέλος της δυτικής αμμουδιάς', en: 'The end of the western sand' },
    paragraphs: {
      gr: [
        'Ο Αγιασσός είναι ο μεγάλος αμμώδης κόλπος στη νότια άκρη της δυτικής ακτής, εκεί όπου τελειώνει η σειρά των μεγάλων παραλιών της Νάξου.',
        'Έχει ψαροταβέρνες και το καλοκαίρι το λεωφορείο φτάνει ως εκεί, αλλά δεν έχει ξαπλώστρες ούτε beach bar — ο δρόμος μπορεί να γίνει και μέσω Σαγκρίου με άσφαλτο.',
      ],
      en: [
        'Agiassos is the wide sandy bay at the southern end of the west coast, where Naxos’s run of big beaches stops.',
        'It has fish tavernas and a summer bus service, but no sunbeds and no beach bar — the drive can be made on asphalt via Sangri.',
      ],
    },
  },
  2011: {
    title: { gr: 'Στην απόμερη νοτιοανατολική άκρη', en: 'On the remote south-east corner' },
    paragraphs: {
      gr: [
        'Ο Πάνορμος βρίσκεται στη νοτιοανατολική άκρη της Νάξου, μακριά από τον άξονα των τουριστικών παραλιών της δυτικής ακτής — η διαδρομή από τη Χώρα είναι μεγάλη και γι’ αυτό η παραλία μένει ήσυχη.',
        'Στην περιοχή σώζεται και πρωτοκυκλαδικός οικισμός· η ακτή είναι άμμος με βότσαλο και το νερό μπροστά ρηχό.',
      ],
      en: [
        'Panormos sits on the south-east corner of Naxos, off the axis of the west-coast tourist beaches — the drive from Chora is long, which is why it stays quiet.',
        'An Early Cycladic settlement survives nearby; the shore is sand with pebble and the water in front is shallow.',
      ],
    },
  },
  2017: {
    title: { gr: 'Η ψιλή άμμος της ανατολικής ακτής', en: 'Fine sand on the east coast' },
    paragraphs: {
      gr: [
        'Η Ψιλή Άμμος είναι από τις λίγες μεγάλες αμμουδιές της ανατολικής Νάξου, της πλευράς που οι περισσότεροι επισκέπτες δεν φτάνουν ποτέ.',
        'Δεν υπάρχουν οργανωμένες παροχές· η διαδρομή περνά από την ορεινή Νάξο και είναι μέρος της εκδρομής.',
      ],
      en: [
        'Psili Ammos is one of the few long sand beaches on eastern Naxos, the side most visitors never reach.',
        'There are no organised facilities; the drive crosses mountainous Naxos and is part of the trip.',
      ],
    },
  },
  2013: {
    title: { gr: 'Εκεί που σταματά ο δρόμος των παραλιών', en: 'Where the beach road stops' },
    paragraphs: {
      gr: [
        'Το Πυργάκι είναι η τελευταία οργανωμένη παραλία της δυτικής ακτής, μετά το Αλυκό — από εκεί και κάτω ο δρόμος στρίβει στην ενδοχώρα.',
        'Έχει ψιλή άμμο, ρηχό νερό και ταβέρνες, με σαφώς λιγότερο κόσμο από τον Άγιο Προκόπιο ή την Αγία Άννα.',
      ],
      en: [
        'Pyrgaki is the last organised beach on the west coast, past Alyko — beyond it the road turns inland.',
        'It has fine sand, shallow water and tavernas, with noticeably fewer people than Agios Prokopios or Agia Anna.',
      ],
    },
  },
  2019: {
    title: { gr: 'Το όνομα που έμεινε', en: 'The name that stuck' },
    paragraphs: {
      gr: [
        'Η Χαβάη πήρε το όνομά της από το χρώμα του νερού της, και σήμερα το λατινικό «Hawaii» είναι πιο γνωστό από το ελληνικό — είναι ένας από τους όρμους της χερσονήσου του Αλυκού.',
        'Δεν είναι οργανωμένη, ούτε έχει σκιά· κάτω από τους αμμόλοφους υπάρχουν τα εγκαταλελειμμένα μπετά ενός ξενοδοχείου που δεν τελείωσε ποτέ, σήμερα σκεπασμένα με γκράφιτι.',
      ],
      en: [
        'Hawaii took its name from the colour of its water, and today the Latin name is better known than the Greek — it is one of the coves on the Alyko peninsula.',
        'It is not organised and has no shade; below the dunes stand the abandoned concrete shells of a hotel that was never finished, now covered in graffiti.',
      ],
    },
  },
};

const stories = JSON.parse(readFileSync(storiesPath, 'utf8'));
let added = 0;
let skipped = 0;

for (const [regionId, entries] of [['south-aegean-paros', PAROS], ['south-aegean-naxos', NAXOS]]) {
  stories[regionId] = stories[regionId] || {};
  for (const [id, story] of Object.entries(entries)) {
    if (stories[regionId][id]) { skipped += 1; console.log(`  = #${id} είχε ήδη κείμενο — δεν πειράχτηκε`); continue; }
    stories[regionId][id] = story;
    added += 1;
    console.log(`  + #${id} ${story.title.gr}`);
  }
}

console.log(`\n${added} νέα κείμενα, ${skipped} υπήρχαν ήδη${DRY ? ' (DRY RUN)' : ''}`);
if (!DRY) {
  writeFileSync(storiesPath, `${JSON.stringify(stories, null, 2)}\n`, 'utf8');
  console.log('Γράφτηκε data/beachStories.data.json');
}
