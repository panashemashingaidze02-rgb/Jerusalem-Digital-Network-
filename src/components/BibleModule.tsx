import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { UserProfile } from '../types';
import localforage from 'localforage';
import { toast } from 'react-hot-toast';
import { 
  BookOpen, 
  Heart, 
  Bookmark, 
  Highlighter, 
  Volume2, 
  VolumeX, 
  Search, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  CheckCircle,
  Clock, 
  Sparkles, 
  Flame, 
  BookOpenCheck,
  ChevronRight, 
  Share2, 
  Smartphone, 
  Moon, 
  Sun, 
  Coffee, 
  ArrowLeft,
  X,
  Plus,
  Compass
} from 'lucide-react';

// Define structure of a Bible Book
interface BibleBook {
  name: string;
  chapters: number;
  testament: 'Old' | 'New';
  category: string;
}

// All 66 Books of the Bible with precise chapter counts
const BIBLE_BOOKS: BibleBook[] = [
  // --- OLD TESTAMENT ---
  // Law (Pentateuch)
  { name: 'Genesis', chapters: 50, testament: 'Old', category: 'Law' },
  { name: 'Exodus', chapters: 40, testament: 'Old', category: 'Law' },
  { name: 'Leviticus', chapters: 27, testament: 'Old', category: 'Law' },
  { name: 'Numbers', chapters: 36, testament: 'Old', category: 'Law' },
  { name: 'Deuteronomy', chapters: 34, testament: 'Old', category: 'Law' },
  // History
  { name: 'Joshua', chapters: 24, testament: 'Old', category: 'History' },
  { name: 'Judges', chapters: 21, testament: 'Old', category: 'History' },
  { name: 'Ruth', chapters: 4, testament: 'Old', category: 'History' },
  { name: '1 Samuel', chapters: 31, testament: 'Old', category: 'History' },
  { name: '2 Samuel', chapters: 24, testament: 'Old', category: 'History' },
  { name: '1 Kings', chapters: 22, testament: 'Old', category: 'History' },
  { name: '2 Kings', chapters: 25, testament: 'Old', category: 'History' },
  { name: '1 Chronicles', chapters: 29, testament: 'Old', category: 'History' },
  { name: '2 Chronicles', chapters: 36, testament: 'Old', category: 'History' },
  { name: 'Ezra', chapters: 10, testament: 'Old', category: 'History' },
  { name: 'Nehemiah', chapters: 13, testament: 'Old', category: 'History' },
  { name: 'Esther', chapters: 10, testament: 'Old', category: 'History' },
  // Wisdom & Poetry
  { name: 'Job', chapters: 42, testament: 'Old', category: 'Wisdom' },
  { name: 'Psalms', chapters: 150, testament: 'Old', category: 'Poetry' },
  { name: 'Proverbs', chapters: 31, testament: 'Old', category: 'Wisdom' },
  { name: 'Ecclesiastes', chapters: 12, testament: 'Old', category: 'Wisdom' },
  { name: 'Song of Solomon', chapters: 8, testament: 'Old', category: 'Poetry' },
  // Major Prophets
  { name: 'Isaiah', chapters: 66, testament: 'Old', category: 'Prophets' },
  { name: 'Jeremiah', chapters: 52, testament: 'Old', category: 'Prophets' },
  { name: 'Lamentations', chapters: 5, testament: 'Old', category: 'Prophets' },
  { name: 'Ezekiel', chapters: 48, testament: 'Old', category: 'Prophets' },
  { name: 'Daniel', chapters: 12, testament: 'Old', category: 'Prophets' },
  // Minor Prophets
  { name: 'Hosea', chapters: 14, testament: 'Old', category: 'Prophets' },
  { name: 'Joel', chapters: 3, testament: 'Old', category: 'Prophets' },
  { name: 'Amos', chapters: 9, testament: 'Old', category: 'Prophets' },
  { name: 'Obadiah', chapters: 1, testament: 'Old', category: 'Prophets' },
  { name: 'Jonah', chapters: 4, testament: 'Old', category: 'Prophets' },
  { name: 'Micah', chapters: 7, testament: 'Old', category: 'Prophets' },
  { name: 'Nahum', chapters: 3, testament: 'Old', category: 'Prophets' },
  { name: 'Habakkuk', chapters: 3, testament: 'Old', category: 'Prophets' },
  { name: 'Zephaniah', chapters: 3, testament: 'Old', category: 'Prophets' },
  { name: 'Haggai', chapters: 2, testament: 'Old', category: 'Prophets' },
  { name: 'Zechariah', chapters: 14, testament: 'Old', category: 'Prophets' },
  { name: 'Malachi', chapters: 4, testament: 'Old', category: 'Prophets' },

  // --- NEW TESTAMENT ---
  // Gospels
  { name: 'Matthew', chapters: 28, testament: 'New', category: 'Gospels' },
  { name: 'Mark', chapters: 16, testament: 'New', category: 'Gospels' },
  { name: 'Luke', chapters: 24, testament: 'New', category: 'Gospels' },
  { name: 'John', chapters: 21, testament: 'New', category: 'Gospels' },
  // History
  { name: 'Acts', chapters: 28, testament: 'New', category: 'History' },
  // Epistles
  { name: 'Romans', chapters: 16, testament: 'New', category: 'Epistles' },
  { name: '1 Corinthians', chapters: 16, testament: 'New', category: 'Epistles' },
  { name: '2 Corinthians', chapters: 13, testament: 'New', category: 'Epistles' },
  { name: 'Galatians', chapters: 6, testament: 'New', category: 'Epistles' },
  { name: 'Ephesians', chapters: 6, testament: 'New', category: 'Epistles' },
  { name: 'Philippians', chapters: 4, testament: 'New', category: 'Epistles' },
  { name: 'Colossians', chapters: 4, testament: 'New', category: 'Epistles' },
  { name: '1 Thessalonians', chapters: 5, testament: 'New', category: 'Epistles' },
  { name: '2 Thessalonians', chapters: 3, testament: 'New', category: 'Epistles' },
  { name: '1 Timothy', chapters: 6, testament: 'New', category: 'Epistles' },
  { name: '2 Timothy', chapters: 4, testament: 'New', category: 'Epistles' },
  { name: 'Titus', chapters: 3, testament: 'New', category: 'Epistles' },
  { name: 'Philemon', chapters: 1, testament: 'New', category: 'Epistles' },
  { name: 'Hebrews', chapters: 13, testament: 'New', category: 'Epistles' },
  { name: 'James', chapters: 5, testament: 'New', category: 'Epistles' },
  { name: '1 Peter', chapters: 5, testament: 'New', category: 'Epistles' },
  { name: '2 Peter', chapters: 3, testament: 'New', category: 'Epistles' },
  { name: '1 John', chapters: 5, testament: 'New', category: 'Epistles' },
  { name: '2 John', chapters: 1, testament: 'New', category: 'Epistles' },
  { name: '3 John', chapters: 1, testament: 'New', category: 'Epistles' },
  { name: 'Jude', chapters: 1, testament: 'New', category: 'Epistles' },
  // Prophecy
  { name: 'Revelation', chapters: 22, testament: 'New', category: 'Prophets' }
];

// Offline fallback verses for smooth no-connection experience
const OFFLINE_COLLECTION: Record<string, any[]> = {
  'John_3': [
    { verse: 16, text: 'For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life.' },
    { verse: 17, text: 'For God didn\'t send his Son into the world to judge the world, but that the world should be saved through him.' }
  ],
  'Psalms_23': [
    { verse: 1, text: 'The Lord is my shepherd. I shall not want.' },
    { verse: 2, text: 'He makes me lie down in green pastures. He leads me beside still waters.' },
    { verse: 3, text: 'He restores my soul. He guides me in the paths of righteousness for his name\'s sake.' },
    { verse: 4, text: 'Even though I walk through the valley of the shadow of death, I will fear no evil; for you are with me. Your rod and your staff, they comfort me.' }
  ],
  'Genesis_1': [
    { verse: 1, text: 'In the beginning, God created the heavens and the earth.' },
    { verse: 2, text: 'The earth was empty and void. Darkness was on the face of the deep, and God\'s Spirit was hovering over the surface of the waters.' },
    { verse: 3, text: 'God said, "Let there be light," and there was light.' }
  ]
};

