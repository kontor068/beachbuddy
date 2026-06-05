
import React, { useMemo, useEffect } from 'react';
import { Beach, LanguageCode, ForecastItem } from '../types';
import { Translation } from '../types';
import { StarRating } from './BeachCard';
import { generateBeachDayPlan } from '../services/beachPlannerService';
import { BeachDayPlanner } from './BeachDayPlanner';
import { displayBeachName } from '../utils/localization';

interface BeachDetailModalProps {
  beach: Beach | null;
  isOpen: boolean;
  onClose: () => void;
  language: LanguageCode;
  t: Translation;
  windInfo: string;
  islandName: string;
  hourlyForecast: ForecastItem[];
}

// --- Extended Static Content Database with Real Local Tips & Images ---

type TipContent = { tip: string, pack: string[], feature: string };
type BeachData = { image?: string; en: TipContent; gr: TipContent };

const RAW_TIPS: Record<string, BeachData> = {
    // --- MILOS ---
    'Sarakiniko': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Sarakiniko_Milos.jpg/800px-Sarakiniko_Milos.jpg",
        en: { feature: "Lunar landscape", tip: "Go before 8 AM for photos without people. Explore the mining tunnels on the right side.", pack: ["Sunglasses (white rock glare)", "Water", "GoPro"] },
        gr: { feature: "Σεληνιακό τοπίο", tip: "Πηγαίνετε πριν τις 8 π.μ. για φωτογραφίες χωρίς κόσμο. Εξερευνήστε τις στοές ορυχείων στα δεξιά.", pack: ["Γυαλιά Ηλίου (αντανάκλαση)", "Νερό", "GoPro"] }
    },
    'Tsigrado': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Milos_Tsigrado_Beach.jpg/800px-Milos_Tsigrado_Beach.jpg",
        en: { feature: "Hidden cove", tip: "You have to climb down a wooden ladder and use a rope. Not for the faint-hearted!", pack: ["Backpack (hands free)", "GoPro", "Water"] },
        gr: { feature: "Κρυφή παραλία", tip: "Η κατάβαση γίνεται με ξύλινη σκάλα και σκοινί. Δεν ενδείκνυται για υψοφοβικούς!", pack: ["Σακίδιο πλάτης (ελεύθερα χέρια)", "GoPro", "Νερό"] }
    },
    'Kleftiko': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Kleftiko_Milos.jpg/800px-Kleftiko_Milos.jpg",
        en: { feature: "Pirate hideout", tip: "Accessible only by boat. Take a tour that includes snorkeling in the caves.", pack: ["Snorkeling gear", "Sunscreen", "Waterproof camera"] },
        gr: { feature: "Πειρατικό λημέρι", tip: "Πρόσβαση μόνο με σκάφος. Επιλέξτε εκδρομή που περιλαμβάνει μπάνιο στις σπηλιές.", pack: ["Μάσκα & Βατραχοπέδιλα", "Αντηλιακό", "Αδιάβροχη κάμερα"] }
    },
    'Fyriplaka': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Firiplaka_beach.jpg/800px-Firiplaka_beach.jpg",
        en: { feature: "Volcanic cliffs", tip: "Walk past the organized section to find colorful volcanic rocks and quieter spots.", pack: ["Umbrella", "Water", "Snacks"] },
        gr: { feature: "Ηφαιστειακά βράχια", tip: "Περπατήστε μετά το οργανωμένο κομμάτι για να δείτε τα χρωματιστά βράχια και να βρείτε ησυχία.", pack: ["Ομπρέλα", "Νερό", "Σνακ"] }
    },
    
    // --- CRETE ---
    'Elafonisi': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Elafonisi_beach%2C_Crete.jpg/800px-Elafonisi_beach%2C_Crete.jpg",
        en: { feature: "Pink sand lagoon", tip: "Walk across the shallow lagoon to the islet. The sand is pinkest near the water's edge.", pack: ["Umbrella (often windy)", "Phone/Camera", "Water"] },
        gr: { feature: "Λιμνοθάλασσα με ροζ άμμο", tip: "Περπατήστε απέναντι στο νησάκι. Η άμμος είναι πιο ροζ στην ακροθαλασσιά.", pack: ["Ομπρέλα (συχνά φυσάει)", "Κινητό/Κάμερα", "Νερό"] }
    },
    'Balos': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Balos_Beach_Gramvousa_Crete_Greece.jpg/800px-Balos_Beach_Gramvousa_Crete_Greece.jpg",
        en: { feature: "Exotic lagoon", tip: "The boat is easier, but hiking down (20min) offers the famous panoramic view.", pack: ["Sneakers (for hiking)", "Hat", "Water"] },
        gr: { feature: "Εξωτική λιμνοθάλασσα", tip: "Το καραβάκι είναι άνετο, αλλά η πεζοπορία (20') προσφέρει την διάσημη πανοραμική θέα.", pack: ["Αθλητικά παπούτσια", "Καπέλο", "Νερό"] }
    },
    'Falasarna': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Falasarna_Beach.jpg/800px-Falasarna_Beach.jpg",
        en: { feature: "Big waves & sunset", tip: "Ideally visit in the afternoon. It has one of the best sunsets in Crete.", pack: ["Camera", "Sweater (evening)", "Beach racket"] },
        gr: { feature: "Κύματα & ηλιοβασίλεμα", tip: "Ιδανική για απόγευμα. Έχει ένα από τα καλύτερα ηλιοβασιλέματα στην Κρήτη.", pack: ["Κάμερα", "Ζακέτα (βράδυ)", "Ρακέτες"] }
    },
    'Seitan Limania': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Seitan_Limania_beach.jpg/800px-Seitan_Limania_beach.jpg",
        en: { feature: "Zig-zag cove", tip: "Steep hike down rocky path. Watch out for the goats, they will try to eat your food!", pack: ["Sneakers", "No open food", "Water"] },
        gr: { feature: "Στενό φιόρδ", tip: "Απότομη κατάβαση σε μονοπάτι. Προσοχή στα κατσίκια, κλέβουν φαγητό!", pack: ["Αθλητικά", "Κλειστό φαγητό", "Νερό"] }
    },
    'Preveli (alt)': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Preveli_Lake.jpg/800px-Preveli_Lake.jpg",
        en: { feature: "Palm forest", tip: "Don't just swim; walk upstream along the river through the palm forest.", pack: ["Water shoes", "Hat", "Camera"] },
        gr: { feature: "Φοινικόδασος", tip: "Μην μείνετε μόνο στη θάλασσα. Περπατήστε κατά μήκος του ποταμού μέσα στο φοινικόδασος.", pack: ["Παπούτσια θάλασσας", "Καπέλο", "Κάμερα"] }
    },
    'Matala (alt)': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Matala_caves.jpg/800px-Matala_caves.jpg",
        en: { feature: "Hippie caves", tip: "Explore the carved caves where hippies lived in the 60s/70s (small fee).", pack: ["Sneakers", "Small change (ticket)", "Water"] },
        gr: { feature: "Σπηλιές Χίπις", tip: "Εξερευνήστε τις λαξευμένες σπηλιές που ζούσαν οι χίπις (έχει εισιτήριο).", pack: ["Αθλητικά", "Ψιλά (εισιτήριο)", "Νερό"] }
    },
    'Vai': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Vai_Palm_Forest.jpg/800px-Vai_Palm_Forest.jpg",
        en: { feature: "Palm forest", tip: "Climb the stairs on the right for a panoramic photo of the palm forest.", pack: ["Camera", "Water", "Snacks"] },
        gr: { feature: "Φοινικόδασος", tip: "Ανεβείτε τα σκαλιά στα δεξιά για πανοραμική φωτογραφία του δάσους.", pack: ["Κάμερα", "Νερό", "Σνακ"] }
    },

    // --- IONIAN ---
    'Navagio': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Navagio_Vol_2.jpg/800px-Navagio_Vol_2.jpg",
        en: { feature: "Shipwreck", tip: "The viewpoint is up on the cliff (car needed). The beach itself is boat-only access.", pack: ["Camera", "Water", "Hat"] },
        gr: { feature: "Ναυάγιο", tip: "Η διάσημη θέα είναι από τον γκρεμό (με ΙΧ). Στην παραλία πάτε μόνο με σκάφος.", pack: ["Κάμερα", "Νερό", "Καπέλο"] }
    },
    'Porto Katsiki': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Porto_Katsiki_Lefkada_May_2012.jpg/800px-Porto_Katsiki_Lefkada_May_2012.jpg",
        en: { feature: "White cliffs", tip: "100 steps to walk down. In the afternoon the cliffs block the sun early.", pack: ["Water (canteen is up)", "Umbrella", "Camera"] },
        gr: { feature: "Λευκοί γκρεμοί", tip: "100 σκαλοπάτια για κάτω. Το απόγευμα ο βράχος κρύβει τον ήλιο νωρίς.", pack: ["Νερό (καντίνα πάνω)", "Ομπρέλα", "Κάμερα"] }
    },
    'Myrtos': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Myrtos_beach_kefalonia_greece.JPG/800px-Myrtos_beach_kefalonia_greece.JPG",
        en: { feature: "Electric blue water", tip: "The water gets deep very fast. Be careful if there is a North wind (big waves).", pack: ["Umbrella", "Water", "Sunscreen"] },
        gr: { feature: "Ηλεκτρίκ μπλε νερά", tip: "Τα νερά βαθαίνουν απότομα. Προσοχή αν φυσάει Βοριάς (μεγάλα κύματα).", pack: ["Ομπρέλα", "Νερό", "Αντηλιακό"] }
    },
    'Egremni': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Egremni_beach.jpg/800px-Egremni_beach.jpg",
        en: { feature: "Endless blue", tip: "Many steps to go down, but the water color is unreal. Often quieter than Porto Katsiki.", pack: ["Water", "Walking shoes", "Snacks"] },
        gr: { feature: "Απέραντο γαλάζιο", tip: "Πολλά σκαλιά, αλλά το χρώμα του νερού είναι εξωπραγματικό. Πιο ήσυχα από το Πόρτο Κατσίκι.", pack: ["Νερό", "Παπούτσια περπατήματος", "Σνακ"] }
    },
    'Xi Beach': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Xi_beach_Kefalonia.jpg/800px-Xi_beach_Kefalonia.jpg",
        en: { feature: "Red sand", tip: "Rub the grey clay from the cliffs on your skin for a natural spa treatment.", pack: ["Old swimsuit (clay)", "Towel", "Water"] },
        gr: { feature: "Κόκκινη άμμος", tip: "Χρησιμοποιήστε τον γκρίζο άργιλο από τα βράχια για φυσικό σπα στο δέρμα σας.", pack: ["Παλιό μαγιό (λόγω πηλού)", "Πετσέτα", "Νερό"] }
    },
    'Canal d\'Amour': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Canal_d%27Amour_Corfu.jpg/800px-Canal_d%27Amour_Corfu.jpg",
        en: { feature: "Sandstone coves", tip: "Legend says if you swim through the narrow canal, you'll find true love.", pack: ["Camera", "Towel", "Water shoes"] },
        gr: { feature: "Αμμόλίθινα φιόρδ", tip: "Ο θρύλος λέει πως αν κολυμπήσεις στο στενό πέρασμα, θα βρεις την αληθινή αγάπη.", pack: ["Κάμερα", "Πετσέτα", "Παπούτσια θάλασσας"] }
    },
    'Gerakas (alt)': {
        en: { feature: "Turtle nesting", tip: "Protected area for Caretta-Caretta. No access allowed after sunset.", pack: ["Umbrella (limited)", "Water", "Snacks"] },
        gr: { feature: "Καταφύγιο χελώνας", tip: "Προστατευόμενη περιοχή Caretta-Caretta. Απαγορεύεται η πρόσβαση μετά τη δύση.", pack: ["Ομπρέλα (περιορισμένες)", "Νερό", "Σνακ"] }
    },
    'Voidokilia': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Voidokilia.jpg/800px-Voidokilia.jpg",
        en: { feature: "Omega shape", tip: "Climb to Paliokastro castle for the iconic view of the 'Omega' shape.", pack: ["Hiking shoes", "Water", "Camera"] },
        gr: { feature: "Σχήμα Ωμέγα", tip: "Ανεβείτε στο Παλιόκαστρο για την εμβληματική θέα του σχήματος 'Ω'.", pack: ["Παπούτσια πεζοπορίας", "Νερό", "Κάμερα"] }
    },

    // --- CYCLADES ---
    'Kolymbithres': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Kolymbithres_Beach_Paros.jpg/800px-Kolymbithres_Beach_Paros.jpg",
        en: { feature: "Sculpted rocks", tip: "Arrive early to claim one of the small private coves formed by the granite rocks.", pack: ["Snorkeling mask", "Towel", "Water"] },
        gr: { feature: "Γλυπτά βράχια", tip: "Πηγαίνετε νωρίς για να πιάσετε μια από τις 'ατομικές' πισίνες ανάμεσα στα βράχια.", pack: ["Μάσκα", "Πετσέτα", "Νερό"] }
    },
    'Super Paradise': {
        en: { feature: "Party beach", tip: "The party starts loud after 4:00 PM. Go morning for a calm swim.", pack: ["Money", "Swimsuit", "Energy"] },
        gr: { feature: "Πάρτι", tip: "Το πάρτι ανάβει μετά τις 4:00 μ.μ. Πηγαίνετε πρωί αν θέλετε ήρεμο μπάνιο.", pack: ["Χρήματα", "Μαγιό", "Ενέργεια"] }
    },
    'Red Beach': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Red_Beach_Santorini.jpg/800px-Red_Beach_Santorini.jpg",
        en: { feature: "Red cliffs", tip: "Access can be dangerous due to falling rocks. Safer to view from a boat taxi.", pack: ["Camera", "Hat", "Water"] },
        gr: { feature: "Κόκκινα βράχια", tip: "Προσοχή στις κατολισθήσεις. Πιο ασφαλές να πάτε με καραβάκι από το Ακρωτήρι.", pack: ["Κάμερα", "Καπέλο", "Νερό"] }
    },
    'Pori': {
        en: { feature: "Caves & Cliffs", tip: "Walk to the Devil's Eye (Gala) and the sea caves nearby. Stunning scenery.", pack: ["Sneakers", "Water", "Camera"] },
        gr: { feature: "Σπηλιές & Γκρεμοί", tip: "Περπατήστε μέχρι το Γάλα και τις θαλασσινές σπηλιές (Ξυλομπάτης).", pack: ["Αθλητικά", "Νερό", "Κάμερα"] }
    },
    'Mylopotas': {
        en: { feature: "Golden sand", tip: "Visit Far Out for a party, or walk to the far end for quiet spots.", pack: ["Sunscreen", "Beach racket", "Money"] },
        gr: { feature: "Χρυσή άμμος", tip: "Στο Far Out έχει πάρτι, στην άλλη άκρη της παραλίας έχει ησυχία.", pack: ["Αντηλιακό", "Ρακέτες", "Χρήματα"] }
    },
    'Kolona': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Kolona_Beach_Kythnos.jpg/800px-Kolona_Beach_Kythnos.jpg",
        en: { feature: "Double beach", tip: "A strip of sand with sea on both sides. Hike up to the chapel for the view.", pack: ["Sneakers", "Water", "Powerbank"] },
        gr: { feature: "Διπλή παραλία", tip: "Λωρίδα άμμου με θάλασσα και στις δύο πλευρές. Ανεβείτε στο εκκλησάκι για θέα.", pack: ["Αθλητικά", "Νερό", "Powerbank"] }
    },
    
    // --- MAINLAND & OTHERS ---
    'Kavourotrypes': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Kavourotrypes_Chalkidiki.jpg/800px-Kavourotrypes_Chalkidiki.jpg",
        en: { feature: "Orange rocks", tip: "Look for the mermaid carved into the rock. Can get very crowded in August.", pack: ["Umbrella", "Water", "Mask"] },
        gr: { feature: "Πορτοκαλί βράχια", tip: "Ψάξτε τη γοργόνα σκαλισμένη στον βράχο. Πολύς κόσμος τον Αύγουστο.", pack: ["Ομπρέλα", "Νερό", "Μάσκα"] }
    },
    'Giola': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Giola_Thassos.jpg/800px-Giola_Thassos.jpg",
        en: { feature: "Natural pool", tip: "It's a natural pool carved in rock. The water is warmer than the sea.", pack: ["Sneakers (rocky path)", "GoPro", "Towel"] },
        gr: { feature: "Φυσική πισίνα", tip: "Φυσική πισίνα μέσα στον βράχο. Το νερό είναι πιο ζεστό από τη θάλασσα.", pack: ["Αθλητικά (βράχια)", "GoPro", "Πετσέτα"] }
    },
    'Saliara': {
        en: { feature: "Marble beach", tip: "The beach is made of tiny white marble pebbles. The water color is unique.", pack: ["Sunglasses", "Sunscreen", "Camera"] },
        gr: { feature: "Μαρμάρινη παραλία", tip: "Η παραλία αποτελείται από ψηφίδες λευκού μαρμάρου. Μοναδικό χρώμα νερού.", pack: ["Γυαλιά Ηλίου", "Αντηλιακό", "Κάμερα"] }
    },
    'Schinias': {
        en: { feature: "Pine forest", tip: "Perfect for families. The pine forest reaches the sand, offering natural shade.", pack: ["Picnic food", "Mats", "Ball"] },
        gr: { feature: "Πευκοδάσος", tip: "Ιδανική για οικογένειες. Το πευκοδάσος φτάνει στην άμμο προσφέροντας φυσική σκιά.", pack: ["Φαγητό για πικνίκ", "Ψάθες", "Μπάλα"] }
    },
    'Legrena': {
        en: { feature: "Quiet coves", tip: "Find the small coves (KAPE) just before the main beach for more privacy.", pack: ["Umbrella", "Water", "Snacks"] },
        gr: { feature: "Ήσυχοι κολπίσκοι", tip: "Βρείτε τους κολπίσκους (ΚΑΠΕ) λίγο πριν την κύρια παραλία για απομόνωση.", pack: ["Ομπρέλα", "Νερό", "Σνακ"] }
    },
    'Lalaria': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Lalaria_beach_Skiathos.jpg/800px-Lalaria_beach_Skiathos.jpg",
        en: { feature: "White pebbles", tip: "Accessible only by boat. Taking pebbles as souvenirs is strictly forbidden.", pack: ["Water", "Hat", "Camera"] },
        gr: { feature: "Λευκά βότσαλα", tip: "Πρόσβαση μόνο με καραβάκι. Απαγορεύεται αυστηρά να πάρετε βότσαλα μαζί σας.", pack: ["Νερό", "Καπέλο", "Κάμερα"] }
    },
    'Koukounaries': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Koukounaries_beach.jpg/800px-Koukounaries_beach.jpg",
        en: { feature: "Ecological park", tip: "Behind the beach is Lake Strofilia, a protected wetland with swans.", pack: ["Mosquito repellent", "Towel", "Book"] },
        gr: { feature: "Οικολογικό πάρκο", tip: "Πίσω από την παραλία είναι η λίμνη Στροφυλιά, υδροβιότοπος με κύκνους.", pack: ["Αντικουνουπικό", "Πετσέτα", "Βιβλίο"] }
    },
    'Paradise': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Paradise_Beach_Mykonos.jpg/800px-Paradise_Beach_Mykonos.jpg",
        en: { feature: "Party beach", tip: "World-famous for its beach parties. Arrive early for the best spots or go in the evening for the vibe.", pack: ["Sunglasses", "Dancing shoes", "Energy drinks"] },
        gr: { feature: "Πάρτι παραλία", tip: "Παγκοσμίως γνωστή για τα πάρτι της. Πηγαίνετε νωρίς για τις καλύτερες θέσεις ή βράδυ για την ατμόσφαιρα.", pack: ["Γυαλιά Ηλίου", "Παπούτσια χορού", "Ενεργειακά ποτά"] }
    },
    'Kamari': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Kamari_Beach_Santorini.jpg/800px-Kamari_Beach_Santorini.jpg",
        en: { feature: "Black sand", tip: "Volcanic black sand beach with caldera views. Perfect for sunset watching.", pack: ["Sunscreen", "Hat", "Camera"] },
        gr: { feature: "Μαύρη άμμος", tip: "Ηφαιστειακή μαύρη αμμουδιά με θέα στον κρατήρα. Ιδανική για ηλιοβασιλέματα.", pack: ["Αντηλιακό", "Καπέλο", "Κάμερα"] }
    },
    'Καλαφάτη': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Kalafatis_Beach_Mykonos.jpg/800px-Kalafatis_Beach_Mykonos.jpg",
        en: { feature: "Luxury beach", tip: "One of Mykonos' most beautiful beaches with crystal waters and luxury resorts.", pack: ["Sunscreen", "Towel", "Cocktail money"] },
        gr: { feature: "Πολυτελής παραλία", tip: "Μία από τις πιο όμορφες παραλίες της Μυκόνου με κρυστάλλινα νερά και ξενοδοχεία πολυτελείας.", pack: ["Αντηλιακό", "Πετσέτα", "Χρήματα για κοκτέιλ"] }
    },
    'Agios Sostis': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Agios_Sostis_Zakynthos.jpg/800px-Agios_Sostis_Zakynthos.jpg",
        en: { feature: "Shipwreck beach", tip: "Famous for the shipwreck and clear waters. Boat access only for the main area.", pack: ["Snorkeling gear", "Water", "Camera"] },
        gr: { feature: "Παραλία ναυαγίου", tip: "Διάσημη για το ναυάγιο και τα καθαρά νερά. Πρόσβαση με σκάφος για το κύριο σημείο.", pack: ["Εξοπλισμός snorkeling", "Νερό", "Κάμερα"] }
    },
    'Faliraki': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Faliraki_Beach.jpg/800px-Faliraki_Beach.jpg",
        en: { feature: "Resort beach", tip: "Popular with families and young people. Many water sports and beach bars available.", pack: ["Sunscreen", "Beach toys", "Money for activities"] },
        gr: { feature: "Παραλία resort", tip: "Δημοφιλής σε οικογένειες και νέους. Πολλά θαλάσσια σπορ και beach bars.", pack: ["Αντηλιακό", "Παιχνίδια παραλίας", "Χρήματα για δραστηριότητες"] }
    },
    'Lindos': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Lindos_Beach_Rhodes.jpg/800px-Lindos_Beach_Rhodes.jpg",
        en: { feature: "Acropolis views", tip: "Combine beach time with visiting the ancient acropolis. The climb is worth the view!", pack: ["Comfortable shoes", "Hat", "Camera"] },
        gr: { feature: "Θέα ακρόπολης", tip: "Συνδυάστε την παραλία με επίσκεψη στην αρχαία ακρόπολη. Η ανάβαση αξίζει την θέα!", pack: ["Άνετα παπούτσια", "Καπέλο", "Κάμερα"] }
    },
    'Tsambika': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Tsambika_Beach_Rhodes.jpg/800px-Tsambika_Beach_Rhodes.jpg",
        en: { feature: "Cliff-top beach", tip: "Secluded and pristine. The descent can be challenging, but the reward is paradise.", pack: ["Good shoes", "Water", "Snacks"] },
        gr: { feature: "Παραλία βράχων", tip: "Απομονωμένη και παρθένα. Η κάθοδος μπορεί να είναι δύσκολη, αλλά η ανταμοιβή είναι ο παράδεισος.", pack: ["Καλά παπούτσια", "Νερό", "Σνακ"] }
    },
    'Perissa': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Perissa_Beach_Santorini.jpg/800px-Perissa_Beach_Santorini.jpg",
        en: { feature: "Black sand", tip: "Volcanic black sand beach. Great for surfing when winds are strong. Many tavernas nearby.", pack: ["Sunscreen", "Water", "Surfboard rental"] },
        gr: { feature: "Μαύρη άμμος", tip: "Ηφαιστειακή μαύρη αμμουδιά. Ιδανική για surfing όταν φυσάει. Πολλές ταβέρνες κοντά.", pack: ["Αντηλιακό", "Νερό", "Ενοικίαση surfboard"] }
    },
    'Paleokastritsa': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Paleokastritsa_Beach_Corfu.jpg/800px-Paleokastritsa_Beach_Corfu.jpg",
        en: { feature: "Multi-cove beach", tip: "Six beautiful coves connected by paths. Visit the monastery for panoramic views.", pack: ["Comfortable shoes", "Swimsuit", "Camera"] },
        gr: { feature: "Πολυ-καλντερίμια", tip: "Έξι όμορφα καλντερίμια συνδεδεμένα με μονοπάτια. Επισκεφθείτε το μοναστήρι για πανοραμική θέα.", pack: ["Άνετα παπούτσια", "Μαγιό", "Κάμερα"] }
    },
    'Laganas': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Laganas_Beach_Zakynthos.jpg/800px-Laganas_Beach_Zakynthos.jpg",
        en: { feature: "Party destination", tip: "Famous for nightlife. Respect the turtle nesting areas - stay on designated paths.", pack: ["Party clothes", "Sunscreen", "Water"] },
        gr: { feature: "Προορισμός πάρτι", tip: "Διάσημη για νυχτερινή ζωή. Σεβαστείτε τις περιοχές φωλιάσματος χελωνών - μείνετε στα σηματοδοτημένα μονοπάτια.", pack: ["Ρούχα πάρτι", "Αντηλιακό", "Νερό"] }
    },
    'Gerakas': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Gerakas_Beach_Zakynthos.jpg/800px-Gerakas_Beach_Zakynthos.jpg",
        en: { feature: "Turtle sanctuary", tip: "Protected area for loggerhead turtles. No umbrellas or sunbeds allowed. Visit early morning.", pack: ["Hat", "Water", "Binoculars"] },
        gr: { feature: "Καταφύγιο χελωνών", tip: "Προστατευόμενη περιοχή για χελώνες καρέτα-καρέτα. Δεν επιτρέπονται ομπρέλες ή ξαπλώστρες. Επισκεφθείτε πρωί.", pack: ["Καπέλο", "Νερό", "Κιάλια"] }
    },
    'Anthony Quinn': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Anthony_Quinn_Bay_Rhodes.jpg/800px-Anthony_Quinn_Bay_Rhodes.jpg",
        en: { feature: "Secluded cove", tip: "Named after the actor who owned a villa nearby. Crystal clear waters perfect for snorkeling.", pack: ["Snorkeling gear", "Water", "Towel"] },
        gr: { feature: "Απομονωμένο καλντερίμι", tip: "Ονομάστηκε από τον ηθοποιό που είχε βίλα κοντά. Κρυστάλλινα νερά ιδανικά για snorkeling.", pack: ["Εξοπλισμός snorkeling", "Νερό", "Πετσέτα"] }
    },
    'Preveli': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Preveli_Lake.jpg/800px-Preveli_Lake.jpg",
        en: { feature: "Palm oasis", tip: "Unique palm forest meets the sea. The river creates a natural freshwater pool.", pack: ["Water shoes", "Hat", "Camera"] },
        gr: { feature: "Φοινική όαση", tip: "Μοναδικό φοινικόδασος συναντά τη θάλασσα. Ο ποταμός δημιουργεί φυσική πισίνα γλυκού νερού.", pack: ["Παπούτσια θάλασσας", "Καπέλο", "Κάμερα"] }
    },
    'Matala': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Matala_caves.jpg/800px-Matala_caves.jpg",
        en: { feature: "Cave dwellings", tip: "Ancient caves used as homes by hippies in the 60s. Small entry fee for cave exploration.", pack: ["Flashlight", "Comfortable shoes", "Water"] },
        gr: { feature: "Σπήλαια κατοικίες", tip: "Αρχαίες σπηλιές που χρησιμοποιήθηκαν ως σπίτια από χίπις στα 60s. Μικρό εισιτήριο για εξερεύνηση σπηλαίων.", pack: ["Φακός", "Άνετα παπούτσια", "Νερό"] }
    },
    'Kalogria': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Kalogria_Beach.jpg/800px-Kalogria_Beach.jpg",
        en: { feature: "Hidden paradise", tip: "Secluded beach with pine trees reaching the sand. Perfect for a quiet escape.", pack: ["Umbrella", "Snacks", "Book"] },
        gr: { feature: "Κρυμμένος παράδεισος", tip: "Απομονωμένη παραλία με πεύκα που φτάνουν στην άμμο. Ιδανική για ήσυχη απόδραση.", pack: ["Ομπρέλα", "Σνακ", "Βιβλίο"] }
    },
    'Marathonisi': {
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Marathonisi_Zakynthos.jpg/800px-Marathonisi_Zakynthos.jpg",
        en: { feature: "Turtle island", tip: "Boat tours available. Spot turtles and seals in the crystal waters. No swimming allowed.", pack: ["Camera", "Hat", "Binoculars"] },
        gr: { feature: "Νησί χελωνών", tip: "Διαθέσιμες εκδρομές με σκάφος. Δείτε χελώνες και φώκιες στα κρυστάλλινα νερά. Απαγορεύεται το κολύμπι.", pack: ["Κάμερα", "Καπέλο", "Κιάλια"] }
    }
};

