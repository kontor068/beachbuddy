// Second batch of curated "Πληροφορίες" texts for Paros + Naxos.
//
//   node scripts/addParosNaxosStories2.mjs --dry
//   node scripts/addParosNaxosStories2.mjs
//
// Same rule as the first batch: a beach gets a text only if there is something to say that
// the card does not already print. Where the only honest thing to write would be "sand,
// shallow, dirt road", the beach keeps no text at all — that is not a gap, it is the format
// refusing to pad.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storiesPath = path.join(rootDir, 'data', 'beachStories.data.json');
const DRY = process.argv.includes('--dry');

const PAROS = {
  2054: {
    title: { gr: 'Το όνομα το έδωσαν τα κεραμικά', en: 'The pottery gave it its name' },
    paragraphs: {
      gr: [
        'Τσουκαλιά θα πει «τσουκάλια», δηλαδή πήλινα σκεύη: στην περιοχή λειτουργούσε εργαστήριο κεραμικής από την αρχαιότητα, και θραύσματα αγγείων βρίσκονται ακόμα στην άμμο και στα χωράφια γύρω.',
        'Είναι μια εκτεθειμένη ακτή στην ανατολική Πάρο, στο τέλος χωματόδρομου, χωρίς καμία παροχή. Ο άνεμος εδώ σηκώνει κύμα πιο εύκολα απ’ ό,τι στις κλειστές παραλίες του νησιού.',
      ],
      en: [
        'Tsoukalia means "cooking pots": a pottery workshop operated in this area from antiquity, and fragments of vessels still turn up in the sand and the fields around it.',
        'It is an exposed shore on eastern Paros, at the end of a dirt road, with no facilities at all. Wind raises a sea here more easily than on the island’s enclosed beaches.',
      ],
    },
  },
  2044: {
    title: { gr: 'Το χωριό δίπλα στο αεροδρόμιο', en: 'The village next to the airport' },
    paragraphs: {
      gr: [
        'Η Αλυκή είναι το δεύτερο μεγαλύτερο παραθαλάσσιο χωριό της Πάρου και βρίσκεται δίπλα στο αεροδρόμιο του νησιού — από τις λίγες ελληνικές παραλίες όπου βλέπεις τα μικρά αεροπλάνα να προσγειώνονται.',
        'Ο κόλπος βλέπει νότια, έχει ρηχό νερό και σειρά από ψαροταβέρνες στην παραλιακή· είναι η επιλογή για όποιον θέλει φαγητό και μπάνιο στο ίδιο σημείο.',
      ],
      en: [
        'Aliki is the second-largest seaside village on Paros and sits next to the island’s airport — one of the few Greek beaches where you watch the small planes come in.',
        'The bay faces south, the water is shallow and a row of fish tavernas lines the front; it is the choice for anyone who wants lunch and a swim in the same place.',
      ],
    },
  },
  2048: {
    title: { gr: 'Η παραλία μέσα στη Νάουσα', en: 'The beach inside Naoussa' },
    paragraphs: {
      gr: [
        'Το Πιπέρι είναι η μικρή ακτή δίπλα στο ψαρολίμανο της Νάουσας — φτάνεις με τα πόδια από την πλατεία, χωρίς αυτοκίνητο και χωρίς λεωφορείο.',
        'Ακριβώς γι’ αυτό είναι πολυσύχναστη και μικρή· η βαθμολογία της είναι από τις χαμηλότερες της Πάρου, όχι επειδή είναι άσχημη αλλά επειδή γεμίζει.',
      ],
      en: [
        'Piperi is the small shore beside Naoussa’s fishing harbour — you walk there from the square, no car and no bus.',
        'That is exactly why it is busy and small; its rating is among the lowest on Paros, not because it is unpleasant but because it fills up.',
      ],
    },
  },
  2028: {
    title: { gr: 'Το χειμωνιάτικο αραξοβόλι', en: 'The winter anchorage' },
    paragraphs: {
      gr: [
        'Ο Δρυός ήταν παλιά καταφύγιο για τα καΐκια τον χειμώνα, χάρη στον μικρό προστατευμένο όρμο του — το χωριό μεγάλωσε γύρω από αυτό το λιμανάκι.',
        'Σήμερα είναι ένα ήσυχο παραθαλάσσιο χωριό στη νοτιοανατολική Πάρο, με χοντρή άμμο και βότσαλο και ταβέρνες στη σειρά των σπιτιών πίσω από την ακτή.',
      ],
      en: [
        'Dryos was once a winter refuge for caiques, thanks to its small enclosed inlet — the village grew up around that little harbour.',
        'Today it is a quiet seaside village on south-east Paros, with coarse sand and pebble and tavernas along the row of houses behind the shore.',
      ],
    },
  },
  2023: {
    title: { gr: 'Ψαροχώρι, όχι τουριστικό θέρετρο', en: 'A fishing village, not a resort' },
    paragraphs: {
      gr: [
        'Ο Αμπελάς είναι ένα μικρό ψαροχώρι λίγα χιλιόμετρα ανατολικά της Νάουσας, με λιμανάκι, βάρκες και ταβέρνες που ψαρεύουν οι ίδιες.',
        'Η ακτή του είναι μείγμα άμμου, βότσαλου και βράχων — δεν είναι η μεγάλη αμμουδιά για ολόκληρη τη μέρα, είναι η στάση για μεσημεριανό με θέα το λιμάνι.',
      ],
      en: [
        'Ampelas is a small fishing village a few kilometres east of Naoussa, with a little harbour, boats and tavernas that catch their own fish.',
        'Its shore mixes sand, pebble and rock — not the wide strand for a whole day, but the stop for lunch looking out over the harbour.',
      ],
    },
  },
  2052: {
    title: { gr: 'Μέσα στο πάρκο του Αγίου Ιωάννη Δέτη', en: 'Inside the Agios Ioannis Detis park' },
    paragraphs: {
      gr: [
        'Η Τούρκου Άμμος βρίσκεται στη χερσόνησο βόρεια της Νάουσας, στο περιβαλλοντικό πάρκο του Αγίου Ιωάννη Δέτη — φτάνεις περπατώντας από τα μονοπάτια του πάρκου, όχι με αυτοκίνητο μέχρι την άμμο.',
        'Δεν υπάρχει τίποτα πάνω της. Στην ίδια χερσόνησο είναι και το Μοναστήρι, που έχει τις παροχές που εδώ λείπουν.',
      ],
      en: [
        'Tourkou Ammos lies on the peninsula north of Naoussa, inside the Agios Ioannis Detis environmental park — you walk in on the park’s paths rather than drive to the sand.',
        'There is nothing on it. Monastiri is on the same peninsula and has the facilities this one lacks.',
      ],
    },
  },
  3176: {
    title: { gr: 'Το λιμάνι για τις Μικρές Κυκλάδες', en: 'The harbour for the Small Cyclades' },
    paragraphs: {
      gr: [
        'Το Πίσω Λιβάδι είναι ψαροχώρι με μικρό λιμάνι στην ανατολική Πάρο — από εδώ φεύγουν καΐκια και μικρά πλοία προς τη Νάξο και τις Μικρές Κυκλάδες.',
        'Η αμμουδιά του συνεχίζει νότια προς τον Λογαρά και οι δύο ενώνονται με τα πόδια· γύρω από το λιμανάκι υπάρχουν ταβέρνες και καταλύματα.',
      ],
      en: [
        'Piso Livadi is a fishing village with a small harbour on eastern Paros — caiques and small boats leave from here for Naxos and the Small Cyclades.',
        'Its sand continues south towards Logaras and the two join on foot; there are tavernas and rooms around the little harbour.',
      ],
    },
  },
};