const SHONA_COLLECTION: Record<string, any[]> = {
  'John_3': [
    { verse: 1, text: 'Kwakanga kune mumwe murume wevaFarise, ainzi Nikodhimo, mutungamiri wevaJudha.' },
    { verse: 2, text: 'Iye akauya kuna Jesu usiku akati kwaari, "Rhabhi, tinoziva kuti muri mudzidzisi akabva kuna Mwari; nekuti hakuna munhu anogona kuita zviratidzo izvi zvamunoita kana Mwari asina denga naye."' },
    { verse: 16, text: 'Nekuti Mwari akada nyika zvakadari, kuti akapa mwanakomana wake akaberekwa mumwe chete, kuti ani nani anotenda kwaari arege kurasika, asi ave neupenyu husingaperi.' },
    { verse: 17, text: 'Nekuti Mwari haana kutuma Mwanakomana wake panyika kuti azotongera nyika, asi kuti nyika iponeswe naye.' }
  ],
  'Psalms_23': [
    { verse: 1, text: 'Jehovha ndiye mufudzi wangu; handingashutsiki.' },
    { verse: 2, text: 'Anondivatisa pamafuro manyoro, anonditungamirira pamvura dzinonyevenutsa.' },
    { verse: 3, text: 'Anovandudza mweya wangu; anondiperekedza mumakwara ekururama nekuda kwezita rake.' },
    { verse: 4, text: 'Kunyange ndikafamba mumupata wemumvuri werufu, handingatye zvakaipa, nekuti imi munesu; tsvimbo yenyu nemudonzvo wenyu zvinondinyaradza.' }
  ],
  'Genesis_1': [
    { verse: 1, text: 'Pakutanga Mwari akasika denga nenyika.' },
    { verse: 2, text: 'Nyika yakanga isina kugadzirwa, isina chinhu; rima rakanga riri pamusoro pemvura yakadzika, mweya waMwari waifamba pamusoro pemvura.' },
    { verse: 3, text: 'Mwari akati, "Chiedza ngachivepo," chiedza chikava pakuponesa!' }
  ]
};

const NDEBELE_COLLECTION: Record<string, any[]> = {
  'John_3': [
    { verse: 1, text: 'Kwakuyindoda yabaFarisi, ibizo layo linguNikodemu, umbusi wabaJuda.' },
    { verse: 2, text: 'Yona yeza kuJesu ebusuku, yathi kuye, "Rabi, siyazi ukuthi ungumfundisi ovela kuNkulunkulu; ngoba akulaye ongabangenza lezibonakaliso ozenzayo uNkulunkulu engekho laye."' },
    { verse: 16, text: 'Kuzwakala ukuthi uNkulunkulu walithanda kangaka izwe, waze wanika iNdodana yakhe ezelwe yodwa, ukuze loyo olomholo kuyo angabhubhi, kodwa abe lokuphila okungapheliyo.' },
    { verse: 17, text: 'Ngoba uNkulunkulu kayithumelanga iNdodana yakhe emhlabeni ukuba iligwebe izwe, kodwa ukuba izwe lisindiswe ngayo.' }
  ],
  'Psalms_23': [
    { verse: 1, text: 'UJehova ungalusi wami; angisayikuswela.' },
    { verse: 2, text: 'Uyangilazisa emadlelweni aluhlaza, uyangikhokhelela eceleni kwamanzi athuleyo.' },
    { verse: 3, text: 'Uyakubuyisela umoya wami; uyangihola ezindleleni zokulunga ngenxa yebizo lakhe.' },
    { verse: 4, text: 'Loba ngihamba emgodini womthunzi wokufa, angiyikwesaba okubi, ngoba wena ulami; intonga yakho lodondolo lwakho ziyangiduduza.' }
  ],
  'Genesis_1': [
    { verse: 1, text: 'Ekuqaleni uNkulunkulu wadala amazulu lomhlaba.' },
    { verse: 2, text: 'Umhlaba wawuyihlane ungelalutho, ubumnyama babuphezu kotshona, loMoya kaNkulunkulu wawulele phezu kwamanzi.' },
    { verse: 3, text: 'UNkulunkulu wathi, "Kube lokukhanya," kwaba lokukhanya.' }
  ]
};

const BIBLICAL_DICTIONARY: Record<string, { shona: string; ndebele: string }> = {
  'god': { shona: 'Mwari', ndebele: 'uNkulunkulu' },
  'god\'s': { shona: "Mwari", ndebele: "kaNkulunkulu" },
  'lord': { shona: 'Jehovha', ndebele: 'uJehova' },
  'shepherd': { shona: 'mufudzi', ndebele: 'umalusi' },
  'heaven': { shona: 'denga', ndebele: 'amazulu' },
  'heavens': { shona: 'matenga', ndebele: 'amazulu' },
  'earth': { shona: 'nyika', ndebele: 'umhlaba' },
  'spirit': { shona: 'mweya', ndebele: 'uMoya' },
  'word': { shona: 'shoko', ndebele: 'ilizwi' },
  'beginning': { shona: 'maviriro', ndebele: 'ekuqaleni' },
  'created': { shona: 'akasika', ndebele: 'wadala' },
  'light': { shona: 'chiedza', ndebele: 'ukukhanya' },
  'darkness': { shona: 'rima', ndebele: 'ubumnyama' },
  'waters': { shona: 'mvura', ndebele: 'amanzi' },
  'water': { shona: 'mvura', ndebele: 'amanzi' },
  'loved': { shona: 'akada', ndebele: 'walithanda' },
  'love': { shona: 'rudo', ndebele: 'uthando' },
  'life': { shona: 'upenyu', ndebele: 'ukuphila' },
  'eternal': { shona: 'husingaperi', ndebele: 'okungapheliyo' },
  'son': { shona: 'mwanakomana', ndebele: 'iNdodana' },
  'world': { shona: 'nyika', ndebele: 'izwe' },
  'believes': { shona: 'anotenda', ndebele: 'olomholo' },
  'believe': { shona: 'tenda', ndebele: 'kholwa' },
  'saved': { shona: 'poneswa', ndebele: 'sindiswa' },
  'sent': { shona: 'akatuma', ndebele: 'wathuma' },
  'truth': { shona: 'chokwadi', ndebele: 'iqiniso' },
  'peace': { shona: 'rugare', ndebele: 'ukuthula' },
  'holy': { shona: 'tsvene', ndebele: 'ngcwele' },
  'sin': { shona: 'chivi', ndebele: 'isono' },
  'sins': { shona: 'zvivi', ndebele: 'izono' },
  'grace': { shona: 'nyasha', ndebele: 'umusa' },
  'faith': { shona: 'rutendo', ndebele: 'ukholo' },
  'hope': { shona: 'tariro', ndebele: 'ithemba' },
  'heart': { shona: 'moyo', ndebele: 'inhliziyo' },
  'righteousness': { shona: 'kururama', ndebele: 'ukulunga' },
  'blessed': { shona: 'akaropafadzwa', ndebele: 'ubusiwe' },
  'kingdom': { shona: 'humambo', ndebele: 'umbuso' },
  'church': { shona: 'kereke', ndebele: 'isonto' },
  'brethren': { shona: 'hama', ndebele: 'abazalwane' },
  'prayer': { shona: 'munyengetero', ndebele: 'umkhuleko' },
  'amen': { shona: 'ameni', ndebele: 'ameni' }
};

export function getSpiritualTranslation(englishText: string, lang: 'shona' | 'ndebele'): string {
  const words = englishText.split(/(\b\w+\b)/);
  const translated = words.map(part => {
    const lower = part.toLowerCase();
    if (BIBLICAL_DICTIONARY[lower]) {
      const match = BIBLICAL_DICTIONARY[lower][lang];
      if (part[0] === part[0].toUpperCase()) {
        return match[0].toUpperCase() + match.slice(1);
      }
      return match;
    }
    return part;
  });
  return translated.join('');
}