const SPECIFIC_TIPS: Record<string, Record<LanguageCode, TipContent & { image?: string }>> = Object.entries(RAW_TIPS).reduce((acc, [key, val]) => {
    acc[key] = {
        en: { ...val.en, image: val.image },
        gr: { ...val.gr, image: val.image },
        fr: { ...val.en, image: val.image },
        de: { ...val.en, image: val.image },
        it: { ...val.en, image: val.image }
    };
    return acc;
}, {} as Record<string, Record<LanguageCode, TipContent & { image?: string }>>);

const getStaticDetails = (beach: Beach, language: LanguageCode, windInfo: string): { whyToday: string, localsTip: string, whatToPack: string[], image?: string } => {
    // 1. Check for Specific Famous Beach Overrides
    const cleanNameEn = beach.name['en'].replace(/\(.*\)/, '').trim(); 
    
    // Find key by checking if beach name includes key OR key includes beach name
    const specificKey = Object.keys(SPECIFIC_TIPS).find(key => 
        cleanNameEn.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(cleanNameEn.toLowerCase())
    );
    
    const specific = specificKey ? SPECIFIC_TIPS[specificKey] : null;
    
    // No fallback images anymore. If it's not famous/verified, it gets no image.
    
    if (specific && specific[language]) {
        // Generate "Why Today" dynamically mixing the static feature with dynamic wind info
        let whyToday = "";
        const isWindy = windInfo.includes("5") || windInfo.includes("6") || windInfo.includes("7") || windInfo.includes("8");
        
        if (language === 'gr') {
            whyToday = isWindy 
                ? `Παρόλο που έχει αέρα (${windInfo}), το ${specific.gr.feature} αξίζει να το δεις. Προσοχή στα κύματα.`
                : `Με τον σημερινό καιρό (${windInfo}), είναι τέλεια ευκαιρία να απολαύσεις το ${specific.gr.feature}.`;
        } else {
            whyToday = isWindy
                ? `Even though it's breezy (${windInfo}), the ${specific.en.feature} is worth seeing. Watch out for waves.`
                : `With today's weather (${windInfo}), it's the perfect chance to enjoy the ${specific.en.feature}.`;
        }

        return {
            whyToday: whyToday,
            localsTip: specific[language].tip,
            whatToPack: specific[language].pack,
            image: specific[language].image
        };
    }

    // 2. Generic Logic Generation (Fallback for non-famous beaches)
    const pack: string[] = [];
    let tip = "";
    let why = "";

    // --- Pack List Logic ---
    if (language === 'gr') {
        pack.push("Αντηλιακό", "Νερό");
        if (!beach.amenities.organized) pack.push("Ομπρέλα", "Σνακ/Φαγητό");
        if (beach.amenities.organized) pack.push("Πετσέτα θαλάσσης");
        if (beach.beachType.includes('pebbles') || beach.beachType.includes('rocky')) pack.push("Παπούτσια θάλασσας");
        if (beach.activities?.snorkeling) pack.push("Μάσκα & Αναπνευστήρα");
        if (beach.accessNotes?.gr?.includes('boat')) pack.push("Εισιτήριο για καραβάκι");
    } else {
        pack.push("Sunscreen", "Water");
        if (!beach.amenities.organized) pack.push("Umbrella", "Snacks");
        if (beach.amenities.organized) pack.push("Beach Towel");
        if (beach.beachType.includes('pebbles') || beach.beachType.includes('rocky')) pack.push("Water shoes");
        if (beach.activities?.snorkeling) pack.push("Snorkeling gear");
        if (beach.accessNotes?.en?.includes('boat')) pack.push("Boat ticket money");
    }

    // --- Tip Logic (Enhanced Generic) ---
    // Generate a more "characteristic" tip based on attributes
    const surface =
        beach.beachType === 'sandy'
            ? (language === 'gr' ? 'αμμουδερή' : 'sandy')
            : beach.beachType === 'sandy-pebbles'
                ? (language === 'gr' ? 'με άμμο και βότσαλο' : 'sand & pebbles')
                : beach.beachType === 'rocky'
                    ? (language === 'gr' ? 'βραχώδη' : 'rocky')
                    : (language === 'gr' ? 'με βότσαλο' : 'pebbles');
    const water =
        beach.waterDepth === 'shallow'
            ? (language === 'gr' ? 'ρηχά νερά' : 'shallow waters')
            : beach.waterDepth === 'medium'
                ? (language === 'gr' ? 'μεσαίο βάθος' : 'moderate depth')
                : (language === 'gr' ? 'βαθιά νερά' : 'deep waters');
    
    if (language === 'gr') {
        if (!beach.amenities.organized && beach.amenities.naturalShade) {
            tip = `Είναι φυσική παραλία χωρίς οργανωμένες παροχές, αλλά έχει δέντρα. Πήγαινε λίγο νωρίτερα για να βρεις φυσική σκιά.`;
        } else if (!beach.amenities.organized) {
            tip = `Είναι ${surface} φυσική παραλία χωρίς οργανωμένες παροχές. Πάρε μαζί σου ομπρέλα και αρκετό νερό.`;
        } else if (beach.amenities.taverna) {
            tip = `Μετά το μπάνιο στα ${water}, η ταβέρνα της περιοχής είναι ιδανική για φαγητό.`;
        } else {
            tip = `Μια κλασική ${surface} παραλία. Ιδανική ώρα επίσκεψης είναι νωρίς το πρωί ή αργά το απόγευμα.`;
        }
    } else {
        if (!beach.amenities.organized && beach.amenities.naturalShade) {
            tip = `This is a natural beach with no beach facilities, but there are trees. Arrive a little earlier to find natural shade.`;
        } else if (!beach.amenities.organized) {
            tip = `It's a natural ${surface} beach with no beach facilities. Bring an umbrella and plenty of water.`;
        } else if (beach.amenities.taverna) {
            tip = `After swimming in the ${water}, the local tavern is perfect for a meal.`;
        } else {
            tip = `A classic ${surface} beach. Best time to visit is early morning or late afternoon.`;
        }
    }

    // --- Why Today Logic (Generic) ---
    const isClean = !windInfo.includes("6") && !windInfo.includes("7") && !windInfo.includes("8");
    if (language === 'gr') {
        why = isClean 
            ? `Ο καιρός σήμερα (${windInfo}) είναι σύμμαχος για ένα απολαυστικό μπάνιο.`
            : `Λόγω του ανέμου (${windInfo}), ίσως έχει λίγο κύμα, αλλά παραμένει μια όμορφη επιλογή.`;
    } else {
        why = isClean
            ? `The weather today (${windInfo}) is on your side for a delightful swim.`
            : `Due to the wind (${windInfo}), it might be a bit choppy, but still a beautiful spot.`;
    }

    return {
        whyToday: why,
        localsTip: tip,
        whatToPack: pack,
        // No fallback image used here intentionally
        image: undefined
    };
};