const NAXOS = {
  1994: {
    title: { gr: 'Τα ερείπια κάτω από το νερό', en: 'The ruins under the water' },
    paragraphs: {
      gr: [
        'Στη Γρόττα, κάτω από τη Χώρα της Νάξου, διακρίνονται μέσα στο ρηχό νερό λείψανα μυκηναϊκού οικισμού που βυθίστηκε — το όνομα σημαίνει «σπηλιά», από τις κοιλότητες που έχει σκάψει το κύμα στα βράχια.',
        'Δεν είναι παραλία για ξάπλωμα: το έδαφος είναι βραχώδες και η ακτή δέχεται τον βοριά. Είναι σημείο για βόλτα και για κολύμπι με μάσκα όταν η θάλασσα το επιτρέπει.',
      ],
      en: [
        'At Grotta, below the town of Naxos, the remains of a submerged Mycenaean settlement can be made out in the shallow water — the name means "cave", after the hollows the sea has cut into the rock.',
        'It is not a beach for lying down: the ground is rocky and the shore takes the north wind. It is a place to walk and to snorkel when the sea allows.',
      ],
    },
  },
  1988: {
    title: { gr: 'Η ακτή που δουλεύει ο βοριάς', en: 'The shore the north wind works' },
    paragraphs: {
      gr: [
        'Ο Αμμίτης είναι από τις μεγάλες ανοιχτές ακτές της βορειοδυτικής Νάξου, εκτεθειμένη στο μελτέμι — γι’ αυτό η άμμος είναι χοντρή και το νερό σπάνια είναι λάδι.',
        'Δεν έχει καμία υποδομή και ο δρόμος καταλήγει σε χωματόδρομο. Είναι επιλογή για μέρες με λίγο αέρα ή για όποιον ψάχνει έρημη ακτή, όχι για οικογενειακό μπάνιο σε μελτεμάκι.',
      ],
      en: [
        'Ammitis is one of the wide open shores of north-west Naxos, exposed to the meltemi — which is why its sand is coarse and the water is rarely glass.',
        'It has no facilities and the road ends in dirt. It suits low-wind days or anyone after an empty shore, not a family swim when the meltemi is up.',
      ],
    },
  },
  1995: {
    title: { gr: 'Στην άλλη πλευρά του βουνού', en: 'On the other side of the mountain' },
    paragraphs: {
      gr: [
        'Ο Καλαντός είναι ο μεγάλος αμμώδης κόλπος της νότιας Νάξου· φτάνεις περνώντας από το Φιλότι και την ορεινή ενδοχώρα, μια διαδρομή που κρατά τους περισσότερους μακριά.',
        'Στον όρμο λειτουργεί ταβέρνα το καλοκαίρι, αλλά τίποτα άλλο. Το νερό είναι ρηχό και η άμμος ψιλή.',
      ],
      en: [
        'Kalantos is the wide sandy bay of southern Naxos; you get there through Filoti and the mountainous interior, a drive that keeps most people away.',
        'A taverna operates on the bay in summer, but nothing else. The water is shallow and the sand fine.',
      ],
    },
  },
  1986: {
    title: { gr: 'Ο όρμος μετά τη Μουτσούνα', en: 'The cove past Moutsouna' },
    paragraphs: {
      gr: [
        'Ο Αζαλάς είναι μικρός βοτσαλωτός όρμος στην ανατολική Νάξο, λίγο μετά τη Μουτσούνα, με νερό που βαθαίνει γρήγορα.',
        'Έχει σκιά από δέντρα και μια ταβέρνα· είναι από τα σημεία που φτάνεις αφού έχεις ήδη διασχίσει όλο το νησί, οπότε σπάνια είναι γεμάτος.',
      ],
      en: [
        'Azalas is a small pebbled cove on eastern Naxos, just past Moutsouna, where the water deepens quickly.',
        'It has tree shade and a taverna; it is one of those places you reach after crossing the whole island, so it is rarely crowded.',
      ],
    },
  },
  1997: {
    title: { gr: 'Η ήσυχη συνέχεια της δυτικής ακτής', en: 'The quiet continuation of the west coast' },
    paragraphs: {
      gr: [
        'Το Καστράκι είναι μια μακριά λωρίδα ψιλής άμμου ανάμεσα στη Μικρή Βίγλα και το Αλυκό — η ίδια θάλασσα με τον Άγιο Προκόπιο, με πολύ λιγότερο κόσμο.',
        'Το μήκος της είναι το χαρακτηριστικό της: όσο κι αν γεμίσει το οργανωμένο κομμάτι, λίγα λεπτά περπάτημα και είσαι μόνος.',
      ],
      en: [
        'Kastraki is a long ribbon of fine sand between Mikri Vigla and Alyko — the same sea as Agios Prokopios, with far fewer people.',
        'Its length is the point: however full the organised section gets, a few minutes’ walk and you are on your own.',
      ],
    },
  },
  2014: {
    title: { gr: 'Μόνο με σκάφος', en: 'By boat only' },
    paragraphs: {
      gr: [
        'Η Ρίνα δεν έχει δρόμο: φτάνεις μόνο με σκάφος, στη νοτιοανατολική ακτή της Νάξου. Γι’ αυτό δεν εμφανίζεται ποτέ στις προτάσεις μας όταν φυσάει δυνατά.',
        'Η ακτή είναι βότσαλο και βράχος και το νερό βαθαίνει απότομα — ό,τι χρειάζεσαι, το φέρνεις μαζί σου.',
      ],
      en: [
        'Rina has no road: you reach it only by boat, on the south-east coast of Naxos. That is why it never appears in our suggestions when it blows hard.',
        'The shore is pebble and rock and the water deepens sharply — whatever you need, you bring with you.',
      ],
    },
  },
  2016: {
    title: { gr: 'Χίλιες βρύσες', en: 'A thousand springs' },
    paragraphs: {
      gr: [
        'Το όνομα «Χίλια Βρύση» έρχεται από τα νερά που κατεβαίνουν στην περιοχή — σπάνιο πράγμα για κυκλαδίτικη ακτή, όπου το γλυκό νερό είναι ο κανόνας που λείπει.',
        'Είναι στη βόρεια Νάξο, με βότσαλο και βράχια, στο τέλος χωματόδρομου και χωρίς καμία παροχή.',
      ],
      en: [
        'The name Chilia Vrysi — "a thousand springs" — comes from the water that runs down here, unusual for a Cycladic shore, where fresh water is the rule that is missing.',
        'It is on northern Naxos, pebble and rock, at the end of a dirt road and with no facilities.',
      ],
    },
  },
  1998: {
    title: { gr: 'Το κεδρόδασος φτάνει στην άμμο', en: 'Where the cedars reach the sand' },
    paragraphs: {
      gr: [
        'Ο Κέδρος πήρε το όνομά του από το δάσος που τον περιβάλλει: η χερσόνησος του Αλυκού έχει το μεγαλύτερο παραθαλάσσιο κεδρόδασος των Κυκλάδων, φυτεμένο για να συγκρατεί τους αμμόλοφους.',
        'Είναι ένας από τους μικρούς όρμους της χερσονήσου, με ψιλή άμμο και ρηχό νερό, χωρίς οργανωμένες παροχές.',
      ],
      en: [
        'Kedros takes its name from the forest around it: the Alyko peninsula holds the largest coastal cedar wood in the Cyclades, planted to hold the dunes in place.',
        'It is one of the small coves of that peninsula, with fine sand and shallow water and no organised facilities.',
      ],
    },
  },
};

const stories = JSON.parse(readFileSync(storiesPath, 'utf8'));
let added = 0, skipped = 0;
for (const [regionId, entries] of [['south-aegean-paros', PAROS], ['south-aegean-naxos', NAXOS]]) {
  stories[regionId] = stories[regionId] || {};
  for (const [id, story] of Object.entries(entries)) {
    if (stories[regionId][id]) { skipped += 1; console.log(`  = #${id} είχε ήδη κείμενο`); continue; }
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