// Reading plan definitions
const READING_PLANS = [
  {
    id: 'plan-gospels',
    name: 'Walk with Jesus (Gospels)',
    description: 'A 15-day study of key moments in the Gospels of Matthew, Mark, Luke, and John.',
    totalDays: 15,
    chapters: ['Matthew 1', 'Matthew 5', 'Matthew 6', 'Mark 1', 'Mark 8', 'Luke 2', 'Luke 15', 'Luke 22', 'John 1', 'John 3', 'John 14', 'John 15', 'John 17', 'John 20', 'John 21']
  },
  {
    id: 'plan-wisdom',
    name: 'Daily Wisdom (Psalms & Proverbs)',
    description: 'Deep reflections from selected Psalms and Proverbs for daily administrative strength.',
    totalDays: 10,
    chapters: ['Psalms 1', 'Psalms 23', 'Psalms 91', 'Psalms 119', 'Psalms 121', 'Psalms 139', 'Proverbs 1', 'Proverbs 3', 'Proverbs 4', 'Proverbs 16']
  },
  {
    id: 'plan-foundations',
    name: 'Commanders of Faith',
    description: 'Explore the key theological foundations of the epistles written by the Apostles.',
    totalDays: 12,
    chapters: ['Romans 8', 'Romans 12', '1 Corinthians 13', '2 Corinthians 5', 'Galatians 5', 'Ephesians 6', 'Philippians 4', 'Colossians 3', 'Hebrews 11', 'James 1', '1 John 4', 'Revelation 21']
  }
];

// Curated 31-day devotionals matching local date index
const DEVOTIONALS = [
  { day: 1, title: 'Steadfast in Ministry', topic: 'Faithfulness', verse: '1 Corinthians 15:58', reflection: 'In church administration, consistency is our greatest testimony. Every cataloged record and processed ungano represents a life touched.' },
  { day: 2, title: 'Beside Still Waters', topic: 'Grace', verse: 'Psalms 23:2', reflection: 'Remember to pause and let Christ restore your soul. True leadership flows from a heart of deep meditation.' },
  { day: 3, title: 'Unity of the Saints', topic: 'Harmony', verse: 'Romans 12:5', reflection: 'The 7 organizational levels of JDN are structured for unity. Together, we constitute one active body under Bishop Caleb.' },
  { day: 4, title: 'Pure Integrity', topic: 'Leadership', verse: 'Proverbs 16:3', reflection: 'Commit all database changes, accounting audits, and local updates truthfully onto the Lord, and your plans will be established.' }
];