import { openNavigation } from '../utils/navigation';

export const BeachDetailModal: React.FC<BeachDetailModalProps> = ({ beach, isOpen, onClose, language, t, windInfo, hourlyForecast }) => {
  const details = useMemo(() => {
      if (!beach) return null;
      return getStaticDetails(beach, language, windInfo);
  }, [beach, language, windInfo]);

  const dayPlan = useMemo(() => {
      if (!beach || !hourlyForecast) return null;
      return generateBeachDayPlan(beach, hourlyForecast);
  }, [beach, hourlyForecast]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !beach || !details) return null;

  const beachDisplayName = displayBeachName(beach.name, language);

  const handleShare = async () => {
    const shareUrl = window.location.origin + window.location.pathname;
    if (navigator.share && beach) {
      try {
        await navigator.share({
          text: t.sharing.text(beachDisplayName),
          url: shareUrl,
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Error sharing:', error);
        }
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[90] animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="beach-detail-title"
    >
      <div
        className="bg-slate-50 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {details.image ? (
          <div className="relative h-48 sm:h-64 w-full flex-shrink-0">
              <img
                  src={details.image}
                  alt={beachDisplayName}
                  className="w-full h-full object-cover"
                  loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
              <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors backdrop-blur-sm"
                  aria-label={t.closeModalLabel}
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div className="absolute bottom-4 left-6 right-6">
                  <h2 id="beach-detail-title" className="text-2xl sm:text-3xl font-extrabold text-white shadow-sm mb-1">{beachDisplayName}</h2>
                  <div className="flex items-center gap-2 text-white/90 text-sm">
                      <StarRating rating={beach.rating} colorClassName="text-yellow-400" />
                      <span className="font-bold">{beach.rating.toFixed(1)}</span>
                  </div>
              </div>
          </div>
        ) : (
          <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
              <div className="min-w-0">
                  <h2 id="beach-detail-title" className="text-2xl font-extrabold text-slate-950">{beachDisplayName}</h2>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                      <StarRating rating={beach.rating} />
                      <span className="font-bold">{beach.rating.toFixed(1)}</span>
                  </div>
              </div>
              <button
                  onClick={onClose}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
                  aria-label={t.closeModalLabel}
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
          </div>
        )}

        <div className="overflow-y-auto p-6 flex-1">
            <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed mb-6 text-sm sm:text-base">
                <p>{beach.detailedDescription?.[language] || beach.description[language]}</p>
            </div>
            
            {dayPlan && (
              <div className="mb-6">
                <BeachDayPlanner plan={dayPlan} beachName={beachDisplayName} />
              </div>
            )}
            
            <div className="space-y-6">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-cyan-700 mb-2 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        {t.beachDetailModal.whyToday}
                    </h3>
                    <p className="text-slate-600 leading-relaxed">{details.whyToday}</p>
                </div>

                <div className="p-4 bg-amber-50 border-l-4 border-amber-400 text-amber-900 rounded-r-lg shadow-sm">
                    <h3 className="font-bold mb-1 flex items-center gap-2 text-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v1.946l1.046.261a1 1 0 01.84 1.258l-.21 1.051.84.21a1 1 0 01.84 1.258l-.21 1.051.84.21a1 1 0 01.84 1.258l-1.12 5.604a1 1 0 01-1.258.84l-1.05-.21.21.84a1 1 0 01-1.258.84l-5.604-1.12a1 1 0 01-.84-1.258l.21-1.05-.84-.21a1 1 0 01-.84-1.258l.21-1.05-.84-.21a1 1 0 01-.84-1.258L4.053 4.265a1 1 0 011.258-.84l1.05.21-.21-.84a1 1 0 01.84-1.258L11.3 1.046zm-1.12 4.092a1 1 0 10-1.258-.84L7.873 5.345a1 1 0 00-.84 1.258l.21 1.051a1 1 0 001.258.84l1.05-.21a1 1 0 00.84-1.258l-1.05-.21z" clipRule="evenodd" /></svg>
                        {t.beachDetailModal.localsTip}
                    </h3>
                    <p className="text-base font-medium">{details.localsTip}</p>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-cyan-700 mb-3 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
                        {t.beachDetailModal.whatToPack}
                    </h3>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {details.whatToPack.map((item, index) => (
                            <li key={index} className="flex items-center text-slate-700 bg-slate-100 px-3 py-2 rounded-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 text-cyan-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
        <footer className="p-4 border-t border-slate-200 bg-slate-50 flex-shrink-0 flex items-center justify-end gap-2 flex-wrap">
            {navigator.share && (
                <button
                    onClick={handleShare}
                    aria-label={t.sharing.buttonLabel}
                    className="inline-flex items-center justify-center px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 transition-all duration-200"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                    {t.sharing.buttonLabel}
                </button>
            )}
            <button
                onClick={() => openNavigation(beach)}
                aria-label={t.navigateToLabel(beachDisplayName)}
                className="inline-flex items-center justify-center px-4 py-2 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 transition-all duration-200 shadow-md hover:shadow-lg"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
                {t.navigate}
            </button>
        </footer>
      </div>
    </div>
  );
};