export function BibleModule({ currentUser }: { currentUser: UserProfile }) {
  // Navigation Screens: 'Home' | 'Library' | 'Reader' | 'Search' | 'Plans'
  const [currentScreen, setCurrentScreen] = useState<'Home' | 'Library' | 'Reader' | 'Search' | 'Plans'>('Home');
  
  // Reading comfortable theme state: 'Light' | 'Warm' | 'Dark'
  const [readingTheme, setReadingTheme] = useState<'Light' | 'Warm' | 'Dark'>('Light');

  // Reader States
  const [activeBook, setActiveBook] = useState<string>('John');
  const [activeChapter, setActiveChapter] = useState<number>(3);
  const [activeVersion, setActiveVersion] = useState<string>('web');
  const [versesList, setVersesList] = useState<any[]>([]);
  const [isLoadingReader, setIsLoadingReader] = useState<boolean>(false);
  const [selectedVerseNum, setSelectedVerseNum] = useState<number | null>(null);

  // Search States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Firestore DB States
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [progress, setProgress] = useState<string[]>([]); // list of 'Book_Chapter' e.g. 'John_3'
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [planProgress, setPlanProgress] = useState<number>(0);

  // Bookmark writing notes modal state
  const [showBookmarkModal, setShowBookmarkModal] = useState<boolean>(false);
  const [bookmarkNote, setBookmarkNote] = useState<string>('');

  // Audio Support States
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [currentSpeechUtterance, setCurrentSpeechUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const [audioSpeed, setAudioSpeed] = useState<number>(1);
  const [audioVerseIndex, setAudioVerseIndex] = useState<number>(-1);

  // Sync / Offline Awareness inside module
  const [isOfflineLocal, setIsOfflineLocal] = useState<boolean>(!navigator.onLine);

  useEffect(() => {
    const handleStatusChange = () => {
      setIsOfflineLocal(!navigator.onLine);
    };
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // Fetch Firestore user records on mount
  useEffect(() => {
    fetchUserData();
  }, [currentUser]);

  const fetchUserData = async () => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    try {
      // 1. Fetch Bookmarks
      const bmRef = collection(db, 'users', uid, 'bible_bookmarks');
      const bmSnap = await getDocs(bmRef);
      const bmData = bmSnap.docs.map(doc => doc.data());
      setBookmarks(bmData);

      // 2. Fetch Favorites
      const favRef = collection(db, 'users', uid, 'bible_favorites');
      const favSnap = await getDocs(favRef);
      const favData = favSnap.docs.map(doc => doc.data());
      setFavorites(favData);

      // 3. Fetch Highlights
      const hlRef = collection(db, 'users', uid, 'bible_highlights');
      const hlSnap = await getDocs(hlRef);
      const hlData = hlSnap.docs.map(doc => doc.data());
      setHighlights(hlData);

      // 4. Fetch Progress
      const pgRef = collection(db, 'users', uid, 'bible_progress');
      const pgSnap = await getDocs(pgRef);
      if (!pgSnap.empty) {
        const pgData = pgSnap.docs[0].data();
        setProgress(pgData.completedChapters || []);
        setActivePlanId(pgData.activePlanId || null);
        setPlanProgress(pgData.planProgress || 0);
      }
    } catch (err) {
      console.warn('Error reading Bible data from Firestore. Using offline local cached storage.', err);
      // Fallback to localForage
      const cachedBm = await localforage.getItem<any[]>('bible_bookmarks') || [];
      setBookmarks(cachedBm);
      const cachedFav = await localforage.getItem<any[]>('bible_favorites') || [];
      setFavorites(cachedFav);
      const cachedHl = await localforage.getItem<any[]>('bible_highlights') || [];
      setHighlights(cachedHl);
      const cachedPg = await localforage.getItem<string[]>('bible_completed_chapters') || [];
      setProgress(cachedPg);
    }
  };

  // Sync individual collection to localCache and Firestore
  const syncBookmarks = async (newList: any[]) => {
    setBookmarks(newList);
    await localforage.setItem('bible_bookmarks', newList);
    
    // Attempt Firestore Sync
    if (auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        // Clear old list & rewrite or simply upsert
        for (const item of newList) {
          const itemDoc = doc(db, 'users', uid, 'bible_bookmarks', item.id);
          await setDoc(itemDoc, item);
        }
      } catch (err) {
        console.error('Firestore bookmarks write error', err);
      }
    }
  };

  const syncFavorites = async (newList: any[]) => {
    setFavorites(newList);
    await localforage.setItem('bible_favorites', newList);

    if (auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        for (const item of newList) {
          const itemDoc = doc(db, 'users', uid, 'bible_favorites', item.id);
          await setDoc(itemDoc, item);
        }
      } catch (err) {
        console.error('Firestore favorites write error', err);
      }
    }
  };

  const syncHighlights = async (newList: any[]) => {
    setHighlights(newList);
    await localforage.setItem('bible_highlights', newList);

    if (auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        for (const item of newList) {
          const itemDoc = doc(db, 'users', uid, 'bible_highlights', item.id);
          await setDoc(itemDoc, item);
        }
      } catch (err) {
        console.error('Firestore highlights write error', err);
      }
    }
  };

  const syncProgress = async (newProgress: string[], activePlan = activePlanId, planProg = planProgress) => {
    setProgress(newProgress);
    await localforage.setItem('bible_progress_chapters', newProgress);

    if (auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        const pgDoc = doc(db, 'users', uid, 'bible_progress', 'main');
        await setDoc(pgDoc, {
          id: 'main',
          userId: uid,
          completedChapters: newProgress,
          activePlanId: activePlan,
          planProgress: planProg,
          lastReadAt: new Date().toISOString()
        });
      } catch (err) {
        console.error('Firestore progress write error', err);
      }
    }
  };

  // Fetch Bible chapters from public API or offline local cache
  const fetchChapterVerses = async (book: string, chapter: number) => {
    setIsLoadingReader(true);
    setAudioVerseIndex(-1);
    stopAudioContext();
    const cacheKey = `bible_chapter_${book.replace(/\s+/g, '_')}_${chapter}_${activeVersion}`;
    const fallbackKey = `${book.replace(/\s+/g, '_')}_${chapter}`;

    try {
      // 1. Try local cached data first
      const cached = await localforage.getItem<any[]>(cacheKey);
      if (cached && cached.length > 0) {
        setVersesList(cached);
        setIsLoadingReader(false);
        return;
      }

      // 2. Handle Shona local collections as fallback
      if (activeVersion === 'shona_kjv') {
        if (SHONA_COLLECTION[fallbackKey]) {
          const list = SHONA_COLLECTION[fallbackKey].map((v: any) => ({
            verse: v.verse,
            text: v.text,
            translatedText: v.text
          }));
          setVersesList(list);
          await localforage.setItem(cacheKey, list);
          setIsLoadingReader(false);
          return;
        }
      }

      // 4. Fetch English translations from bible-api.com
      if (navigator.onLine) {
        const formatedBook = encodeURIComponent(book.toLowerCase());
        const apiTranslation = (activeVersion === 'shona_kjv') ? 'kjv' : activeVersion;
        const response = await fetch(`https://bible-api.com/${formatedBook}+${chapter}?translation=${apiTranslation}`);
        
        if (response.ok) {
          const result = await response.json();
          if (result.verses && result.verses.length > 0) {
            let formattedList = result.verses.map((v: any) => ({
              verse: v.verse,
              text: v.text.trim()
            }));

            // Dynamically translate verses to natural, grammatically correct Shona via server-side Gemini
            if (activeVersion === 'shona_kjv') {
              try {
                const transRes = await fetch('/api/bible/translate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    language: 'shona_kjv',
                    verses: formattedList.map((fv: any) => ({ verse: fv.verse, text: fv.text }))
                  })
                });

                if (transRes.ok) {
                  const transData = await transRes.json();
                  if (transData.verses && Array.isArray(transData.verses)) {
                    const translatedMap = new Map<number, string>();
                    for (const tv of transData.verses) {
                      translatedMap.set(tv.verse, tv.text);
                    }
                    formattedList = formattedList.map((fv: any) => ({
                      verse: fv.verse,
                      text: fv.text,
                      translatedText: translatedMap.get(fv.verse) || ""
                    }));
                  } else {
                    throw new Error("Invalid response format");
                  }
                } else {
                  throw new Error(`Status ${transRes.status}`);
                }
              } catch (err) {
                console.warn("Server translation failed", err);
                formattedList = formattedList.map((v: any) => ({
                  verse: v.verse,
                  text: v.text, // original English KJV
                  translatedText: ""
                }));
              }
            }

            setVersesList(formattedList);
            await localforage.setItem(cacheKey, formattedList);
            setIsLoadingReader(false);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Error reading from online Bible API', e);
    }

    // 5. Offline backup chapter
    if (activeVersion === 'shona_kjv' && SHONA_COLLECTION[fallbackKey]) {
      const list = SHONA_COLLECTION[fallbackKey].map((v: any) => ({
        verse: v.verse,
        text: v.text,
        translatedText: v.text
      }));
      setVersesList(list);
      toast('KJV Shona Bible (Offline)', { icon: '📴' });
    } else if (OFFLINE_COLLECTION[fallbackKey]) {
      const basicEnglish = OFFLINE_COLLECTION[fallbackKey];
      let mapped = basicEnglish;
      if (activeVersion === 'shona_kjv') {
        mapped = basicEnglish.map(v => ({
          verse: v.verse,
          text: v.text,
          translatedText: ""
        }));
      }
      setVersesList(mapped);
      toast('Reading Offline Version', { icon: '📴' });
    } else {
      setVersesList([
        { verse: 1, text: `${book} Chapter ${chapter} text could not be downloaded offline. Please connect to the internet to cache this translation automatically.` }
      ]);
      toast.error('Translation not cached offline.');
    }
    setIsLoadingReader(false);
  };

  useEffect(() => {
    fetchChapterVerses(activeBook, activeChapter);
  }, [activeBook, activeChapter, activeVersion]);

  // Navigate back/forward in chapters
  const navigateChapter = (dir: 'next' | 'prev') => {
    const currentBookIndex = BIBLE_BOOKS.findIndex(b => b.name === activeBook);
    if (currentBookIndex === -1) return;

    const book = BIBLE_BOOKS[currentBookIndex];
    if (dir === 'next') {
      if (activeChapter < book.chapters) {
        setActiveChapter(activeChapter + 1);
      } else if (currentBookIndex < BIBLE_BOOKS.length - 1) {
        const nextBook = BIBLE_BOOKS[currentBookIndex + 1];
        setActiveBook(nextBook.name);
        setActiveChapter(1);
      }
    } else {
      if (activeChapter > 1) {
        setActiveChapter(activeChapter - 1);
      } else if (currentBookIndex > 0) {
        const prevBook = BIBLE_BOOKS[currentBookIndex - 1];
        setActiveBook(prevBook.name);
        setActiveChapter(prevBook.chapters);
      }
    }
  };

  // Audio narration support
  const speakChapter = () => {
    if (isPlayingAudio) {
      stopAudioContext();
      return;
    }

    if (!('speechSynthesis' in window)) {
      toast.error('Text-to-Speech not supported on this browser.');
      return;
    }

    window.speechSynthesis.cancel();
    setIsPlayingAudio(true);
    speakNextVerse(0);
  };

  const speakNextVerse = (index: number) => {
    if (index >= versesList.length) {
      stopAudioContext();
      toast.success('Chapter completion play completed!');
      return;
    }

    setAudioVerseIndex(index);
    const verseObj = versesList[index];
    const speechText = `${activeBook} chapter ${activeChapter} verse ${verseObj.verse}. ${verseObj.text}`;
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.rate = audioSpeed;

    utterance.onend = () => {
      speakNextVerse(index + 1);
    };

    utterance.onerror = (e) => {
      console.warn('Speech engine warning:', e);
      stopAudioContext();
    };

    setCurrentSpeechUtterance(utterance);
    window.speechSynthesis.speak(utterance);
  };

  const stopAudioContext = () => {
    setIsPlayingAudio(false);
    setAudioVerseIndex(-1);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  // Search local books & calling online fallback
  const handleBibleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);

    try {
      if (navigator.onLine) {
        const qBook = encodeURIComponent(searchQuery.trim());
        const response = await fetch(`https://bible-api.com/?web&q=${qBook}`);
        if (response.ok) {
          const res = await response.json();
          if (res.results) {
            setSearchResults(res.results);
            setIsSearching(false);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Online query search failed, searching offline cache...', err);
    }

    // Offline client search
    const results: any[] = [];
    const cachedKeys = await localforage.keys();
    for (const key of cachedKeys) {
      if (key.startsWith('bible_chapter_')) {
        const content = await localforage.getItem<any[]>(key) || [];
        const parts = key.split('_');
        const bookName = parts[parts.length - 2] || '';
        const chapNum = parts[parts.length - 1] || '1';
        for (const v of content) {
          const original = (v.text || '').toLowerCase();
          const trText = (v.translatedText || '').toLowerCase();
          const query = searchQuery.trim().toLowerCase();
          
          if (original.includes(query) || trText.includes(query)) {
            results.push({
              book_name: bookName.replace(/_/g, ' '),
              chapter: parseInt(chapNum),
              verse: v.verse,
              text: (activeVersion === 'shona_kjv') ? (v.translatedText || v.text) : v.text
            });
          }
        }
      }
    }
    setSearchResults(results);
    setIsSearching(false);
  };

  // Toggle chapter progress completion status
  const toggleChapterProgress = () => {
    const key = `${activeBook}_${activeChapter}`;
    let updated;
    if (progress.includes(key)) {
      updated = progress.filter(k => k !== key);
      toast('Chapter marked unread', { icon: '📖' });
    } else {
      updated = [...progress, key];
      toast.success('Chapter completed!');
      
      // Calculate active plan steps
      if (activePlanId) {
        const plan = READING_PLANS.find(p => p.id === activePlanId);
        if (plan) {
          const matchingPassed = plan.chapters.filter(chap => {
            const [bName, cNum] = chap.split(' ');
            return updated.includes(`${bName}_${cNum}`);
          });
          const percentage = Math.round((matchingPassed.length / plan.totalDays) * 100);
          setPlanProgress(percentage);
        }
      }
    }
    syncProgress(updated);
  };

  // Manage Bookmarks and Highlights
  const handleAddBookmarkSubmit = async () => {
    if (selectedVerseNum === null) return;
    const verseText = versesList.find(v => v.verse === selectedVerseNum)?.text || '';
    const newBookmark = {
      id: `bm-${Date.now()}`,
      userId: auth.currentUser?.uid || 'guest',
      book: activeBook,
      chapter: activeChapter,
      verse: selectedVerseNum,
      text: verseText,
      note: bookmarkNote,
      createdAt: new Date().toISOString()
    };
    await syncBookmarks([newBookmark, ...bookmarks]);
    setShowBookmarkModal(false);
    setBookmarkNote('');
    setSelectedVerseNum(null);
    toast.success('Bookmark with note saved!');
  };

  const toggleFavorite = async (verseNum: number) => {
    const verseText = versesList.find(v => v.verse === verseNum)?.text || '';
    const exists = favorites.find(f => f.book === activeBook && f.chapter === activeChapter && f.verse === verseNum);

    if (exists) {
      const filtered = favorites.filter(f => f.id !== exists.id);
      await syncFavorites(filtered);
      if (auth.currentUser) {
        try {
          await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'bible_favorites', exists.id));
        } catch (e) {
          console.warn('Firestore err:', e);
        }
      }
      toast('Removed from Favorites', { icon: '🤍' });
    } else {
      const newFav = {
        id: `fav-${Date.now()}`,
        userId: auth.currentUser?.uid || 'guest',
        book: activeBook,
        chapter: activeChapter,
        verse: verseNum,
        text: verseText,
        createdAt: new Date().toISOString()
      };
      await syncFavorites([newFav, ...favorites]);
      toast.success('Added to Favorites', { icon: '❤️' });
    }
  };

  const applyHighlight = async (verseNum: number, color: string) => {
    const verseText = versesList.find(v => v.verse === verseNum)?.text || '';
    const index = highlights.findIndex(h => h.book === activeBook && h.chapter === activeChapter && h.verse === verseNum);

    if (index !== -1) {
      if (color === 'clear') {
        const prevId = highlights[index].id;
        const filtered = highlights.filter((_, i) => i !== index);
        await syncHighlights(filtered);
        if (auth.currentUser) {
          try {
            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'bible_highlights', prevId));
          } catch (e) {
            console.warn(e);
          }
        }
        toast('Highlight cleared');
      } else {
        const updated = [...highlights];
        updated[index] = {
          ...updated[index],
          color,
          createdAt: new Date().toISOString()
        };
        await syncHighlights(updated);
        toast.success('Highlight updated');
      }
    } else if (color !== 'clear') {
      const newHl = {
        id: `hl-${Date.now()}`,
        userId: auth.currentUser?.uid || 'guest',
        book: activeBook,
        chapter: activeChapter,
        verse: verseNum,
        text: verseText,
        color,
        createdAt: new Date().toISOString()
      };
      await syncHighlights([newHl, ...highlights]);
      toast.success('Highlight marked!');
    }
    setSelectedVerseNum(null);
  };

  // Get dynamic Devotional index based on current day
  const currentDevotional = DEVOTIONALS[new Date().getDate() % DEVOTIONALS.length];

  return (
    <div className="bg-white rounded-3xl border border-gray-150 shadow-md p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-5 gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#111827] flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-[#166534]" />
            Jerusaremu Daily Bible
          </h2>
          <p className="text-xs text-gray-500 font-medium">Sacred scriptures, customized highlighting, audio narration & devotionals.</p>
        </div>

        {/* Navigation Tabs bar inside Bible Module */}
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => { setCurrentScreen('Home'); stopAudioContext(); }}
            className={`cursor-pointer px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${currentScreen === 'Home' ? 'bg-[#166534] text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <Compass className="h-3.5 w-3.5" /> Dashboard
          </button>
          <button 
            onClick={() => { setCurrentScreen('Library'); stopAudioContext(); }}
            className={`cursor-pointer px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${currentScreen === 'Library' ? 'bg-[#166534] text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <BookOpenCheck className="h-3.5 w-3.5" /> 66 Books
          </button>
          <button 
            onClick={() => { setCurrentScreen('Reader'); }}
            className={`cursor-pointer px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${currentScreen === 'Reader' ? 'bg-[#166534] text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <Smartphone className="h-3.5 w-3.5" /> Reader
          </button>
          <button 
            onClick={() => { setCurrentScreen('Plans'); stopAudioContext(); }}
            className={`cursor-pointer px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${currentScreen === 'Plans' ? 'bg-[#166534] text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <Flame className="h-3.5 w-3.5" /> Plans
          </button>
          <button 
            onClick={() => { setCurrentScreen('Search'); stopAudioContext(); }}
            className={`cursor-pointer px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${currentScreen === 'Search' ? 'bg-[#166534] text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <Search className="h-3.5 w-3.5" /> Search
          </button>
        </div>
      </div>

      {/* 2. MAIN SCREENS WRAPPER */}

      {/* SCREEN A: HOME / DASHBOARD */}
      {currentScreen === 'Home' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* Left Column - Devotional & Daily Verse of Day */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Daily Verse Card */}
            <div className="bg-linear-to-r from-emerald-800 to-green-700 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
              <div className="absolute right-0 bottom-0 opacity-10 translate-x-4 translate-y-4">
                <BookOpen className="h-44 w-44" />
              </div>
              <span className="bg-white/10 text-white text-[10px] font-mono tracking-widest uppercase px-2.5 py-1 rounded-full font-bold">Verse of the Day</span>
              <h3 className="text-xl font-bold tracking-tight mt-3 mb-2 font-serif italic text-emerald-50">
                "{currentDevotional.verse === '1 Corinthians 15:58' ? 'Be steadfast, immovable, always abounding in the work of the Lord...' : 'The Lord is my shepherd; I shall not want.'}"
              </h3>
              <p className="text-xs text-white/80 font-mono font-bold">— {currentDevotional.verse}</p>

              <div className="flex gap-2.5 mt-4">
                <button 
                  onClick={() => {
                    const [b, c] = currentDevotional.verse.split(' ');
                    setActiveBook(b);
                    setActiveChapter(parseInt(c || '1'));
                    setCurrentScreen('Reader');
                  }}
                  className="bg-white text-emerald-900 font-bold px-4 py-1.5 rounded-lg text-xs hover:bg-emerald-50 transition-colors flex items-center gap-1"
                >
                  <BookOpen className="h-3.5 w-3.5" /> Read Chapter
                </button>
                <button 
                  onClick={() => {
                    toast.success('Copied to clipboard!');
                    navigator.clipboard.writeText(`"${currentDevotional.verse}"`);
                  }}
                  className="bg-white/15 text-white font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-white/20 transition-colors"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Daily Devotional reflection */}
            <div className="bg-amber-50/40 border border-amber-200/50 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <Coffee className="h-4 w-4 text-amber-700" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">{currentDevotional.title}</h4>
                  <p className="text-[10px] text-amber-800 font-mono tracking-wider font-bold uppercase">{currentDevotional.topic}</p>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-700 leading-relaxed font-sans mt-3">
                {currentDevotional.reflection}
              </p>
              <div className="pt-2 border-t border-amber-200/30 flex justify-between items-center text-xs">
                <span className="text-gray-400 font-semibold font-mono">Day {currentDevotional.day} of 31 Core Reflections</span>
                <span className="text-[#166534] font-bold">1913 Study Resource</span>
              </div>
            </div>

            {/* Reading Plans summary */}
            <div>
              <h3 className="text-md font-extrabold text-[#111827] mb-3 flex items-center gap-2">
                <Flame className="h-5 w-5 text-amber-600" /> Current Reading Plans
              </h3>
              {activePlanId ? (
                (() => {
                  const activePlan = READING_PLANS.find(p => p.id === activePlanId);
                  return (
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-gray-800">{activePlan?.name}</h4>
                        <p className="text-[11px] text-gray-500 mt-0.5">{activePlan?.chapters.length || 0} Daily Devotional Steps • Completed {planProgress}%</p>
                        <button 
                          onClick={() => setCurrentScreen('Plans')}
                          className="text-[#166534] text-xs font-bold hover:underline mt-2 inline-block cursor-pointer"
                        >
                          View plan steps →
                        </button>
                      </div>
                      <div className="relative h-14 w-14 shrink-0">
                        <svg className="h-full w-full" viewBox="0 0 36 36">
                          <path className="text-gray-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                          <path className="text-[#166534] transition-all duration-500" strokeWidth="3.5" strokeDasharray={`${planProgress}, 100`} stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-gray-800">{planProgress}%</div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="bg-gray-50 rounded-2xl p-4 border border-dashed border-gray-200 text-center space-y-2">
                  <p className="text-xs text-gray-500 font-medium">No system reading plan active at the moment.</p>
                  <button 
                    onClick={() => setCurrentScreen('Plans')}
                    className="bg-[#166534] text-white font-bold text-xs px-4 py-1.5 rounded-lg hover:bg-opacity-90 transition-all cursor-pointer"
                  >
                    Enroll in a Plan
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Bookmarks & Favorites Ledger */}
          <div className="space-y-6">
            
            {/* bookmarks widget */}
            <div className="bg-white rounded-2xl border border-gray-150 p-4 space-y-3">
              <h3 className="text-sm font-extrabold text-[#111827] uppercase tracking-wider flex items-center gap-2">
                <Bookmark className="h-4.5 w-4.5 text-[#166534]" /> Bookmarks ({bookmarks.length})
              </h3>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {bookmarks.length === 0 ? (
                  <p className="text-xs text-gray-400 font-medium">Bookmark verses as you read with personal notes.</p>
                ) : (
                  bookmarks.map((bm: any) => (
                    <div 
                      key={bm.id} 
                      onClick={() => {
                        setActiveBook(bm.book);
                        setActiveChapter(bm.chapter);
                        setCurrentScreen('Reader');
                      }}
                      className="p-2 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all cursor-pointer text-left border border-gray-100"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-800">{bm.book} {bm.chapter}:{bm.verse}</span>
                        <ChevronRight className="h-3 w-3 text-gray-400" />
                      </div>
                      <p className="text-[10px] text-gray-500 line-clamp-1 italic mt-1 font-serif">"{bm.text}"</p>
                      {bm.note && (
                        <span className="block text-[8px] bg-amber-100 text-amber-800 font-mono font-bold mt-1 px-1.5 py-0.5 rounded w-max">
                          Note: {bm.note}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Favorites widget */}
            <div className="bg-white rounded-2xl border border-gray-150 p-4 space-y-3">
              <h3 className="text-sm font-extrabold text-[#111827] uppercase tracking-wider flex items-center gap-2">
                <Heart className="h-4.5 w-4.5 text-red-500" /> Favorites ({favorites.length})
              </h3>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {favorites.length === 0 ? (
                  <p className="text-xs text-gray-400 font-medium">Click the heart icon on any verse while reading.</p>
                ) : (
                  favorites.map((fav: any) => (
                    <div 
                      key={fav.id} 
                      onClick={() => {
                        setActiveBook(fav.book);
                        setActiveChapter(fav.chapter);
                        setCurrentScreen('Reader');
                      }}
                      className="p-2 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all cursor-pointer text-left border border-gray-100"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-800">{fav.book} {fav.chapter}:{fav.verse}</span>
                        <ChevronRight className="h-3 w-3 text-gray-400" />
                      </div>
                      <p className="text-[10px] text-gray-550 line-clamp-1 italic mt-1 font-serif">"{fav.text}"</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN B: 66 BOOKS LIBRARY */}
      {currentScreen === 'Library' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-extrabold text-[#111827]">Canonical Bible Books (66)</h3>
            <span className="text-xs text-slate-500 font-mono font-bold">OT: 39 | NT: 27</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Old Testament */}
            <div className="space-y-3">
              <h4 className="font-extrabold text-sm text-[#166534] border-b border-gray-100 pb-2 flex justify-between items-center">
                <span>OLD TESTAMENT</span>
                <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold">39 Books</span>
              </h4>
              <div className="grid grid-cols-2 gap-2 max-h-[440px] overflow-y-auto pr-1">
                {BIBLE_BOOKS.filter(b => b.testament === 'Old').map(book => {
                  const completedInBook = progress.filter(k => k.startsWith(`${book.name}_`)).length;
                  const ratio = Math.round((completedInBook / book.chapters) * 100);

                  return (
                    <div 
                      key={book.name}
                      onClick={() => {
                        setActiveBook(book.name);
                        setActiveChapter(1);
                        setCurrentScreen('Reader');
                      }}
                      className="p-2.5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all cursor-pointer text-left border border-gray-100 flex flex-col justify-between"
                    >
                      <div>
                        <span className="text-xs font-bold text-gray-800 block truncate">{book.name}</span>
                        <span className="text-[9px] text-gray-400 font-mono font-bold uppercase">{book.category} • {book.chapters} Chapters</span>
                      </div>
                      {completedInBook > 0 && (
                        <div className="mt-1 flex items-center gap-1">
                          <span className="text-[8px] text-[#166534] font-black">{completedInBook}/{book.chapters} Read ({ratio}%)</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* New Testament */}
            <div className="space-y-3">
              <h4 className="font-extrabold text-sm text-blue-700 border-b border-gray-100 pb-2 flex justify-between items-center">
                <span>NEW TESTAMENT</span>
                <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">27 Books</span>
              </h4>
              <div className="grid grid-cols-2 gap-2 max-h-[440px] overflow-y-auto pr-1">
                {BIBLE_BOOKS.filter(b => b.testament === 'New').map(book => {
                  const completedInBook = progress.filter(k => k.startsWith(`${book.name}_`)).length;
                  const ratio = Math.round((completedInBook / book.chapters) * 100);

                  return (
                    <div 
                      key={book.name}
                      onClick={() => {
                        setActiveBook(book.name);
                        setActiveChapter(1);
                        setCurrentScreen('Reader');
                      }}
                      className="p-2.5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all cursor-pointer text-left border border-gray-100 flex flex-col justify-between"
                    >
                      <div>
                        <span className="text-xs font-bold text-gray-800 block truncate">{book.name}</span>
                        <span className="text-[9px] text-gray-400 font-mono font-bold uppercase">{book.category} • {book.chapters} Chapters</span>
                      </div>
                      {completedInBook > 0 && (
                        <div className="mt-1 flex items-center gap-1">
                          <span className="text-[8px] text-blue-700 font-black">{completedInBook}/{book.chapters} Read ({ratio}%)</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SCREEN C: CORE CHAPTER READER */}
      {currentScreen === 'Reader' && (
        <div className="space-y-6 animate-fade-in text-left">
          
          {/* Comfort Options & Theme Picker */}
          <div className="flex flex-wrap items-center justify-between border-b border-gray-100 pb-3.5 gap-2">
            
            {/* Navigators inside chapter */}
            <div className="flex items-center gap-2">
              <select 
                value={activeBook} 
                onChange={(e) => { setActiveBook(e.target.value); setActiveChapter(1); }}
                className="bg-gray-50 border border-gray-200 text-xs font-extrabold px-3 py-1.5 rounded-xl text-gray-850"
              >
                {BIBLE_BOOKS.map(b => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </select>

              <select 
                value={activeChapter} 
                onChange={(e) => setActiveChapter(parseInt(e.target.value))}
                className="bg-gray-50 border border-gray-200 text-xs font-extrabold px-3 py-1.5 rounded-xl text-gray-850"
              >
                {Array.from({ length: BIBLE_BOOKS.find(b => b.name === activeBook)?.chapters || 1 }, (_, i) => i + 1).map(chapNum => (
                  <option key={chapNum} value={chapNum}>Chapter {chapNum}</option>
                ))}
              </select>

              <select 
                value={activeVersion} 
                onChange={(e) => setActiveVersion(e.target.value)}
                className="bg-[#166534] border border-[#166534] text-xs font-bold px-3 py-1.5 rounded-xl text-[#fefefe] focus:outline-none focus:ring-1 focus:ring-[#166534]"
              >
                <option value="web">English (WEB) - Default</option>
                <option value="kjv">English (KJV)</option>
                <option value="bbe">English (BBE)</option>
                <option value="shona_kjv">KJV Shona Bible (Shona)</option>
              </select>
            </div>

            {/* Reading Theme controls & Audio Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              
              {/* Audio controller pills */}
              <div className="flex items-center bg-gray-50 rounded-xl px-2.5 py-1 border border-gray-200 gap-2">
                <button 
                  onClick={speakChapter} 
                  title={isPlayingAudio ? "Pause Audio narration" : "Play speech synthesis narration"}
                  className="p-1 text-gray-600 hover:text-slate-900 cursor-pointer"
                >
                  {isPlayingAudio ? <Pause className="h-4 w-4 text-[#166534]" /> : <Play className="h-4 w-4" />}
                </button>
                <button 
                  onClick={stopAudioContext} 
                  title="Stop audio narration"
                  className="p-1 text-gray-600 hover:text-red-650 cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <select 
                  value={audioSpeed} 
                  onChange={(e) => setAudioSpeed(parseFloat(e.target.value))}
                  className="bg-transparent border-0 text-[10px] select-none font-bold text-gray-600 focus:outline-none focus:ring-0"
                >
                  <option value={0.8}>0.8x</option>
                  <option value={1}>1.0x</option>
                  <option value={1.2}>1.2x</option>
                  <option value={1.5}>1.5x</option>
                </select>
              </div>

              {/* Theme selectors */}
              <div className="flex rounded-xl bg-gray-100 p-0.5 border border-gray-200">
                <button 
                  onClick={() => setReadingTheme('Light')}
                  className={`p-1.5 rounded-lg cursor-pointer flex items-center gap-1 ${readingTheme === 'Light' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Sun className="h-3.5 w-3.5" />
                </button>
                <button 
                  onClick={() => setReadingTheme('Warm')}
                  className={`p-1.5 rounded-lg cursor-pointer flex items-center gap-1 ${readingTheme === 'Warm' ? 'bg-[#FCF6E5] text-[#5C3F1B] shadow-xs' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Coffee className="h-3.5 w-3.5" />
                </button>
                <button 
                  onClick={() => setReadingTheme('Dark')}
                  className={`p-1.5 rounded-lg cursor-pointer flex items-center gap-1 ${readingTheme === 'Dark' ? 'bg-zinc-800 text-zinc-100 shadow-xs' : 'text-gray-400 hover:text-gray-650'}`}
                >
                  <Moon className="h-3.5 w-3.5" />
                </button>
              </div>

            </div>
          </div>

          {/* READER WORKSPACE CANVAS */}
          <div className={`p-6 sm:p-8 rounded-2xl min-h-[350px] border relative transition-all duration-300 ${
            readingTheme === 'Warm' ? 'bg-[#FDF6E3] border-[#EEE1C6] text-[#5C3F1B] font-serif' :
            readingTheme === 'Dark' ? 'bg-[#1E1E1E] border-zinc-900 text-zinc-100 font-serif' : 
            'bg-slate-50 border-gray-150 text-gray-850 font-serif'
          }`}>
            
            {/* Loading Indicator */}
            {isLoadingReader ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-inherit bg-opacity-70">
                <div className="h-8 w-8 border-3 border-emerald-700 border-t-transparent animate-spin rounded-full"></div>
                <p className="text-xs font-bold tracking-tight text-gray-550 mt-2 font-sans">Connecting to Web Scriptures...</p>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Heading */}
                <h3 className="text-2xl font-extrabold tracking-tight font-sans text-center mb-6">
                  {activeBook} {activeChapter}
                </h3>

                {/* Verses flow */}
                <div className="leading-relaxed text-sm sm:text-base space-y-4 font-normal">
                  {versesList.map((verseObj, index) => {
                    // Check if is highlighted
                    const currentHighlight = highlights.find(h => h.book === activeBook && h.chapter === activeChapter && h.verse === verseObj.verse);
                    const highlightColorClass = currentHighlight ? (
                      currentHighlight.color === '#FDE047' ? 'bg-yellow-250 text-slate-900' :
                      currentHighlight.color === '#F472B6' ? 'bg-pink-250 text-slate-900' :
                      currentHighlight.color === '#60A5FA' ? 'bg-blue-250 text-slate-900' :
                      currentHighlight.color === '#34D399' ? 'bg-green-250 text-slate-900' : ''
                    ) : '';

                    // Check if favorited
                    const isFav = favorites.some(f => f.book === activeBook && f.chapter === activeChapter && f.verse === verseObj.verse);

                    // Check if highlighted standard speech active index
                    const isAudioActive = index === audioVerseIndex;

                     return (
                      <div 
                        key={verseObj.verse}
                        onClick={() => setSelectedVerseNum(verseObj.verse)}
                        className={`block cursor-pointer p-2 rounded-xl transition-all select-all hover:bg-black/5 ${highlightColorClass} ${isAudioActive ? 'outline-2 outline-emerald-500 bg-emerald-50 text-emerald-950 font-semibold font-bold' : ''}`}
                      >
                        <div className="flex items-start gap-1">
                          <sup className="text-[10px] font-sans font-black select-none text-[#166534] mt-1 shrink-0">{verseObj.verse}</sup>
                          <div className="space-y-1 w-full">
                            <p className="leading-relaxed text-sm sm:text-base">
                              {(activeVersion === 'shona_kjv') 
                                ? (verseObj.translatedText || verseObj.text)
                                : verseObj.text}
                            </p>
                          </div>
                          {isFav && <Heart className="h-3 w-3 fill-red-500 text-red-500 mt-1 shrink-0 ml-1" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Chapter Completion Controls */}
                <div className="pt-6 border-t border-gray-200/40 flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className="flex gap-2 font-sans text-xs">
                    <button 
                      onClick={() => navigateChapter('prev')}
                      className="bg-black/5 hover:bg-black/10 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer"
                    >
                      ← Previous Chapter
                    </button>
                    <button 
                      onClick={() => navigateChapter('next')}
                      className="bg-black/5 hover:bg-black/10 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer"
                    >
                      Next Chapter →
                    </button>
                  </div>

                  <button 
                    onClick={toggleChapterProgress}
                    className="font-sans text-xs flex items-center gap-1.5 font-bold border border-[#166534] text-[#166534] bg-[#166534]/5 py-2 px-4 rounded-xl hover:bg-[#166534]/15 cursor-pointer-lock"
                  >
                    {progress.includes(`${activeBook}_${activeChapter}`) ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-[#16A34A] fill-[#16A34A] text-white" />
                        Completed Chapter
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Mark as Read
                      </>
                    )}
                  </button>
                </div>

              </div>
            )}
          </div>

          {/* ACTIVE VERSE ACTION FLOATER MENU BAR */}
          {selectedVerseNum !== null && (
            <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-xl space-y-3 animate-fade-in font-sans">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-800">Command Box: {activeBook} {activeChapter}:{selectedVerseNum}</span>
                <button 
                  onClick={() => setSelectedVerseNum(null)}
                  className="p-1 hover:bg-gray-150 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2.5 items-center justify-between">
                
                {/* Highlight Colors picker */}
                <div className="flex items-center gap-1.5">
                  <Highlighter className="h-4 w-4 text-gray-500" />
                  <button 
                    onClick={() => applyHighlight(selectedVerseNum, '#FDE047')}
                    className="h-5 w-5 rounded-full bg-yellow-300 border border-yellow-400 shrink-0" 
                    title="Yellow"
                  />
                  <button 
                    onClick={() => applyHighlight(selectedVerseNum, '#F472B6')}
                    className="h-5 w-5 rounded-full bg-pink-300 border border-pink-400 shrink-0" 
                    title="Pink"
                  />
                  <button 
                    onClick={() => applyHighlight(selectedVerseNum, '#60A5FA')}
                    className="h-5 w-5 rounded-full bg-blue-300 border border-blue-400 shrink-0" 
                    title="Blue"
                  />
                  <button 
                    onClick={() => applyHighlight(selectedVerseNum, '#34D399')}
                    className="h-5 w-5 rounded-full bg-green-300 border border-green-400 shrink-0" 
                    title="Green"
                  />
                  <button 
                    onClick={() => applyHighlight(selectedVerseNum, 'clear')}
                    className="text-[10px] bg-gray-100 border border-gray-200 px-2 py-0.5 rounded font-bold text-gray-600"
                  >
                    Clear
                  </button>
                </div>

                {/* Bookmark/Favorite actions */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => toggleFavorite(selectedVerseNum)}
                    className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Heart className="h-3.5 w-3.5 fill-red-600 text-red-604" /> Favorite
                  </button>
                  <button 
                    onClick={() => {
                      setBookmarkNote('');
                      setShowBookmarkModal(true);
                    }}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Bookmark className="h-3.5 w-3.5" /> Bookmarks + Note
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* Bookmarks optional details popup modal */}
          {showBookmarkModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
              <div className="bg-white p-5 rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md">
                <h3 className="font-bold text-gray-950 text-sm mb-3">Add Note to bookmark</h3>
                <textarea 
                  rows={3}
                  value={bookmarkNote}
                  onChange={(e) => setBookmarkNote(e.target.value)}
                  placeholder="Insert review notes, group study targets, or administrative pointers here..."
                  className="w-full text-xs p-2.5 border border-gray-150 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
                <div className="flex justify-end gap-2 mt-4 text-xs font-bold">
                  <button 
                    onClick={() => { setShowBookmarkModal(false); setSelectedVerseNum(null); }}
                    className="p-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddBookmarkSubmit}
                    className="p-2 bg-[#166534] hover:bg-opacity-90 text-white rounded-lg px-4"
                  >
                    Save Bookmark
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* SCREEN D: CANONICAL READING PLANS */}
      {currentScreen === 'Plans' && (
        <div className="space-y-6 animate-fade-in text-left font-sans">
          <div>
            <h3 className="text-lg font-extrabold text-[#111827]">Canonical Bible Reading Plans</h3>
            <p className="text-xs text-slate-500">Pick an active devotion schema to coordinate your administrative daily reflections.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {READING_PLANS.map(plan => {
              const isEnrolled = activePlanId === plan.id;

              return (
                <div 
                  key={plan.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${isEnrolled ? 'bg-emerald-50/50 border-emerald-300 shadow-sm' : 'bg-white border-gray-150 hover:bg-gray-50'}`}
                >
                  <div className="space-y-2">
                    <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase">{plan.totalDays} Days Plan</span>
                    <h4 className="text-sm font-black text-slate-900 mt-2">{plan.name}</h4>
                    <p className="text-xs text-gray-550 leading-relaxed font-medium">{plan.description}</p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-gray-100">
                    {isEnrolled ? (
                      <div>
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span className="text-emerald-800 font-bold flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5 fill-emerald-600 text-white" /> Enrolled
                          </span>
                          <span className="text-emerald-700 font-bold">{planProgress}% Progress</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                          <div className="bg-[#166534] h-1.5 rounded-full transition-all duration-350" style={{ width: `${planProgress}%` }}></div>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          setActivePlanId(plan.id);
                          setPlanProgress(0);
                          syncProgress(progress, plan.id, 0);
                          toast.success(`Successfully enrolled in ${plan.name}`);
                        }}
                        className="w-full bg-[#166534] text-white font-bold py-2 rounded-xl text-xs hover:bg-opacity-95 transition-all text-center flex items-center justify-center cursor-pointer"
                      >
                        Enroll in Plan
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* If enrolled, show days list */}
          {activePlanId && (
            <div className="p-5 bg-gray-50 rounded-2xl border border-gray-150 space-y-3">
              <h4 className="text-xs font-black text-gray-550 uppercase">Active Study Steps ({READING_PLANS.find(p => p.id === activePlanId)?.name})</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {READING_PLANS.find(p => p.id === activePlanId)?.chapters.map((chap, idx) => {
                  const [bName, cNum] = chap.split(' ');
                  const isRead = progress.includes(`${bName}_${cNum}`);

                  return (
                    <div 
                      key={chap}
                      onClick={() => {
                        setActiveBook(bName);
                        setActiveChapter(parseInt(cNum));
                        setCurrentScreen('Reader');
                      }}
                      className={`p-3 rounded-xl border transition-all text-center cursor-pointer flex flex-col justify-between ${isRead ? 'bg-emerald-50 border-emerald-250 text-emerald-950 font-bold' : 'bg-white border-gray-150 hover:bg-gray-100'}`}
                    >
                      <span className="text-[10px] text-gray-400 font-mono font-bold block mb-1">Day {idx + 1}</span>
                      <span className="text-xs font-black">{chap}</span>
                      <span className="block text-[8px] mt-1 font-sans">{isRead ? 'Completed' : 'Pending'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SCREEN E: SEARCH COMPONENT */}
      {currentScreen === 'Search' && (
        <div className="space-y-6 animate-fade-in text-left font-sans">
          
          <form onSubmit={handleBibleSearch} className="flex gap-2.5 max-w-xl">
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scripture keywords (e.g., love, mercy, sheep)..."
              className="bg-gray-50 border border-gray-200 text-xs px-3.5 py-2.5 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-[#166534]"
            />
            <button 
              type="submit"
              disabled={isSearching}
              className="bg-[#166534] text-white px-5 rounded-xl text-xs font-bold hover:bg-opacity-95 transition-all flex items-center gap-1 pb-0.5 shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Search className="h-4 w-4" /> {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {/* Results Area */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-gray-500 uppercase">Search Ledger Results ({searchResults.length})</h4>
            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {searchResults.length === 0 ? (
                <div className="p-10 border border-dashed border-gray-200 rounded-2xl text-center text-xs text-gray-400">
                  {isSearching ? 'Fetching from Bible database...' : 'No keyword query results yet.'}
                </div>
              ) : (
                searchResults.map((result: any, idx: number) => {
                  const bName = result.book_name || result.book;
                  const cNum = result.chapter;
                  const vNum = result.verse;

                  return (
                    <div 
                      key={idx}
                      onClick={() => {
                        setActiveBook(bName);
                        setActiveChapter(cNum);
                        setCurrentScreen('Reader');
                        setSelectedVerseNum(vNum);
                      }}
                      className="p-3 bg-gray-50 hover:bg-gray-100 transition-all cursor-pointer rounded-xl border border-gray-150 text-left"
                    >
                      <span className="text-xs font-black text-emerald-850 block">{bName} {cNum}:{vNum}</span>
                      <p className="text-xs text-gray-600 italic font-serif mt-1">"{result.text}"</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
