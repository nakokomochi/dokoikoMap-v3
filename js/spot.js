let selectedCity = "";
let map;
let marker;
let startMarker;
let startLat;
let startLng;
let spotMarkers = [];
let currentInfoWindow = null;
let startAddressGlobal = "";
let startPrefectureGlobal = "";
let selectedIntent = "omakase";
let intentEvaluationByPlaceId = new Map();
let selectedTouringPreference = {
    category: null,
    detail: null
};

// ===============================
// 行きたい場所の希望別設定
// 検索・判定・採点・将来の選定理由で使う情報を一元管理する
// ===============================
const DETAIL_SEARCH_PROFILES = {
    sea: {
        id: "sea",
        category: "scenery",
        detail: "sea",
        label: "海を見に行きたい",
        searchKeywordSets: [
            "海岸 海浜公園 岬 海水浴場",
            "海辺 灯台 シーサイド 海岸 景勝地"
        ],
        strongKeywords: ["海岸", "海浜", "岬", "海水浴場", "砂浜", "ビーチ", "海辺", "シーサイド"],
        weakKeywords: ["灯台", "マリーナ", "港", "埠頭", "遊歩道", "夕日", "展望"],
        excludePatterns: [
            { label: "海鮮", pattern: /海鮮|海産物|寿司|魚料理/i },
            { label: "鮮魚", pattern: /鮮魚|魚屋/i },
            { label: "水産", pattern: /水産|漁業/i },
            { label: "海運", pattern: /海運|船舶/i },
            { label: "ホテル・旅館", pattern: /ホテル|宿泊|旅館/i },
            { label: "マンション・不動産", pattern: /マンション|レジデンス|アパート|不動産/i },
            { label: "釣具店", pattern: /釣具|フィッシングショップ/i },
            { label: "ダイビングショップ", pattern: /ダイビング(ショップ|スクール)|潜水ショップ/i },
            { label: "水族館", pattern: /水族館|aquarium/i },
            { label: "駅・バス停", pattern: /駅$|駅前|バス停|station|bus_station/i, nameOnly: true },
            { label: "駐車場のみ", pattern: /駐車場|パーキング|parking/i, nameOnly: true },
            { label: "会社", pattern: /株式会社|有限会社|合同会社|会社|事業所|営業所|office/i },
            { label: "店舗", pattern: /店舗|ショップ|販売店|store/i }
        ],
        acceptedTypes: ["tourist_attraction", "park", "natural_feature", "point_of_interest"],
        weakFallbackTypes: ["tourist_attraction", "park", "natural_feature"],
        requireStrongMatch: true,
        allowWeakFallback: true,
        categoryMatchScore: 8,
        scoring: { firstStrong: 42, additionalStrong: 8, weak: 5, max: 60 }
    },
    shrine: {
        id: "shrine",
        category: "tourism",
        detail: "shrine",
        label: "神社",
        searchKeywordSets: [
            "神社 神宮 大社 稲荷 八幡",
            "天満宮 鳥居 参拝 境内"
        ],
        strongKeywords: ["神社", "神宮", "大社", "稲荷", "八幡", "天満宮"],
        weakKeywords: ["鳥居", "参拝", "境内"],
        excludePatterns: [
            { label: "駅・バス停", pattern: /駅$|駅前|バス停|station|bus_station/i, nameOnly: true },
            { label: "駐車場のみ", pattern: /駐車場|パーキング|parking/i, nameOnly: true }
        ],
        acceptedTypes: ["place_of_worship", "tourist_attraction", "point_of_interest"],
        weakFallbackTypes: ["place_of_worship", "tourist_attraction"],
        requireStrongMatch: true,
        allowWeakFallback: true,
        categoryMatchScore: 10,
        scoring: { firstStrong: 42, additionalStrong: 8, weak: 4, max: 60 }
    },
    ramen: {
        id: "ramen",
        category: "food",
        detail: "ramen",
        label: "ラーメン",
        searchKeywordSets: [
            "ラーメン 中華そば らーめん",
            "つけ麺 麺 食堂"
        ],
        strongKeywords: ["ラーメン", "中華そば", "らーめん", "つけ麺"],
        weakKeywords: ["麺", "食堂"],
        excludePatterns: [
            { label: "製麺所", pattern: /製麺所|製麺工場/i },
            { label: "食品会社", pattern: /食品会社|食品工業|食品製造|株式会社|有限会社|合同会社/i },
            { label: "スーパー", pattern: /スーパー|スーパーマーケット/i, nameOnly: true }
        ],
        acceptedTypes: ["restaurant", "food", "meal_takeaway"],
        weakFallbackTypes: ["restaurant", "food", "meal_takeaway"],
        requireStrongMatch: true,
        allowWeakFallback: true,
        categoryMatchScore: 10,
        scoring: { firstStrong: 42, additionalStrong: 8, weak: 4, max: 60 }
    },
    mountain: {
        id: "mountain",
        category: "scenery",
        detail: "mountain",
        label: "山",
        searchKeywordSets: [
            "山 高原 峠 山頂 自然公園",
            "山麓 森林 展望"
        ],
        strongKeywords: ["山", "高原", "峠", "山頂", "山麓"],
        weakKeywords: ["自然公園", "森林", "展望"],
        excludePatterns: [
            { label: "登山用品店", pattern: /登山用品|アウトドアショップ/i },
            { label: "山岳会", pattern: /山岳会|登山会/i },
            { label: "会社名のみ", pattern: /株式会社|有限会社|合同会社|会社|事業所|営業所/i, nameOnly: true }
        ],
        acceptedTypes: ["natural_feature", "park", "tourist_attraction"],
        weakFallbackTypes: ["natural_feature", "park", "tourist_attraction"],
        requireStrongMatch: true,
        allowWeakFallback: true,
        categoryMatchScore: 10,
        scoring: { firstStrong: 42, additionalStrong: 8, weak: 4, max: 60 }
    },
    onsen: {
        id: "onsen",
        category: "tourism",
        detail: "onsen",
        label: "温泉でゆっくりしたい",
        searchKeywordSets: [
            "日帰り温泉 天然温泉 露天風呂 温泉施設",
            "源泉 日帰り入浴 温浴 大浴場"
        ],
        strongKeywords: ["温泉", "天然温泉", "源泉", "露天風呂", "日帰り入浴"],
        weakKeywords: ["温浴", "大浴場", "スーパー銭湯", "足湯"],
        excludePatterns: [
            { label: "エステ", pattern: /エステ|esthetic/i },
            { label: "マッサージ", pattern: /マッサージ|massage/i },
            { label: "介護", pattern: /介護|老人ホーム|福祉施設/i },
            { label: "サウナのみ", pattern: /サウナ専門|個室サウナ|プライベートサウナ/i },
            { label: "ホテルのみ", pattern: /ホテル|旅館|宿泊/i, nameOnly: true, ignoreWhenStrongMatch: true }
        ],
        acceptedTypes: ["spa", "tourist_attraction", "point_of_interest"],
        weakFallbackTypes: ["spa", "tourist_attraction"],
        requireStrongMatch: true,
        allowWeakFallback: true,
        categoryMatchScore: 10,
        scoring: { firstStrong: 44, additionalStrong: 8, weak: 4, max: 62 }
    },
    seafood: {
        id: "seafood", category: "food", detail: "seafood", label: "海鮮",
        searchKeywordSets: ["海鮮 魚介 鮮魚 寿司 刺身 浜焼き", "魚料理 漁港 浜料理 海鮮食堂"],
        strongKeywords: ["海鮮", "魚介", "鮮魚", "寿司", "刺身", "浜焼き"],
        weakKeywords: ["魚料理", "漁港", "浜料理", "海の幸"],
        excludePatterns: [
            { label: "鮮魚店", pattern: /鮮魚店|魚屋|鮮魚販売/i },
            { label: "水産会社", pattern: /水産会社|水産加工|株式会社|有限会社|合同会社/i },
            { label: "卸売会社", pattern: /卸売|卸市場|仲卸/i },
            { label: "スーパー", pattern: /スーパー|スーパーマーケット/i, nameOnly: true }
        ],
        acceptedTypes: ["restaurant", "food", "meal_takeaway"],
        weakFallbackTypes: ["restaurant", "food", "meal_takeaway"],
        requireStrongMatch: true, allowWeakFallback: true, categoryMatchScore: 10,
        scoring: { firstStrong: 42, additionalStrong: 8, weak: 4, max: 60 }
    },
    udon: {
        id: "udon", category: "food", detail: "udon", label: "うどん",
        searchKeywordSets: ["うどん 饂飩 うどん店", "手打ちうどん 麺 食堂"],
        strongKeywords: ["うどん", "饂飩"],
        weakKeywords: ["麺", "食堂", "手打ち"],
        excludePatterns: [
            { label: "製麺所のみ", pattern: /製麺所|製麺工場/i },
            { label: "食品工場", pattern: /食品工場|食品製造|食品会社/i }
        ],
        acceptedTypes: ["restaurant", "food", "meal_takeaway"],
        weakFallbackTypes: ["restaurant", "food", "meal_takeaway"],
        requireStrongMatch: true, allowWeakFallback: true, categoryMatchScore: 10,
        scoring: { firstStrong: 42, additionalStrong: 8, weak: 4, max: 60 }
    },
    soba: {
        id: "soba", category: "food", detail: "soba", label: "そば",
        searchKeywordSets: ["そば 蕎麦 そば店", "手打ちそば 麺処 食堂"],
        strongKeywords: ["そば", "蕎麦"],
        weakKeywords: ["手打ち", "麺処", "食堂"],
        excludePatterns: [
            { label: "製麺所", pattern: /製麺所|製麺工場/i },
            { label: "そば粉販売", pattern: /そば粉|蕎麦粉|粉販売/i }
        ],
        acceptedTypes: ["restaurant", "food", "meal_takeaway"],
        weakFallbackTypes: ["restaurant", "food", "meal_takeaway"],
        requireStrongMatch: true, allowWeakFallback: true, categoryMatchScore: 10,
        scoring: { firstStrong: 42, additionalStrong: 8, weak: 4, max: 60 }
    },
    curry: {
        id: "curry", category: "food", detail: "curry", label: "カレー",
        searchKeywordSets: ["カレー カリー スープカレー", "インド料理 ネパール料理 洋食 カレー店"],
        strongKeywords: ["カレー", "カリー", "スープカレー"],
        weakKeywords: ["インド料理", "ネパール料理", "洋食"],
        excludePatterns: [
            { label: "食品会社", pattern: /食品会社|食品工場|食品製造/i },
            { label: "香辛料販売", pattern: /香辛料販売|スパイス販売|卸売/i }
        ],
        acceptedTypes: ["restaurant", "food", "meal_takeaway"],
        weakFallbackTypes: ["restaurant", "food", "meal_takeaway"],
        requireStrongMatch: true, allowWeakFallback: true, categoryMatchScore: 10,
        scoring: { firstStrong: 42, additionalStrong: 8, weak: 4, max: 60 }
    },
    cafe: {
        id: "cafe", category: "food", detail: "cafe", label: "カフェ",
        searchKeywordSets: ["カフェ 喫茶 珈琲 coffee", "スイーツ ベーカリー 喫茶店"],
        strongKeywords: ["カフェ", "喫茶", "珈琲", "coffee"],
        weakKeywords: ["スイーツ", "ベーカリー"],
        excludePatterns: [
            { label: "珈琲豆販売のみ", pattern: /珈琲豆販売|コーヒー豆販売|焙煎工場/i },
            { label: "食品会社", pattern: /食品会社|株式会社|有限会社|合同会社/i }
        ],
        acceptedTypes: ["cafe", "restaurant", "food", "bakery"],
        weakFallbackTypes: ["cafe", "restaurant", "food", "bakery"],
        requireStrongMatch: true, allowWeakFallback: true, categoryMatchScore: 10,
        scoring: { firstStrong: 42, additionalStrong: 8, weak: 4, max: 60 }
    },
    bread: {
        id: "bread", category: "food", detail: "bread", label: "パン",
        searchKeywordSets: ["パン ベーカリー ブーランジェリー", "焼きたてパン サンドイッチ パン屋"],
        strongKeywords: ["パン", "ベーカリー", "ブーランジェリー"],
        weakKeywords: ["焼きたて", "サンドイッチ"],
        excludePatterns: [
            { label: "パン工場", pattern: /パン工場|製パン工場/i },
            { label: "製パン会社", pattern: /製パン会社|製パン工業|株式会社|有限会社|合同会社/i }
        ],
        acceptedTypes: ["bakery", "food", "cafe", "store"],
        weakFallbackTypes: ["bakery", "food", "cafe"],
        requireStrongMatch: true, allowWeakFallback: true, categoryMatchScore: 10,
        scoring: { firstStrong: 42, additionalStrong: 8, weak: 4, max: 60 }
    },
    soft_serve: {
        id: "soft_serve", category: "food", detail: "soft_serve", label: "ソフトクリーム",
        searchKeywordSets: ["ソフトクリーム ジェラート アイスクリーム", "牧場 道の駅 ソフトクリーム"],
        strongKeywords: ["ソフトクリーム", "ジェラート", "アイスクリーム"],
        weakKeywords: ["牧場", "道の駅"],
        excludePatterns: [
            { label: "乳製品会社", pattern: /乳製品会社|乳業会社|株式会社|有限会社|合同会社/i },
            { label: "製造工場", pattern: /アイス工場|製造工場|食品工場/i }
        ],
        acceptedTypes: ["food", "cafe", "restaurant", "store", "tourist_attraction"],
        weakFallbackTypes: ["food", "cafe", "restaurant", "tourist_attraction"],
        requireStrongMatch: true, allowWeakFallback: true, categoryMatchScore: 10,
        scoring: { firstStrong: 42, additionalStrong: 8, weak: 4, max: 60 }
    },
    dam: {
        id: "dam", category: "scenery", detail: "dam", label: "ダム",
        searchKeywordSets: ["ダム ダム湖", "貯水池 堰 展望 ダム"],
        strongKeywords: ["ダム", "ダム湖"],
        weakKeywords: ["貯水池", "堰", "展望"],
        excludePatterns: [
            { label: "ダム管理事務所", pattern: /ダム管理事務所|管理支所|管理所/i, nameOnly: true },
            { label: "工事事務所のみ", pattern: /工事事務所|建設事務所/i, nameOnly: true }
        ],
        acceptedTypes: ["tourist_attraction", "natural_feature", "park", "point_of_interest"],
        weakFallbackTypes: ["tourist_attraction", "natural_feature", "park"],
        requireStrongMatch: true, allowWeakFallback: true, categoryMatchScore: 10,
        scoring: { firstStrong: 42, additionalStrong: 8, weak: 4, max: 60 }
    },
    lake: {
        id: "lake", category: "scenery", detail: "lake", label: "湖",
        searchKeywordSets: ["湖 湖畔 沼 景勝地", "水辺 公園 湖畔 展望"],
        strongKeywords: ["湖", "湖畔", "沼"],
        weakKeywords: ["水辺", "公園", "展望"],
        excludePatterns: [
            { label: "会社", pattern: /株式会社|有限会社|合同会社|会社|事業所|営業所/i, nameOnly: true },
            { label: "駐車場のみ", pattern: /駐車場|パーキング|parking/i, nameOnly: true }
        ],
        acceptedTypes: ["natural_feature", "park", "tourist_attraction", "point_of_interest"],
        weakFallbackTypes: ["natural_feature", "park", "tourist_attraction"],
        requireStrongMatch: true, allowWeakFallback: true, categoryMatchScore: 10,
        scoring: { firstStrong: 42, additionalStrong: 8, weak: 4, max: 60 }
    },
    waterfall: {
        id: "waterfall", category: "scenery", detail: "waterfall", label: "滝",
        searchKeywordSets: ["滝 瀑布 景勝地", "渓谷 遊歩道 滝"],
        strongKeywords: ["滝", "瀑布"],
        weakKeywords: ["渓谷", "遊歩道"],
        excludePatterns: [
            { label: "会社", pattern: /株式会社|有限会社|合同会社|会社|事業所|営業所/i, nameOnly: true },
            { label: "駐車場のみ", pattern: /駐車場|パーキング|parking/i, nameOnly: true }
        ],
        acceptedTypes: ["natural_feature", "tourist_attraction", "park", "point_of_interest"],
        weakFallbackTypes: ["natural_feature", "tourist_attraction", "park"],
        requireStrongMatch: true, allowWeakFallback: true, categoryMatchScore: 10,
        scoring: { firstStrong: 42, additionalStrong: 8, weak: 4, max: 60 }
    },
    roadside_station: {
        id: "roadside_station", category: "tourism", detail: "roadside_station", label: "道の駅",
        searchKeywordSets: ["道の駅", "物産館 直売所 道の駅"],
        strongKeywords: ["道の駅"],
        weakKeywords: ["物産館", "直売所"],
        excludePatterns: [
            { label: "駅・バス停", pattern: /駅$|駅前|バス停|station|bus_station/i, nameOnly: true },
            { label: "会社", pattern: /株式会社|有限会社|合同会社|会社|事業所/i, nameOnly: true }
        ],
        acceptedTypes: ["tourist_attraction", "store", "food", "point_of_interest"],
        weakFallbackTypes: ["tourist_attraction", "store", "food"],
        requireStrongMatch: true, allowWeakFallback: true, categoryMatchScore: 10,
        scoring: { firstStrong: 42, additionalStrong: 8, weak: 4, max: 60 }
    },
    castle: {
        id: "castle", category: "tourism", detail: "castle", label: "城",
        searchKeywordSets: ["城 城跡 城址", "史跡 本丸 天守 城跡"],
        strongKeywords: ["城", "城跡", "城址"],
        weakKeywords: ["史跡", "本丸", "天守"],
        excludePatterns: [
            { label: "会社", pattern: /株式会社|有限会社|合同会社|会社|事業所|営業所/i, nameOnly: true },
            { label: "駅・バス停", pattern: /駅$|駅前|バス停/i, nameOnly: true }
        ],
        acceptedTypes: ["tourist_attraction", "museum", "park", "point_of_interest"],
        weakFallbackTypes: ["tourist_attraction", "museum", "park"],
        requireStrongMatch: true, allowWeakFallback: true, categoryMatchScore: 10,
        scoring: { firstStrong: 42, additionalStrong: 8, weak: 4, max: 60 }
    },
    art_museum: {
        id: "art_museum", category: "tourism", detail: "art_museum", label: "美術館",
        searchKeywordSets: ["美術館 アートミュージアム", "ギャラリー 展示館 美術"],
        strongKeywords: ["美術館", "アートミュージアム"],
        weakKeywords: ["ギャラリー", "展示館"],
        excludePatterns: [
            { label: "画材店", pattern: /画材店|画材販売|美術用品/i },
            { label: "会社", pattern: /株式会社|有限会社|合同会社|会社|事業所/i, nameOnly: true }
        ],
        acceptedTypes: ["art_gallery", "museum", "tourist_attraction", "point_of_interest"],
        weakFallbackTypes: ["art_gallery", "museum", "tourist_attraction"],
        requireStrongMatch: true, allowWeakFallback: true, categoryMatchScore: 10,
        scoring: { firstStrong: 42, additionalStrong: 8, weak: 4, max: 60 }
    },
    museum: {
        id: "museum", category: "tourism", detail: "museum", label: "博物館",
        searchKeywordSets: ["博物館 資料館 ミュージアム", "記念館 展示館 博物館"],
        strongKeywords: ["博物館", "資料館", "ミュージアム"],
        weakKeywords: ["記念館", "展示館"],
        excludePatterns: [
            { label: "会社", pattern: /株式会社|有限会社|合同会社|会社|事業所/i, nameOnly: true },
            { label: "店舗", pattern: /ショップ|販売店|店舗/i, nameOnly: true }
        ],
        acceptedTypes: ["museum", "tourist_attraction", "point_of_interest"],
        weakFallbackTypes: ["museum", "tourist_attraction"],
        requireStrongMatch: true, allowWeakFallback: true, categoryMatchScore: 10,
        scoring: { firstStrong: 42, additionalStrong: 8, weak: 4, max: 60 }
    },
    omakase: {
        id: "omakase",
        label: "わんこにおまかせ",
        searchKeywordSets: [
            "展望台 絶景 道の駅 神社 寺 博物館 ラーメン カフェ 食堂 滝 湖 渓谷 ダム 高原 公園",
            "観光 グルメ 自然 立ち寄り 景色 ご当地",
            "観光名所 レストラン 自然公園 景勝地"
        ],
        strongKeywords: [],
        weakKeywords: [],
        excludePatterns: [],
        acceptedTypes: [],
        requireStrongMatch: false,
        allowWeakFallback: false,
        categoryMatchScore: 0,
        scoring: { firstStrong: 0, additionalStrong: 0, weak: 0, max: 0 }
    }
};

// ===============================
// Ver2 気分フィルター設定
// UI表示と選択値を一元管理する（検索接続は対応済みの項目から段階的に行う）
// ===============================
const TOURING_PREFERENCES = {
    food: {
        label: "ごはん",
        question: "何が食べたい気分？",
        options: [
            { value: "ramen", label: "ラーメン" },
            { value: "seafood", label: "海鮮" },
            { value: "udon", label: "うどん" },
            { value: "soba", label: "そば" },
            { value: "curry", label: "カレー" },
            { value: "pasta", label: "パスタ" },
            { value: "gyoza", label: "餃子" },
            { value: "meat", label: "肉" },
            { value: "hamburger", label: "ハンバーガー" },
            { value: "local_gourmet", label: "ご当地グルメ" },
            { value: "cafe", label: "カフェ" },
            { value: "bread", label: "パン" },
            { value: "soft_serve", label: "ソフトクリーム" },
            { value: "omakase", label: "おまかせ" }
        ]
    },
    scenery: {
        label: "景色",
        question: "どんな景色が見たい？",
        options: [
            { value: "sea", label: "海" },
            { value: "mountain", label: "山" },
            { value: "dam", label: "ダム" },
            { value: "lake", label: "湖" },
            { value: "waterfall", label: "滝" },
            { value: "flowers", label: "花" },
            { value: "forest", label: "森" },
            { value: "omakase", label: "おまかせ" }
        ]
    },
    tourism: {
        label: "観光",
        question: "どこへ行ってみたい？",
        options: [
            { value: "shrine", label: "神社" },
            { value: "roadside_station", label: "道の駅" },
            { value: "retro", label: "レトロ" },
            { value: "castle", label: "城" },
            { value: "drive_in", label: "ドライブイン" },
            { value: "waterfall", label: "滝" },
            { value: "museum", label: "博物館" },
            { value: "onsen", label: "温泉" },
            { value: "art_museum", label: "美術館" },
            { value: "omakase", label: "おまかせ" }
        ]
    },
    ride: {
        label: "気持ちよく走る",
        question: "どんな道を走りたい？",
        options: [
            { value: "winding", label: "ワインディング" },
            { value: "coastal", label: "海沿い" },
            { value: "green_road", label: "緑の道" },
            { value: "bridge", label: "橋" },
            { value: "omakase", label: "おまかせ" }
        ]
    }
};

function buildTouringChoiceMarkup(name, value, label, controlsId = "") {
    const controlsAttribute = controlsId ? ` aria-controls="${controlsId}"` : "";
    return `
        <label class="touring-choice">
            <input type="radio" name="${name}" value="${value}"${controlsAttribute}>
            <span class="touring-choice-card">${label}</span>
        </label>
    `;
}

function initializeTouringPreferenceUI() {
    const categoryBox = document.getElementById("touringCategoryOptions");
    const detailBox = document.getElementById("touringDetailOptions");
    if (!categoryBox || !detailBox) return;

    categoryBox.innerHTML = Object.entries(TOURING_PREFERENCES)
        .map(([value, preference]) => {
            return buildTouringChoiceMarkup(
                "touringCategory",
                value,
                preference.label,
                "touringDetailStep"
            );
        })
        .join("");

    categoryBox.addEventListener("change", handleTouringCategoryChange);
    detailBox.addEventListener("change", handleTouringDetailChange);
}

function handleTouringCategoryChange(event) {
    const category = event.target && event.target.name === "touringCategory"
        ? event.target.value
        : null;
    const preference = TOURING_PREFERENCES[category];
    if (!preference) return;

    selectedTouringPreference = { category, detail: null };

    const detailStep = document.getElementById("touringDetailStep");
    const detailQuestion = document.getElementById("touringDetailQuestion");
    const detailBox = document.getElementById("touringDetailOptions");
    const status = document.getElementById("touringPreferenceStatus");
    if (!detailStep || !detailQuestion || !detailBox) return;

    detailQuestion.textContent = preference.question;
    detailBox.innerHTML = preference.options
        .map(option => buildTouringChoiceMarkup("touringDetail", option.value, option.label))
        .join("");

    detailStep.hidden = false;
    detailStep.classList.remove("is-entering");
    void detailStep.offsetWidth;
    detailStep.classList.add("is-entering");

    if (status) {
        status.textContent = `${preference.label}を選択しました。${preference.question}`;
    }
}

function handleTouringDetailChange(event) {
    if (!event.target || event.target.name !== "touringDetail") return;

    selectedTouringPreference = {
        category: selectedTouringPreference.category,
        detail: event.target.value
    };

    const preference = TOURING_PREFERENCES[selectedTouringPreference.category];
    const selectedOption = preference
        ? preference.options.find(option => option.value === selectedTouringPreference.detail)
        : null;
    const status = document.getElementById("touringPreferenceStatus");
    if (status && selectedOption) status.textContent = `${selectedOption.label}を選択しました。`;
}

function getSelectedTouringPreference() {
    const selectedCategory = document.querySelector('input[name="touringCategory"]:checked');
    const selectedDetail = document.querySelector('input[name="touringDetail"]:checked');
    return {
        category: selectedCategory ? selectedCategory.value : null,
        detail: selectedDetail ? selectedDetail.value : null
    };
}

// category/detailの組み合わせから、対応する検索プロファイルを設定駆動で選ぶ。
function resolveSearchIntent(preference) {
    if (!preference || !preference.category || !preference.detail) return "omakase";
    const profile = Object.values(DETAIL_SEARCH_PROFILES).find(item => {
        return item.category === preference.category && item.detail === preference.detail;
    });
    return profile ? profile.id : "omakase";
}

const HIGHWAY_SPEED = 80;
const LOCAL_SPEED = 40;

// ===============================
// ツーリング時間設定
// 実ルートの採用レンジと、既存の探索距離設定を一元管理する
// ===============================
const TOURING_TIME_PROFILES = {
    30: {
        value: 30,
        label: "30分くらい",
        routeRange: { min: 15, max: 40 },
        searchDistance: {
            highway: { maxKm: 10, minRatio: 0 },
            local: { maxKm: 8, minRatio: 0 }
        }
    },
    60: {
        value: 60,
        label: "1時間くらい",
        routeRange: { min: 45, max: 75 },
        searchDistance: {
            highway: { maxKm: 35, minRatio: 0.55 },
            local: { maxKm: 18, minRatio: 0.25 }
        }
    },
    90: {
        value: 90,
        label: "1時間半くらい",
        routeRange: { min: 65, max: 110 },
        searchDistance: {
            highway: { maxKm: 60, minRatio: 0.60 },
            local: { maxKm: 28, minRatio: 0.35 }
        }
    },
    120: {
        value: 120,
        label: "2時間くらい",
        routeRange: { min: 90, max: 145 },
        searchDistance: {
            highway: { maxKm: 85, minRatio: 0.65 },
            local: { maxKm: 38, minRatio: 0.45 }
        }
    },
    150: {
        value: 150,
        label: "2時間半くらい",
        routeRange: { min: 115, max: 180 },
        searchDistance: {
            highway: { maxKm: 110, minRatio: 0.70 },
            local: { maxKm: 48, minRatio: 0.50 }
        }
    },
    180: {
        value: 180,
        label: "3時間くらい",
        routeRange: { min: 140, max: 215 },
        searchDistance: {
            highway: { maxKm: 135, minRatio: 0.72 },
            local: { maxKm: 58, minRatio: 0.55 }
        }
    }
};

function getTouringTimeProfile(time) {
    return TOURING_TIME_PROFILES[Number(time)] || TOURING_TIME_PROFILES[60];
}

const TOKYO_STATION_POSITION = {
    center: { lat: 35.681236, lng: 139.767125 },
    zoom: 12,
    gestureHandling: "greedy"
};

const EXCLUDE_DISTANCE_KM = 3;
let loadingTimer = null;
let completedSpotResults = 0;
let activeRouteSearchContext = null;

// API使用回数を抑えるための調整
const MAX_POINT_ATTEMPTS = 8;
const SEARCH_RADIUS_MIN = 5000;
const SEARCH_RETRY_LIMIT = 1;

// ルート判定用
const ROUTE_CHECK_CANDIDATES_PER_GENRE = 3;
const SEA_ROUTE_CHECK_CANDIDATES = 5;
const SINGLE_RESULT_ROUTE_CHECK_CANDIDATES = 8;
const ROUTE_SEARCH_MAX_ATTEMPTS = 3;
const OMAKASE_SCORE_WINDOW = 8;
const OMAKASE_MIN_QUALITY_SCORE = 3;

function createRouteSearchContext() {
    return {
        attempt: 1,
        maxAttempts: ROUTE_SEARCH_MAX_ATTEMPTS,
        routeInfoByPlaceId: new Map(),
        candidatePoolByPlaceId: new Map(),
        checkedPlaceIds: new Set(),
        outOfRangePlaceIds: new Set(),
        attemptStats: {
            directionsTargets: 0,
            cacheSkips: 0
        }
    };
}

// ===============================
// Google Map 初期表示
// ===============================
window.initMap = function () {
    map = new google.maps.Map(
        document.getElementById("map"),
        TOKYO_STATION_POSITION
    );
};

// ===============================
// 検索開始
// ===============================
function searchSpot() {
    selectedTouringPreference = getSelectedTouringPreference();
    console.log("どこいこMap Ver2 気分フィルター:", selectedTouringPreference);

    const startAddress = document.getElementById("startLocation").value;
    startAddressGlobal = startAddress;

    if (!startAddress) {
        alert("出発地を入力してね！");
        return;
    }

    const time = Number(document.getElementById("timeSelect").value);
    const highway = document.getElementById("highway").value;
    selectedIntent = resolveSearchIntent(selectedTouringPreference);
    console.log("どこいこMap Ver2 検索モード:", selectedIntent);
    activeRouteSearchContext = createRouteSearchContext();

    clearResults();
    showLoadingState("検索中...", "わんこが目的地を探してるよ");

    const geocoder = new google.maps.Geocoder();

    geocoder.geocode({ address: startAddress }, function (results, status) {
        if (status !== "OK" || !results[0]) {
            hideLoadingState();
            alert("出発地を取得できませんでした");
            return;
        }

        startLat = results[0].geometry.location.lat();
        startLng = results[0].geometry.location.lng();
        startPrefectureGlobal = getPrefectureFromGeocodeResult(results[0]);

        const startPos = { lat: startLat, lng: startLng };

        map.setCenter(startPos);
        map.setZoom(14);

        if (startMarker) startMarker.setMap(null);

        startMarker = new google.maps.Marker({
            position: startPos,
            map: map,
            icon: {
                url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
            }
        });

        const maxDistance = maxDistanceByTime(time, highway);
        findValidPoint(startLat, startLng, maxDistance, geocoder, time, highway);
    });
}

// ===============================
// 結果クリア
// ===============================
function clearResults() {
    const resultsBox = document.getElementById("results");

    if (resultsBox) {
        resultsBox.classList.remove("show");
        resultsBox.classList.remove("loading");
        resultsBox.classList.remove("recommendation-preview");
        resultsBox.classList.add("hidden");

        resultsBox.innerHTML = `
            <div id="result1" class="result-item"></div>
        `;
    }

    if (loadingTimer) {
        clearInterval(loadingTimer);
        loadingTimer = null;
    }

    completedSpotResults = 0;

    spotMarkers.forEach(m => m.setMap(null));
    spotMarkers = [];

    if (currentInfoWindow) {
        currentInfoWindow.close();
        currentInfoWindow = null;
    }

    const rerollButton = document.getElementById("rerollButton");
    if (rerollButton) {
        rerollButton.classList.add("hidden");
    }
}

// ===============================
// ランダム座標生成（ドーナツ型）
// ===============================
function createRandomPoint(lat, lng, minDistanceKm, maxDistanceKm) {
    const safeMin = Math.max(0, minDistanceKm || 0);
    const safeMax = Math.max(safeMin + 0.5, maxDistanceKm || safeMin + 0.5);

    const minR = safeMin / 111;
    const maxR = safeMax / 111;

    const u = Math.random();
    const v = Math.random();

    const r = Math.sqrt((maxR * maxR - minR * minR) * u + minR * minR);
    const t = 2 * Math.PI * v;

    const newLat = lat + r * Math.cos(t);
    const newLng = lng + r * Math.sin(t) / Math.cos(lat * Math.PI / 180);
    const distanceKm = r * 111;

    return { lat: newLat, lng: newLng, distanceKm };
}

// ===============================
// 方角ベースの候補中心点生成
// ===============================
function createDirectionalPoint(lat, lng, minDistanceKm, maxDistanceKm) {
    const safeMin = Math.max(0, minDistanceKm || 0);
    const safeMax = Math.max(safeMin + 0.5, maxDistanceKm || safeMin + 0.5);

    const targetDistanceKm = safeMin + Math.random() * (safeMax - safeMin);

    const baseAngles = [
        0,                  // 北
        Math.PI / 2,        // 東
        Math.PI,            // 南
        Math.PI * 1.5       // 西
    ];

    const baseAngle = baseAngles[Math.floor(Math.random() * baseAngles.length)];

    // 少しだけズラす（±25度）
    const randomOffset = (Math.random() - 0.5) * (Math.PI / 180) * 50;
    const angle = baseAngle + randomOffset;

    const distanceInDegrees = targetDistanceKm / 111;

    const newLat = lat + distanceInDegrees * Math.cos(angle);
    const newLng = lng + distanceInDegrees * Math.sin(angle) / Math.cos(lat * Math.PI / 180);

    return {
        lat: newLat,
        lng: newLng,
        distanceKm: targetDistanceKm
    };
}



// ===============================
// 候補地の選出半径の設定
// ===============================
function maxDistanceByTime(time, highway) {
    const profile = getTouringTimeProfile(time);
    const mode = highway === "yes" ? "highway" : "local";
    return profile.searchDistance[mode].maxKm;
}

// ===============================
// 最小距離計算（ドーナツ型用）
// ===============================
function getMinDistanceByTime(maxDistance, time, highway) {
    const profile = getTouringTimeProfile(time);
    const mode = highway === "yes" ? "highway" : "local";
    return maxDistance * profile.searchDistance[mode].minRatio;
}

// ===============================
function calcDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ===============================
// 都道府県取得
// ===============================
function getPrefectureFromGeocodeResult(result) {
    if (!result || !result.address_components) return "";

    for (const comp of result.address_components) {
        if (comp.types.includes("administrative_area_level_1")) {
            return comp.long_name;
        }
    }

    return "";
}

// ===============================
// 同じ都道府県っぽいか判定
// ===============================
function isLikelySamePrefecture(place) {
    if (!startPrefectureGlobal || !place) return false;

    const text = `${place.name || ""} ${place.vicinity || ""}`;

    return text.includes(startPrefectureGlobal);
}

function getRegionName(prefecture) {
    const regions = {
        kanto: ["東京都", "神奈川県", "埼玉県", "千葉県", "茨城県", "栃木県", "群馬県"],
        kansai: ["大阪府", "京都府", "兵庫県", "奈良県", "滋賀県", "和歌山県"]
    };

    for (const regionName in regions) {
        if (regions[regionName].includes(prefecture)) {
            return regionName;
        }
    }

    return "";
}

// ===============================
// 高速あり時の県内候補減点
// ===============================
function getPrefectureScore(place, highway) {
    if (highway !== "yes") return 0;

    const text = `${place.name || ""} ${place.vicinity || ""}`;
    const startRegion = getRegionName(startPrefectureGlobal);

    // 都道府県名が分かる場合：同県は強く減点
    if (startPrefectureGlobal && text.includes(startPrefectureGlobal)) {
        return -45;
    }

    // 関東・関西など、同じ大都市圏っぽい候補は少し減点
    if (startRegion === "kanto") {
        if (/東京都|神奈川県|埼玉県|千葉県/.test(text)) return -25;
    }

    if (startRegion === "kansai") {
        if (/大阪府|京都府|兵庫県|奈良県|滋賀県|和歌山県/.test(text)) return -25;
    }

    return 15;
}

// ===============================
// 希望との一致根拠を採点する
// 合計点だけでなく、一致語・type・除外理由を保持する
// ===============================
function evaluateIntentMatch(place, profile) {
    const name = place && place.name ? place.name : "";
    const vicinity = place && place.vicinity ? place.vicinity : "";
    const types = place && Array.isArray(place.types) ? place.types : [];
    const text = `${name} ${vicinity} ${types.join(" ")}`;

    const strongMatches = profile.strongKeywords.filter(keyword => text.includes(keyword));
    const weakMatches = profile.weakKeywords.filter(keyword => text.includes(keyword));
    const matchedTypes = profile.acceptedTypes.filter(type => types.includes(type));
    const exclusionReasons = profile.excludePatterns
        .filter(rule => {
            if (rule.ignoreWhenStrongMatch && strongMatches.length > 0) return false;
            if (rule.ignoreWhenTypes && rule.ignoreWhenTypes.some(type => types.includes(type))) return false;
            return rule.pattern.test(rule.nameOnly ? name : text);
        })
        .map(rule => rule.label);

    let score = 0;
    if (strongMatches.length > 0) {
        score += profile.scoring.firstStrong;
        score += Math.max(0, strongMatches.length - 1) * profile.scoring.additionalStrong;
    }
    score += weakMatches.length * profile.scoring.weak;
    const categoryMatchScore = matchedTypes.length > 0 ? (profile.categoryMatchScore || 0) : 0;
    score += categoryMatchScore;
    score = Math.min(score, profile.scoring.max);

    return {
        intentId: profile.id,
        score,
        strongMatches,
        weakMatches,
        matchedTypes,
        categoryMatchScore,
        exclusionReasons,
        hasStrongMatch: strongMatches.length > 0,
        hasWeakMatch: weakMatches.length > 0,
        excluded: exclusionReasons.length > 0,
        usedWeakFallback: false
    };
}

// 除外と必須条件を採点から分離し、候補を検索対象に残せるかだけを判定する。
function checkIntentRequirements(place, evaluation, profile, allowWeakFallback = false) {
    const types = place && Array.isArray(place.types) ? place.types : [];
    const rejectionReasons = [...evaluation.exclusionReasons];

    if (evaluation.excluded) {
        return { eligible: false, rejectionReasons, matchLevel: "excluded" };
    }

    if (!profile.requireStrongMatch || evaluation.hasStrongMatch) {
        return {
            eligible: true,
            rejectionReasons: [],
            matchLevel: evaluation.hasStrongMatch ? "strong" : "unrestricted"
        };
    }

    const weakFallbackTypes = profile.weakFallbackTypes || [];
    const matchedWeakFallbackTypes = weakFallbackTypes.filter(type => types.includes(type));
    const canUseWeakFallback =
        allowWeakFallback &&
        profile.allowWeakFallback &&
        evaluation.hasWeakMatch &&
        matchedWeakFallbackTypes.length > 0;

    if (canUseWeakFallback) {
        return {
            eligible: true,
            rejectionReasons: [],
            matchLevel: "weak-fallback",
            matchedWeakFallbackTypes
        };
    }

    rejectionReasons.push("強い一致語なし");
    if (evaluation.hasWeakMatch && matchedWeakFallbackTypes.length === 0) {
        rejectionReasons.push("弱い一致を裏付けるPlaces typeなし");
    }
    return { eligible: false, rejectionReasons, matchLevel: "insufficient" };
}

// 一致語・点数・除外理由を、候補ごとに開発者ツールで確認できるようにする。
function logIntentEvaluation(place, evaluation, requirement) {
    console.debug("[どこいこ診断] detail適合候補", {
        detailProfile: evaluation.intentId,
        placeId: place && place.place_id ? place.place_id : "",
        name: place && place.name ? place.name : "名称不明",
        score: evaluation.score,
        categoryMatchScore: evaluation.categoryMatchScore,
        strongMatches: evaluation.strongMatches,
        weakMatches: evaluation.weakMatches,
        matchedTypes: evaluation.matchedTypes,
        excluded: evaluation.excluded,
        exclusionReasons: evaluation.exclusionReasons,
        eligible: requirement.eligible,
        matchLevel: requirement.matchLevel,
        rejectionReasons: requirement.rejectionReasons
    });
}

// ===============================
// 希望別の必須条件判定
// 強い一致が0件のときだけ、弱い一致を候補不足時のフォールバックにする
// ===============================
function filterCandidatesByIntent(results) {
    const profile = DETAIL_SEARCH_PROFILES[selectedIntent] || DETAIL_SEARCH_PROFILES.omakase;
    intentEvaluationByPlaceId = new Map();

    if (profile.id === "omakase") return results;

    const evaluated = results.map(place => {
        const evaluation = evaluateIntentMatch(place, profile);
        if (place && place.place_id) {
            intentEvaluationByPlaceId.set(place.place_id, evaluation);
        }
        const strongRequirement = checkIntentRequirements(place, evaluation, profile, false);
        return { place, evaluation, strongRequirement };
    });

    const strongCandidates = evaluated.filter(item => {
        return item.strongRequirement.eligible;
    });

    if (strongCandidates.length > 0) {
        evaluated.forEach(item => {
            logIntentEvaluation(item.place, item.evaluation, item.strongRequirement);
        });
        const accepted = strongCandidates.map(item => item.place);
        logIntentFilterSummary(profile, evaluated, accepted, "strong");
        return accepted;
    }

    if (!profile.allowWeakFallback) {
        evaluated.forEach(item => {
            logIntentEvaluation(item.place, item.evaluation, item.strongRequirement);
        });
        logIntentFilterSummary(profile, evaluated, [], "no-match");
        return [];
    }

    const weakCandidates = evaluated
        .map(item => {
            const requirement = checkIntentRequirements(item.place, item.evaluation, profile, true);
            logIntentEvaluation(item.place, item.evaluation, requirement);
            return { ...item, requirement };
        })
        .filter(item => item.requirement.eligible)
        .map(item => {
            const evaluation = intentEvaluationByPlaceId.get(item.place.place_id);
            if (evaluation) evaluation.usedWeakFallback = true;
            return item.place;
        });
    logIntentFilterSummary(
        profile,
        evaluated,
        weakCandidates,
        weakCandidates.length > 0 ? "weak-fallback" : "no-match"
    );
    return weakCandidates;
}

// 完全一致・弱一致・除外・一致なしの件数をdetail共通の診断形式で残す。
function logIntentFilterSummary(profile, evaluated, accepted, result) {
    console.debug("[どこいこ診断] detail適合集計", {
        detailProfile: profile.id,
        category: profile.category || null,
        detail: profile.detail || null,
        placesCandidateCount: evaluated.length,
        strongMatchCount: evaluated.filter(item => item.evaluation.hasStrongMatch).length,
        weakOnlyCount: evaluated.filter(item => {
            return !item.evaluation.hasStrongMatch && item.evaluation.hasWeakMatch;
        }).length,
        excludedCount: evaluated.filter(item => item.evaluation.excluded).length,
        noMatchCount: evaluated.filter(item => {
            return !item.evaluation.hasStrongMatch && !item.evaluation.hasWeakMatch;
        }).length,
        acceptedCount: accepted.length,
        result
    });
}

// ===============================
// 希望適合スコア取得
// ===============================
function getIntentScore(place) {
    if (selectedIntent === "omakase" || !place || !place.place_id) return 0;
    const evaluation = intentEvaluationByPlaceId.get(place.place_id);
    return evaluation ? evaluation.score : 0;
}

// ===============================
// 評価・口コミは候補品質の補助として最大8点に抑える
// ===============================
function getQualityScore(place) {
    const rating = Number(place && place.rating ? place.rating : 0);
    const reviews = Number(place && place.user_ratings_total ? place.user_ratings_total : 0);

    let ratingScore = 1;
    if (rating >= 4.4) ratingScore = 5;
    else if (rating >= 4.2) ratingScore = 4;
    else if (rating >= 4.0) ratingScore = 3;
    else if (rating >= 3.7) ratingScore = 1;
    else if (rating > 0) ratingScore = 0;

    let reviewScore = 0;
    if (reviews >= 300) reviewScore = 3;
    else if (reviews >= 100) reviewScore = 2.5;
    else if (reviews >= 30) reviewScore = 2;
    else if (reviews >= 10) reviewScore = 1;
    else if (reviews > 0) reviewScore = 0.5;

    return {
        score: Math.min(8, ratingScore + reviewScore),
        ratingScore,
        reviewScore,
        rating,
        reviews
    };
}

// ===============================
// 候補中心点を探す（方角ベース）
// ===============================
function findValidPoint(startLat, startLng, maxDistance, geocoder, time, highway, attempt = 0, searchAttemptIndex = 0) {
    if (attempt > MAX_POINT_ATTEMPTS) {
        hideLoadingState();
        alert("候補地を見つけられませんでした。もう一度まわしてみてね！");
        return;
    }

    const minDistance = getMinDistanceByTime(maxDistance, time, highway);
    const point = createDirectionalPoint(startLat, startLng, minDistance, maxDistance);

    geocoder.geocode(
        { location: { lat: point.lat, lng: point.lng } },
        function (results, status) {
            if (status === "OK" && results[0]) {
                let prefecture = "";

                for (const comp of results[0].address_components) {
                    if (comp.types.includes("administrative_area_level_1")) {
                        prefecture = comp.long_name;
                    }
                }

                if (prefecture) {
                    searchThreeGenres(point.lat, point.lng, point.distanceKm, time, highway, searchAttemptIndex);
                    return;
                }
            }

            findValidPoint(startLat, startLng, maxDistance, geocoder, time, highway, attempt + 1, searchAttemptIndex);
        }
    );
}

// ===============================
// 画像URL取得
// ===============================
function getSpotPhotoUrl(spot) {
    if (spot.photos && spot.photos.length > 0) {
        try {
            return spot.photos[0].getUrl({
                maxWidth: 640,
                maxHeight: 420
            });
        } catch (e) {
            return "";
        }
    }
    return "";
}

// ===============================
// タイプ整形
// ===============================
function formatSpotTypes(types = [], genreName = "", keyword = "") {
    const typeMap = {
        cafe: "カフェ",
        restaurant: "レストラン",
        ramen_restaurant: "ラーメン",
        tourist_attraction: "観光スポット",
        park: "公園",
        museum: "博物館",
        art_gallery: "美術館",
        shrine: "神社",
        temple: "寺",
        campground: "キャンプ場",
        natural_feature: "自然スポット",
        point_of_interest: "立ち寄りスポット"
    };

    const labels = types
        .map(type => typeMap[type])
        .filter(Boolean);

    if (labels.length > 0) {
        return [...new Set(labels)].slice(0, 2).join("・");
    }

    return keyword || genreName.replace(/[🔭⛩🍽🍜🌳🍃]/g, "");
}

// ===============================
// 軽い説明文
// ===============================
function buildSpotCatchCopy(spot, genreName, keyword) {
    const rating = Number(spot.rating || 0);
    const reviews = Number(spot.user_ratings_total || 0);
    const typeLabel = formatSpotTypes(spot.types || [], genreName, keyword);

    if (genreName.includes("グルメ")) {
        if (rating >= 4.2 && reviews >= 100) {
            return `口コミ数も多い人気の${typeLabel}です。`;
        }
        if (rating >= 4.0) {
            return `立ち寄り候補にしやすい評価高めの${typeLabel}です。`;
        }
        return `ツーリング途中にも寄りやすそうな${typeLabel}です。`;
    }

    if (genreName.includes("自然")) {
        if (rating >= 4.2) {
            return `景色や空気感を楽しみやすい${typeLabel}です。`;
        }
        return `気分転換の立ち寄り先になりそうな${typeLabel}です。`;
    }

    if (rating >= 4.2 && reviews >= 100) {
        return `評価が高めで人気の${typeLabel}スポットです。`;
    }

    if (rating >= 4.0) {
        return `立ち寄り先として選びやすい${typeLabel}スポットです。`;
    }

    return `ドライブやツーリングの途中で楽しめそうな${typeLabel}スポットです。`;
}

// ===============================
// 共通履歴保存
// ===============================
const DOKOIKO_HISTORY_KEY = "dokoiko_history";
const DOKOIKO_HISTORY_MAX = 6;

function saveDokoikoHistoryItem(data) {
    const current = JSON.parse(localStorage.getItem(DOKOIKO_HISTORY_KEY) || "[]");

    const placeId = data.placeId || data.place_id || data.name || data.placeName;

    const historyItem = {
        savedAt: new Date().toISOString(),
        placeId: placeId,
        ...data
    };

    const filtered = current.filter(item => {
        return !(item.placeId === historyItem.placeId && item.sourceType === historyItem.sourceType);
    });

    filtered.unshift(historyItem);

    const trimmed = filtered.slice(0, DOKOIKO_HISTORY_MAX);

    localStorage.setItem(DOKOIKO_HISTORY_KEY, JSON.stringify(trimmed));
}

// ===============================
// スポット版
// ===============================
function saveSpotHistoryItem(data) {
    saveDokoikoHistoryItem({
        sourceType: "spot",
        sourceLabel: "スポット版",
        ...data
    });
}

// ===============================
// グルメ版
// ===============================
function saveGourmetHistoryItem(data) {
    saveDokoikoHistoryItem({
        sourceType: "gourmet",
        sourceLabel: "グルメ版",
        ...data
    });
}

// ===============================
// 観光版
// ===============================
function saveTourismHistoryItem(data) {
    saveDokoikoHistoryItem({
        sourceType: "tourism",
        sourceLabel: "観光版",
        ...data
    });
}

// ===============================
// 自然版
// ===============================
function saveNatureHistoryItem(data) {
    saveDokoikoHistoryItem({
        sourceType: "nature",
        sourceLabel: "自然版",
        ...data
    });
}

// ===============================
// 気持ちよく走れる道版
// ===============================
function saveGoodRoadHistoryItem(data) {
    saveDokoikoHistoryItem({
        sourceType: "goodroad",
        sourceLabel: "気持ちよく走れる道版",
        ...data
    });
}

 // ===============================
 // 共有（目的地のみ）
 // ===============================
 function shareSpotResult(index) {
     const card = document.getElementById(`result${index + 1}`);
     if (!card) return;

     const spotName = card.dataset.spotName;
     const placeId = card.dataset.placeId;
     const spotAddress = card.dataset.spotAddress || "";

     // 目的地を特定できない場合は共有しない
     if (!spotName || !spotName.trim()) {
         alert("共有するスポット情報が見つかりませんでした。");
         return;
     }

     const query = [spotName, spotAddress]
         .filter(Boolean)
         .join(" ");

     const params = new URLSearchParams({
         api: "1",
         query: query
     });

     if (placeId) {
         params.set("query_place_id", placeId);
     }

     // 目的地単体のGoogleマップURL
     const shareUrl =
         "https://www.google.com/maps/search/?" + params.toString();

     const shareText =
         "🏍️ どこいこMapで見つけたスポット！\n" +
         "📍 " + spotName;

     if (navigator.share) {
         navigator.share({
             title: "どこいこMap",
             text: shareText,
             url: shareUrl
         }).catch(() => {});
         return;
     }

     const xUrl =
         "https://twitter.com/intent/tweet?text=" +
         encodeURIComponent(shareText) +
         "&url=" +
         encodeURIComponent(shareUrl);

     window.open(xUrl, "_blank", "noopener,noreferrer");
 }


// ===============================
// ジャンル定義
// ===============================
// 実ルート許容範囲
// ===============================
function getRouteTimeRange(time) {
    const range = getTouringTimeProfile(time).routeRange;
    return { min: range.min, max: range.max };
}

function getCurrentPhotoFallbackKey() {
    const category = selectedTouringPreference.category;
    const detail = selectedTouringPreference.detail;
    if (detail === "sea") return "sea";
    if (detail === "mountain" || category === "scenery") return "nature";
    if (detail === "onsen") return "onsen";
    if (category === "food") return "food";
    if (category === "ride") return "ride";
    if (category === "tourism") return "tourism";
    return "omakase";
}

function getPhotoAttributionText(photo) {
    const attributions = photo && Array.isArray(photo.html_attributions)
        ? photo.html_attributions
        : [];
    return attributions.map(attribution => {
        const box = document.createElement("div");
        box.innerHTML = attribution;
        return (box.textContent || "").trim();
    }).filter(Boolean).join(" / ");
}

function selectSpotPhotos(spot) {
    const sourcePhotos = spot && Array.isArray(spot.photos) ? spot.photos : [];
    const selected = [];
    const excluded = [];
    const seenUrls = new Set();

    const evaluated = sourcePhotos.map((photo, index) => {
        const width = Number(photo && photo.width ? photo.width : 0);
        const height = Number(photo && photo.height ? photo.height : 0);
        const ratio = height > 0 ? width / height : 0;
        let url = "";

        try {
            url = photo && typeof photo.getUrl === "function"
                ? photo.getUrl({ maxWidth: 1200, maxHeight: 800 })
                : "";
        } catch (error) {
            excluded.push({ index, width, height, reason: "写真URL取得失敗" });
            return null;
        }

        if (!url) {
            excluded.push({ index, width, height, reason: "写真URLなし" });
            return null;
        }
        if (seenUrls.has(url)) {
            excluded.push({ index, width, height, reason: "同一URLの重複写真" });
            return null;
        }
        seenUrls.add(url);

        if (width < 480 || height < 320) {
            excluded.push({ index, width, height, reason: "解像度不足" });
            return null;
        }
        if (ratio < 0.65) {
            excluded.push({ index, width, height, reason: "極端な縦長" });
            return null;
        }

        const targetRatio = 1.5;
        const ratioScore = Math.max(0, 30 - Math.abs(ratio - targetRatio) * 20);
        const landscapeScore = ratio >= 1 ? 20 : 0;
        const resolutionScore = Math.min(40, (width * height) / 100000);

        const attribution = getPhotoAttributionText(photo);
        return {
            url,
            width,
            height,
            attribution,
            credit: attribution,
            alt: `${spot.name || "スポット"}の写真${index + 1}`,
            qualityScore: ratioScore + landscapeScore + resolutionScore,
            sourceIndex: index
        };
    }).filter(Boolean);

    evaluated.sort((a, b) => b.qualityScore - a.qualityScore);
    selected.push(...evaluated.slice(0, 3));
    evaluated.slice(3).forEach(photo => {
        excluded.push({
            index: photo.sourceIndex,
            width: photo.width,
            height: photo.height,
            reason: "表示上限3枚"
        });
    });

    return {
        totalCount: sourcePhotos.length,
        photos: selected,
        excluded,
        fallbackKey: getCurrentPhotoFallbackKey(),
        fallbackUsed: selected.length === 0
    };
}


// ===============================
// 実ルート取得
// ===============================
function getRouteInfoToSpot(spot, highway) {
    return new Promise((resolve) => {
        if (!startLat || !startLng || !spot || !spot.geometry || !spot.geometry.location) {
            resolve(null);
            return;
        }

        const service = new google.maps.DirectionsService();

        service.route(
            {
                origin: { lat: startLat, lng: startLng },
                destination: {
                    placeId: spot.place_id
                },
                travelMode: google.maps.TravelMode.DRIVING,
                avoidHighways: highway !== "yes",
                avoidTolls: highway !== "yes",
                provideRouteAlternatives: false
            },
            function (result, status) {
                if (status !== "OK" || !result || !result.routes || !result.routes[0]) {
                    resolve(null);
                    return;
                }

                const leg = result.routes[0].legs && result.routes[0].legs[0];
                if (!leg || !leg.duration || !leg.distance) {
                    resolve(null);
                    return;
                }

                const durationMinutes = Math.round(leg.duration.value / 60);
                const distanceKm = Number((leg.distance.value / 1000).toFixed(1));

                resolve({
                    durationMinutes,
                    durationText: leg.duration.text,
                    distanceKm,
                    distanceText: leg.distance.text,
                    routeResult: result
                });
            }
        );
    });
}

// ===============================
// 候補距離レンジ
// ===============================
function getCandidateDistanceRange(time, highway, maxDistance) {
    if (time <= 30) {
        return { min: 0, max: maxDistance };
    }

    if (highway === "yes") {
        return {
            min: maxDistance * 0.55,
            max: maxDistance * 1.05
        };
    }

    return {
        min: maxDistance * 0.25,
        max: maxDistance * 1.05
    };
}

// ===============================
// 軽量版：Directionsを使わずに候補を選ぶ
// ===============================
// 距離スコア：選択時間に合いそうな距離を優先
// ===============================
function getDistanceScore(straightDistance, maxDistance, time, highway = "no") {
    const ratio = straightDistance / maxDistance;

    let score = 0;

    let idealMin = 0.6;
    let idealMax = 0.9;

    if (time <= 60) {
        idealMin = highway === "yes" ? 0.55 : 0.35;
        idealMax = highway === "yes" ? 0.95 : 0.75;
    }

    if (time >= 120) {
        idealMin = highway === "yes" ? 0.65 : 0.45;
        idealMax = highway === "yes" ? 1.0 : 0.85;
    }

    if (ratio >= idealMin && ratio <= idealMax) {
        score += 35;
    }

    if (ratio < idealMin) {
        score -= highway === "yes" ? 30 : 10;
    }

    if (ratio > idealMax) {
        score -= highway === "yes" ? 20 : 35;
    }

    if (ratio > 1.0) {
        score -= 60;
    }

    return score;
}

// ===============================
// 実ルートで候補を選ぶ
// 同じ検索操作内では、同じplace_id・高速設定のDirections結果を再利用する。
async function getRouteInfoWithCache(spot, highway, searchContext) {
    if (!searchContext || !spot || !spot.place_id) {
        return getRouteInfoToSpot(spot, highway);
    }

    const cacheKey = `${spot.place_id}:${highway}`;
    if (searchContext.routeInfoByPlaceId.has(cacheKey)) {
        searchContext.attemptStats.cacheSkips++;
        console.log("[どこいこ診断] Directions重複回避", {
            searchAttempt: searchContext.attempt,
            candidateName: spot.name || "名称不明",
            placeId: spot.place_id,
            reason: "確認済みplace_idのためキャッシュを再利用"
        });
        return searchContext.routeInfoByPlaceId.get(cacheKey);
    }

    searchContext.checkedPlaceIds.add(spot.place_id);
    const routeInfo = await getRouteInfoToSpot(spot, highway);
    searchContext.routeInfoByPlaceId.set(cacheKey, routeInfo);
    return routeInfo;
}

// 全カテゴリ共通：設定レンジで採否を決め、レンジ内だけ時間補助点を付ける。
function evaluateRouteTimeMatch(durationMinutes, requestedMinutes) {
    const range = getRouteTimeRange(requestedMinutes);
    const differenceMinutes = Math.abs(durationMinutes - requestedMinutes);
    const differenceRatio = requestedMinutes > 0
        ? differenceMinutes / requestedMinutes
        : 1;
    const acceptable =
        durationMinutes >= range.min &&
        durationMinutes <= range.max;

    let tier = "outside";
    let score = 0;
    if (acceptable && differenceRatio <= 0.10) {
        tier = "best";
        score = 10;
    } else if (acceptable && differenceRatio <= 0.20) {
        tier = "high";
        score = 6;
    } else if (acceptable) {
        tier = "acceptable";
        score = 2;
    }

    return {
        acceptable,
        tier,
        score,
        range,
        differenceMinutes,
        differenceRatio
    };
}

function getSelectedDetailLabel() {
    const preference = TOURING_PREFERENCES[selectedTouringPreference.category];
    const option = preference && preference.options.find(item => {
        return item.value === selectedTouringPreference.detail;
    });
    return option ? option.label : "";
}

function evaluateCategoryDetailMatch(place) {
    const category = selectedTouringPreference.category;
    const detail = selectedTouringPreference.detail;
    const types = Array.isArray(place.types) ? place.types : [];
    const text = `${place.name || ""} ${place.vicinity || ""} ${types.join(" ")}`;
    const detailLabel = getSelectedDetailLabel();
    const matchedTypes = [];
    let categoryScore = 0;
    let detailScore = 0;

    const typeRules = {
        food: ["restaurant", "cafe", "food", "bakery", "meal_takeaway"],
        scenery: ["natural_feature", "park", "tourist_attraction"],
        tourism: ["tourist_attraction", "museum", "art_gallery", "place_of_worship"],
        ride: ["natural_feature", "park", "tourist_attraction"]
    };

    (typeRules[category] || []).forEach(type => {
        if (types.includes(type)) matchedTypes.push(type);
    });
    if (matchedTypes.length > 0) categoryScore = category === "ride" ? 8 : 12;

    if (detail && detail !== "omakase" && detailLabel && text.includes(detailLabel)) {
        detailScore = 24;
    }

    // 専用プロファイルがあるdetailは、共通の強一致・弱一致スコアを最優先で利用する。
    const intentScore = selectedIntent !== "omakase" ? getIntentScore(place) : 0;
    const score = Math.max(intentScore, categoryScore + detailScore);

    return {
        score,
        category,
        detail,
        detailLabel,
        categoryScore,
        detailScore,
        intentScore,
        matchedTypes,
        detailMatched: detailScore > 0
    };
}

function evaluateDestinationSuitability(place) {
    const name = place.name || "";
    const vicinity = place.vicinity || "";
    const types = Array.isArray(place.types) ? place.types : [];
    const text = `${name} ${vicinity} ${types.join(" ")}`;
    const positiveMatches = [];
    const negativeMatches = [];
    let score = 0;

    const positivePattern = /展望台|絶景|景勝地|海岸|岬|灯台|道の駅|温泉|神社|寺|湖|滝|渓谷|ダム|高原|公園|城/i;
    const negativePattern = /オフィス|企業|会社|ビル|学校|病院|駅前|駐車場$|パーキング$/i;

    const positive = text.match(positivePattern);
    if (positive) {
        positiveMatches.push(positive[0]);
        score += 18;
    }

    if (types.some(type => ["tourist_attraction", "natural_feature", "park"].includes(type))) {
        positiveMatches.push("目的地向けPlaces type");
        score += 10;
    }

    const negative = text.match(negativePattern);
    if (negative) {
        negativeMatches.push(negative[0]);
        score -= 25;
    }

    return { score, positiveMatches, negativeMatches };
}

function buildSingleCandidatePool(results, time, highway, maxDistance, searchContext) {
    const currentPlaces = new Map();
    let duplicateCount = 0;

    results.forEach(place => {
        if (!place || !place.place_id || !place.geometry || !place.geometry.location) return;
        if (currentPlaces.has(place.place_id)) {
            duplicateCount++;
            return;
        }
        currentPlaces.set(place.place_id, place);
    });

    const distanceRange = getCandidateDistanceRange(time, highway, maxDistance);
    const candidates = [];

    currentPlaces.forEach(place => {
        const straightDistance = calcDistance(
            startLat,
            startLng,
            place.geometry.location.lat(),
            place.geometry.location.lng()
        );
        if (straightDistance < distanceRange.min || straightDistance > distanceRange.max) return;

        const categoryDetail = evaluateCategoryDetailMatch(place);
        const destination = evaluateDestinationSuitability(place);
        const quality = getQualityScore(place);
        const distanceScore = getDistanceScore(straightDistance, maxDistance, time, highway);
        const prefectureScore = getPrefectureScore(place, highway);
        const preRouteScore =
            categoryDetail.score +
            destination.score +
            quality.score +
            distanceScore +
            prefectureScore;

        const candidate = {
            place,
            categoryDetail,
            preRouteScore,
            routeInfo: null,
            timeMatch: null,
            finalScore: null,
            evidence: {
                categoryDetail,
                destination,
                quality,
                straightDistanceKm: Number(straightDistance.toFixed(1)),
                distanceScore,
                prefectureScore
            }
        };

        const existingCandidate = searchContext.candidatePoolByPlaceId.get(place.place_id);
        if (existingCandidate) {
            duplicateCount++;
            candidates.push(existingCandidate);
        } else {
            searchContext.candidatePoolByPlaceId.set(place.place_id, candidate);
            candidates.push(candidate);
        }
    });

    candidates.sort((a, b) => b.preRouteScore - a.preRouteScore);
    return { candidates, duplicateCount };
}

function isOmakasePreference() {
    return !selectedTouringPreference.detail || selectedTouringPreference.detail === "omakase";
}

function selectSingleRecommendedCandidate(candidates) {
    const sorted = [...candidates].sort((a, b) => {
        if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
        return a.timeMatch.differenceMinutes - b.timeMatch.differenceMinutes;
    });
    if (sorted.length === 0) return { selected: null, randomPool: [] };

    if (!isOmakasePreference()) {
        return { selected: sorted[0], randomPool: [] };
    }

    const highestScore = sorted[0].finalScore;
    const randomPool = sorted.filter(candidate => {
        return candidate.evidence.quality.score >= OMAKASE_MIN_QUALITY_SCORE &&
            highestScore - candidate.finalScore <= OMAKASE_SCORE_WINDOW;
    });
    const selectablePool = randomPool.length > 0 ? randomPool : [sorted[0]];
    const selected = selectablePool[Math.floor(Math.random() * selectablePool.length)];
    return { selected, randomPool: selectablePool };
}

function getSingleResultGroup() {
    const groups = {
        food: { name: "🍽グルメ🍜", color: "green" },
        scenery: { name: "🌳自然スポット🍃", color: "orange" },
        tourism: { name: "🔭観光スポット⛩", color: "red" },
        ride: { name: "🌳自然スポット🍃", color: "orange" }
    };
    return groups[selectedTouringPreference.category] || {
        name: "🔭今回のおすすめ🐾",
        color: "red"
    };
}

async function handleSingleResultPool(
    results,
    distance,
    time,
    highway,
    searchAttemptIndex,
    placesMeta,
    searchContext
) {
    const maxDistance = maxDistanceByTime(time, highway);
    const poolResult = buildSingleCandidatePool(
        results,
        time,
        highway,
        maxDistance,
        searchContext
    );
    const routeCheckLimit = selectedIntent === "sea"
        ? SEA_ROUTE_CHECK_CANDIDATES
        : SINGLE_RESULT_ROUTE_CHECK_CANDIDATES;
    const directionsTargets = poolResult.candidates.slice(0, routeCheckLimit);
    const validCandidates = [];

    searchContext.attemptStats.directionsTargets += directionsTargets.length;

    for (const candidate of directionsTargets) {
        const routeInfo = await getRouteInfoWithCache(
            candidate.place,
            highway,
            searchContext
        );
        candidate.routeInfo = routeInfo;
        candidate.timeMatch = routeInfo
            ? evaluateRouteTimeMatch(routeInfo.durationMinutes, time)
            : null;

        if (candidate.timeMatch && !candidate.timeMatch.acceptable) {
            searchContext.outOfRangePlaceIds.add(candidate.place.place_id);
        }

        if (routeInfo && candidate.timeMatch.acceptable) {
            candidate.finalScore =
                candidate.categoryDetail.score +
                candidate.evidence.destination.score +
                candidate.timeMatch.score +
                candidate.evidence.quality.score;
            validCandidates.push(candidate);
        }

        console.log("[どこいこ診断] 候補プール採点", {
            searchAttempt: searchContext.attempt,
            spotName: candidate.place.name || "名称不明",
            placeId: candidate.place.place_id,
            categoryDetailScore: candidate.categoryDetail.score,
            destinationSuitabilityScore: candidate.evidence.destination.score,
            timeMatchScore: candidate.timeMatch ? candidate.timeMatch.score : 0,
            qualityScore: candidate.evidence.quality.score,
            preRouteScore: candidate.preRouteScore,
            durationMinutes: routeInfo ? routeInfo.durationMinutes : null,
            appliedTimeRange: getRouteTimeRange(time),
            withinRange: candidate.timeMatch ? candidate.timeMatch.acceptable : false,
            finalScore: candidate.finalScore,
            evidence: candidate.evidence,
            reason: !routeInfo
                ? "Directions取得失敗で除外"
                : (candidate.timeMatch.acceptable ? "時間レンジ内の最終候補" : "時間レンジ外で除外")
        });
    }

    console.log("[どこいこ診断] 候補プール集計", {
        searchAttempt: searchContext.attempt,
        searchCenter: placesMeta.searchCenter,
        searchRadiusMeters: placesMeta.radius,
        placesCandidateCount: placesMeta.placesCandidateCount,
        intentCandidateCount: placesMeta.intentCandidateCount,
        candidatePoolTotal: searchContext.candidatePoolByPlaceId.size,
        duplicateMergedCount: poolResult.duplicateCount,
        directionsTargetCount: directionsTargets.length,
        directionsCheckedPlaceIdCount: searchContext.checkedPlaceIds.size,
        checkedPlaceIdSkipCount: searchContext.attemptStats.cacheSkips,
        withinTimeRangeCount: validCandidates.length
    });

    if (validCandidates.length === 0 && searchContext.attempt < searchContext.maxAttempts) {
        const previousAttempt = searchContext.attempt;
        searchContext.attempt++;
        searchContext.attemptStats = { directionsTargets: 0, cacheSkips: 0 };
        console.log("[どこいこ診断] 共通再検索", {
            searchAttempt: previousAttempt,
            reason: poolResult.candidates.length === 0
                ? "一次条件を満たす候補が0件"
                : "Directions確認後の時間レンジ内候補が0件",
            nextAttempt: searchContext.attempt,
            maxAttempts: searchContext.maxAttempts
        });
        const geocoder = new google.maps.Geocoder();
        findValidPoint(
            startLat,
            startLng,
            maxDistance,
            geocoder,
            time,
            highway,
            0,
            searchAttemptIndex + 1
        );
        return;
    }

    const resultBox = document.getElementById("result1");
    if (validCandidates.length === 0) {
        if (resultBox) {
            resultBox.innerHTML = "時間に合う候補が見つかりませんでした";
        }
        console.log("[どこいこ診断] 検索終了", {
            searchAttempt: searchContext.attempt,
            candidatePoolTotal: searchContext.candidatePoolByPlaceId.size,
            directionsCheckedPlaceIdCount: searchContext.checkedPlaceIds.size,
            outOfRangePlaceIdCount: searchContext.outOfRangePlaceIds.size,
            result: "結果なし",
            reason: "最大試行回数まで時間レンジ内候補が0件"
        });
        hideLoadingState();
        showResultWithEffect();
        document.getElementById("rerollButton").classList.remove("hidden");
        return;
    }

    const selection = selectSingleRecommendedCandidate(validCandidates);
    const selected = selection.selected;
    selected.photoSelection = selectSpotPhotos(selected.place);
    selected.photos = selected.photoSelection.photos;
    const omakaseMode = isOmakasePreference();
    const adoptionReason = omakaseMode
        ? "最低品質を満たし最高点との差8点以内のおまかせ候補からランダム選出"
        : "時間レンジ内でfinalScoreが最高";

    console.log("[どこいこ診断] おまかせランダム対象", {
        enabled: omakaseMode,
        candidates: selection.randomPool.map(candidate => ({
            name: candidate.place.name,
            placeId: candidate.place.place_id,
            finalScore: candidate.finalScore,
            qualityScore: candidate.evidence.quality.score
        }))
    });
    console.log("[どこいこ診断] 最終候補", {
        searchAttempt: searchContext.attempt,
        spotName: selected.place.name,
        placeId: selected.place.place_id,
        durationMinutes: selected.routeInfo.durationMinutes,
        distanceKm: selected.routeInfo.distanceKm,
        categoryDetailScore: selected.categoryDetail.score,
        destinationSuitabilityScore: selected.evidence.destination.score,
        timeMatchScore: selected.timeMatch.score,
        qualityScore: selected.evidence.quality.score,
        finalScore: selected.finalScore,
        adoptionReason,
        evidence: selected.evidence
    });
    console.log("[どこいこ診断] 最終候補写真", {
        spotName: selected.place.name,
        totalPhotoCount: selected.photoSelection.totalCount,
        adoptedPhotoCount: selected.photoSelection.photos.length,
        adoptedPhotos: selected.photoSelection.photos.map(photo => ({
            width: photo.width,
            height: photo.height,
            attribution: photo.attribution
        })),
        excludedPhotos: selected.photoSelection.excluded,
        fallbackUsed: selected.photoSelection.fallbackUsed,
        fallbackKey: selected.photoSelection.fallbackKey
    });

    if (resultBox) {
        renderSpotResultCard(
            resultBox,
            selected.place,
            getSingleResultGroup(),
            distance,
            time,
            highway,
            0,
            { routeStatus: "success", routeInfo: selected.routeInfo },
            selected.photoSelection
        );
    }

    completedSpotResults = 1;
    hideLoadingState();
    showResultWithEffect();
    document.getElementById("rerollButton").classList.remove("hidden");
}

// ===============================
// 1回検索して、全候補プールからおすすめ1件を選ぶ
// ===============================
async function searchThreeGenres(lat, lng, distance, time, highway, searchAttemptIndex = 0) {
    completedSpotResults = 0;

    const searchContext = activeRouteSearchContext || createRouteSearchContext();
    activeRouteSearchContext = searchContext;

    searchNearbySpotsOnce(
        lat,
        lng,
        distance,
        time,
        highway,
        async function (results, placesMeta) {
            await handleSingleResultPool(
                results || [],
                distance,
                time,
                highway,
                searchAttemptIndex,
                placesMeta,
                searchContext
            );
        },
        searchAttemptIndex > 0 ? 1 : 0,
        searchContext.attempt
    );
}

// ===============================
// 1回検索用
// ===============================
function searchNearbySpotsOnce(
    lat,
    lng,
    distance,
    time,
    highway,
    callback,
    retry = 0,
    searchAttempt = 1
) {
    const service = new google.maps.places.PlacesService(map);

    let radius = Math.max(distance * 1000, SEARCH_RADIUS_MIN);
    if (retry === 1) radius *= 1.8;

    const profile = DETAIL_SEARCH_PROFILES[selectedIntent] || DETAIL_SEARCH_PROFILES.omakase;
    const broadKeywordSets = profile.searchKeywordSets;

    const searchKeyword = broadKeywordSets[Math.min(retry, broadKeywordSets.length - 1)];

    if (profile.id !== "omakase") {
        console.debug("[どこいこ診断] detail検索条件", {
            detailProfile: profile.id,
            category: profile.category,
            detail: profile.detail,
            attempt: retry + 1,
            keyword: searchKeyword,
            radius
        });
    }

    service.nearbySearch(
        {
            location: { lat: lat, lng: lng },
            radius: radius,
            keyword: searchKeyword
        },
        function (results, status) {
            if (
                status !== google.maps.places.PlacesServiceStatus.OK ||
                !results ||
                results.length === 0
            ) {
                if (retry < SEARCH_RETRY_LIMIT) {
                    searchNearbySpotsOnce(
                        lat,
                        lng,
                        distance,
                        time,
                        highway,
                        callback,
                        retry + 1,
                        searchAttempt
                    );
                    return;
                }

                callback([], {
                    searchAttempt,
                    searchCenter: { lat, lng },
                    radius,
                    placesCandidateCount: 0,
                    intentCandidateCount: 0
                });
                return;
            }

            const filtered = results.filter(place => {
                if (!place || !place.geometry || !place.geometry.location) return false;

                const plat = place.geometry.location.lat();
                const plng = place.geometry.location.lng();

                for (let marker of spotMarkers) {
                    if (!marker || !marker.getPosition) continue;
                    const pos = marker.getPosition();
                    const d = calcDistance(plat, plng, pos.lat(), pos.lng());
                    if (d < EXCLUDE_DISTANCE_KM) {
                        return false;
                    }
                }

                return true;
            });

            const distanceFiltered = filtered.length > 0 ? filtered : results;

            // 専用detailは共通の必須条件で絞り、該当0件ならプロファイルの再検索語を試す
            const intentFiltered = filterCandidatesByIntent(distanceFiltered);
            if (intentFiltered.length === 0 && retry < SEARCH_RETRY_LIMIT) {
                searchNearbySpotsOnce(
                    lat,
                    lng,
                    distance,
                    time,
                    highway,
                    callback,
                    retry + 1,
                    searchAttempt
                );
                return;
            }

            callback(intentFiltered, {
                searchAttempt,
                searchCenter: { lat, lng },
                radius,
                placesCandidateCount: results.length,
                intentCandidateCount: intentFiltered.length
            });
        }
    );
}

// ===============================
// ジャンルごとの候補点数計算
// ===============================
// GoogleマップURL生成
// ===============================
function buildGoogleMapsUrl(spot, highway) {
    const hasConfirmedStartPosition = Number.isFinite(startLat) && Number.isFinite(startLng);
    const origin = hasConfirmedStartPosition
        ? `${startLat},${startLng}`
        : startAddressGlobal;
    let url =
        `https://www.google.com/maps/dir/?api=1` +
        `&origin=${encodeURIComponent(origin)}` +
        `&destination=${encodeURIComponent(spot.name)}` +
        `&destination_place_id=${spot.place_id}` +
        `&travelmode=driving`;

    if (highway !== "yes") {
        url += `&avoid=highways`;
    }

    return url;
}

// ===============================
// 地図のわんこピン詳細
// ===============================
function scrollToSpotResultCard(index) {
    const card = document.getElementById(`result${index + 1}`);
    if (!card) return;

    card.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    card.classList.add("result-card-highlight");

    setTimeout(() => {
        card.classList.remove("result-card-highlight");
    }, 1200);
}

// ===============================
// 結果カード描画
// ===============================
function renderSpotResultCard(
    box,
    spot,
    group,
    distance,
    time,
    highway,
    index,
    routeState,
    photoSelection = null
) {
    const genreName = group.name;
    const keyword = pickBestKeywordLabel(spot, group);
    const rating = spot.rating || "評価なし";
    const reviews = spot.user_ratings_total || 0;
    const selectedPhotos = photoSelection || selectSpotPhotos(spot);
    const photoUrl = selectedPhotos.photos[0] ? selectedPhotos.photos[0].url : "";
    const typeLabel = formatSpotTypes(spot.types || [], genreName, keyword);
    const catchCopy = buildSpotCatchCopy(spot, genreName, keyword);

    const mapUrl = buildGoogleMapsUrl(spot, highway);

    
    let dogImage = "image/yellow_dog.png";
    if (genreName.includes("グルメ")) dogImage = "image/red_dog.png";
    if (genreName.includes("自然")) dogImage = "image/green_dog.png";

    const slat = spot.geometry.location.lat();
    const slng = spot.geometry.location.lng();

    const infoRatingText = spot.rating ? `⭐${spot.rating}` : "評価なし";

    const marker = new google.maps.Marker({
        position: { lat: slat, lng: slng },
        map: map,
        icon: {
            url: dogImage,
            scaledSize: new google.maps.Size(50, 50)
        },
        title: spot.name
    });

    const infoWindow = new google.maps.InfoWindow({
        content: `
        <div class="dog-pin-info">
            <div class="dog-pin-info-title">${spot.name}</div>
            <div class="dog-pin-info-rating">${infoRatingText}</div>
            <button type="button" class="dog-pin-info-button" onclick="scrollToSpotResultCard(${index})">
                詳細を見る
            </button>
        </div>
    `
    });

    marker.addListener("click", () => {
        if (currentInfoWindow) {
            currentInfoWindow.close();
        }

        infoWindow.open(map, marker);
        currentInfoWindow = infoWindow;
    });

    spotMarkers.push(marker);

    const bounds = new google.maps.LatLngBounds();

    if (startMarker && startMarker.getPosition) {
        bounds.extend(startMarker.getPosition());
    }

    spotMarkers.forEach(m => {
        if (m && m.getPosition) {
            bounds.extend(m.getPosition());
        }
    });

    map.fitBounds(bounds);

    const confirmedRouteState = routeState || { routeStatus: "failed", routeInfo: null };
    const routeInfo = confirmedRouteState.routeInfo;
    const routeSucceeded = confirmedRouteState.routeStatus === "success" && routeInfo;
    const straightDistanceKm = calcDistance(startLat, startLng, slat, slng);
    const displayDistanceKm = routeSucceeded ? routeInfo.distanceKm : null;
    const displayDistanceText = routeSucceeded ? routeInfo.distanceText : "";
    const displayDurationText = routeSucceeded
        ? routeInfo.durationText
        : "ルート情報を取得できませんでした";
    const routeDistanceHtml = routeSucceeded
        ? `🚗 ${displayDistanceText}<br>`
        : `📏 参考：直線距離 約${straightDistanceKm.toFixed(1)}km<br>`;

    saveSpotHistoryItem({
        pageType: "spot",
        genreName: genreName,
        keyword: keyword,
        name: spot.name,
        address: spot.vicinity || "",
        rating: rating,
        reviews: reviews,
        distanceKm: displayDistanceKm,
        distanceText: displayDistanceText,
        durationText: displayDurationText,
        routeStatus: confirmedRouteState.routeStatus,
        straightDistanceKm: Number(straightDistanceKm.toFixed(1)),
        time: time,
        highway: highway,
        placeId: spot.place_id,
        mapUrl: mapUrl,
        photoUrl: photoUrl,
        photos: selectedPhotos.photos.map(photo => ({
            url: photo.url,
            width: photo.width,
            height: photo.height,
            attribution: photo.attribution
        })),
        photoFallbackKey: selectedPhotos.fallbackKey,
        catchCopy: catchCopy
    });

    box.dataset.mapUrl = mapUrl; // ナビ専用
box.dataset.spotName = spot.name || "";
box.dataset.placeId = spot.place_id || "";
box.dataset.spotAddress = spot.vicinity || "";

    box.innerHTML = `
<div class="genre">
    <img src="${dogImage}" class="genre-dog">
    ${genreName}
</div>

${buildRecommendationGallery(
    selectedPhotos.photos,
    selectedPhotos.fallbackKey,
    { showPreviewLabel: false }
)}

<div class="spot-name">${spot.name}</div>

<div class="spot-copy">${catchCopy}</div>

📍 ${spot.vicinity || "住所情報なし"}<br>

⭐ ${rating} (${reviews}件)<br>

🏷 ${typeLabel}<br>

🎯ジャンル：${keyword}<br><br>

${routeDistanceHtml}

⏱ ${displayDurationText}<br>

🛣 ${time === 30 ? "下道のみ" : (highway === "yes" ? "高速あり" : "下道のみ")}<br><br>

<div class="result-actions">
    <a href="${mapUrl}" target="_blank" rel="noopener noreferrer">
        🧭 Googleマップでナビ
    </a>

    <button type="button" class="share-button" onclick="shareSpotResult(${index})">
        共有する
    </button>
</div>
`;
}

// ===============================
// 表示用キーワード決定
// ===============================
function pickBestKeywordLabel(spot, group) {
    const name = spot.name || "";
    const vicinity = spot.vicinity || "";
    const types = Array.isArray(spot.types) ? spot.types.join(" ") : "";
    const text = `${name} ${vicinity} ${types}`;

    if (group.name.includes("観光")) {
        if (/道の駅/i.test(text)) return "道の駅";
        if (/展望台|絶景|景勝地/i.test(text)) return "絶景";
        if (/神社/i.test(text)) return "神社";
        if (/寺/i.test(text)) return "寺";
        if (/博物館|museum/i.test(text)) return "博物館";
        return "観光";
    }

    if (group.name.includes("グルメ")) {
        if (/ラーメン/i.test(text)) return "ラーメン";
        if (/カフェ|cafe/i.test(text)) return "カフェ";
        if (/食堂/i.test(text)) return "食堂";
        if (/restaurant/i.test(text)) return "レストラン";
        return "グルメ";
    }

    if (group.name.includes("自然")) {
        if (/滝/i.test(text)) return "滝";
        if (/湖|沼/i.test(text)) return "湖";
        if (/渓谷/i.test(text)) return "渓谷";
        if (/ダム/i.test(text)) return "ダム";
        if (/高原/i.test(text)) return "高原";
        if (/公園|park/i.test(text)) return "公園";
        return "自然";
    }

    return "スポット";
}

// ===============================
// 描画完了カウント
// ===============================
function handleSpotResultRendered() {
    completedSpotResults++;

    if (completedSpotResults === 1) {
        hideLoadingState();
        showResultWithEffect();
    }
}

// ===============================
function showResultWithEffect() {
    const box = document.getElementById("results");

    box.classList.remove("hidden");
    box.classList.remove("show");

    void box.offsetWidth;

    box.classList.add("show");
    launchConfetti();
}

// ===============================
// 新しい1件表示カードのプレビュー
// 既存検索結果は変更せず、ダミーデータでUIだけ確認できるようにする
// ===============================
const SPOT_RESULT_PREVIEW_DATA = {
    name: "城ヶ島公園（表示サンプル）",
    address: "神奈川県三浦市三崎町城ヶ島",
    distanceText: "約68.4km",
    durationText: "約1時間35分",
    routePreference: "高速・有料道路を利用",
    intentId: "sea",
    photos: [
        {
            url: "image/spot-result-preview-coast.png",
            alt: "海岸線へ続くワインディングロード",
            credit: "画像：どこいこMap 表示サンプル"
        },
        {
            url: "image/spot-result-preview-lookout.png",
            alt: "青い海と岬を見渡す展望スペース",
            credit: "画像：どこいこMap 表示サンプル"
        },
        {
            url: "image/spot-result-preview-path.png",
            alt: "海と岬を眺めながら歩ける海岸沿いの小道",
            credit: "画像：どこいこMap 表示サンプル"
        }
    ],
    mapUrl: "https://www.google.com/maps/dir/?api=1&destination=%E5%9F%8E%E3%83%B6%E5%B3%B6%E5%85%AC%E5%9C%92"
};

function escapeGalleryText(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function buildRecommendationGallery(photos = [], intentId = "omakase", options = {}) {
    const showPreviewLabel = options.showPreviewLabel !== false;
    const visiblePhotos = photos.filter(photo => photo && photo.url).slice(0, 3);
    if (visiblePhotos.length === 0) {
        visiblePhotos.push({
            url: getRecommendationPhotoFallback(intentId),
            alt: "スポット写真の代替画像",
            credit: ""
        });
    }

    const mainPhoto = visiblePhotos[0];
    const subPhotos = visiblePhotos.slice(1);
    const thumbnailHtml = subPhotos.map((photo, index) => `
        <button
            type="button"
            class="recommendation-thumbnail"
            onclick="swapRecommendationPhoto(this)"
            aria-label="${escapeGalleryText(photo.alt || `サブ写真${index + 1}`)}をメイン写真に表示"
            data-credit="${escapeGalleryText(photo.credit || photo.attribution || "")}">
            <img
                src="${photo.url}"
                alt="${escapeGalleryText(photo.alt || `サブ写真${index + 1}`)}"
                data-intent-id="${intentId}"
                loading="lazy"
                onerror="handleRecommendationImageError(this)">
        </button>
    `).join("");

    return `
        <div class="recommendation-gallery" data-intent-id="${intentId}">
            <figure class="spot-photo-wrap recommendation-photo-wrap is-selected">
                <img
                    src="${mainPhoto.url}"
                    alt="${escapeGalleryText(mainPhoto.alt || "スポットのメイン写真")}"
                    class="spot-photo recommendation-photo"
                    data-intent-id="${intentId}"
                    loading="lazy"
                    onerror="handleRecommendationImageError(this)">
                <figcaption class="recommendation-photo-meta">
                    <span class="recommendation-photo-credit" ${(mainPhoto.credit || mainPhoto.attribution) ? "" : "hidden"}>${escapeGalleryText(mainPhoto.credit || mainPhoto.attribution || "")}</span>
                    ${showPreviewLabel ? `<span class="recommendation-preview-label">表示サンプル</span>` : ""}
                </figcaption>
            </figure>
            ${subPhotos.length > 0 ? `
                <div class="recommendation-thumbnails thumbnail-count-${subPhotos.length}" aria-label="スポット写真ギャラリー">
                    ${thumbnailHtml}
                </div>
            ` : ""}
        </div>
    `;
}

function getRecommendationPhotoFallback(intentId) {
    const fallbackByIntent = {
        sea: "image/spot-result-preview-coast.png",
        nature: "image/spot-result-preview-lookout.png",
        onsen: "image/red_dog.png",
        food: "image/red_dog.png",
        ride: "image/green_dog.png",
        tourism: "image/yellow_dog.png",
        omakase: "image/dog.png"
    };
    return fallbackByIntent[intentId] || fallbackByIntent.omakase;
}

function handleRecommendationImageError(image) {
    if (!image || image.dataset.fallbackApplied === "true") return;
    image.dataset.fallbackApplied = "true";
    image.src = getRecommendationPhotoFallback(image.dataset.intentId || "omakase");
    image.alt = "写真を読み込めなかったため表示しているジャンル別の代替画像";
}

function swapRecommendationPhoto(thumbnailButton) {
    const gallery = thumbnailButton && thumbnailButton.closest(".recommendation-gallery");
    if (!gallery) return;

    const mainImage = gallery.querySelector(".recommendation-photo");
    const thumbnailImage = thumbnailButton.querySelector("img");
    const creditBox = gallery.querySelector(".recommendation-photo-credit");
    if (!mainImage || !thumbnailImage || !creditBox) return;

    const previousMain = {
        src: mainImage.src,
        alt: mainImage.alt,
        credit: creditBox.textContent || ""
    };
    const nextMain = {
        src: thumbnailImage.src,
        alt: thumbnailImage.alt,
        credit: thumbnailButton.dataset.credit || ""
    };

    mainImage.classList.add("is-fading");

    setTimeout(() => {
        mainImage.src = nextMain.src;
        mainImage.alt = nextMain.alt;
        mainImage.dataset.fallbackApplied = thumbnailImage.dataset.fallbackApplied || "false";

        thumbnailImage.src = previousMain.src;
        thumbnailImage.alt = previousMain.alt;
        thumbnailImage.dataset.fallbackApplied = "false";
        thumbnailButton.dataset.credit = previousMain.credit;
        thumbnailButton.setAttribute("aria-label", `${previousMain.alt}をメイン写真に表示`);

        creditBox.textContent = nextMain.credit;
        creditBox.hidden = !nextMain.credit;

        mainImage.classList.remove("is-fading");
        thumbnailButton.classList.add("was-selected");
        setTimeout(() => thumbnailButton.classList.remove("was-selected"), 350);
    }, 120);
}

function showSpotResultCardPreview() {
    const resultsBox = document.getElementById("results");
    if (!resultsBox) return;

    clearResults();

    const data = SPOT_RESULT_PREVIEW_DATA;
    resultsBox.classList.remove("hidden", "loading");
    resultsBox.classList.add("show", "recommendation-preview");
    resultsBox.innerHTML = `
        <article class="result-item recommendation-card" aria-labelledby="previewSpotName">
            <header class="recommendation-card-header">
                <div>
                    <p class="recommendation-eyebrow">今回のおすすめ</p>
                    <p class="recommendation-lead">次の行き先候補、見つけたワン！</p>
                </div>
                <img src="image/dog.png" alt="" class="recommendation-dog" aria-hidden="true">
            </header>

            ${buildRecommendationGallery(data.photos, data.intentId)}

            <div class="recommendation-content">
                <span class="recommendation-genre">海を見に行きたい</span>
                <h2 class="spot-name recommendation-name" id="previewSpotName">${data.name}</h2>
                <p class="recommendation-address">📍 ${data.address}</p>

                <dl class="recommendation-route-summary">
                    <div>
                        <dt>片道時間</dt>
                        <dd>${data.durationText}</dd>
                    </div>
                    <div>
                        <dt>道のり</dt>
                        <dd>${data.distanceText}</dd>
                    </div>
                    <div>
                        <dt>ルート</dt>
                        <dd>${data.routePreference}</dd>
                    </div>
                </dl>

                <section class="recommendation-reason" aria-labelledby="previewReasonTitle">
                    <div class="recommendation-section-heading">
                        <img src="image/dog.png" alt="" aria-hidden="true">
                        <h3 id="previewReasonTitle">この場所を選んだ理由</h3>
                    </div>
                    <p>海岸らしい景色をしっかり楽しめて、希望の片道時間にも近い場所だよ。海へ向かって走る時間まで楽しめそうだから、自信を持っておすすめするワン！</p>
                </section>

                <section class="recommendation-points" aria-labelledby="previewPointsTitle">
                    <h3 id="previewPointsTitle">わんこの見立て</h3>
                    <ul>
                        <li><span>景色を楽しめそう</span><span class="recommendation-stars" aria-label="5点満点中5点"><span aria-hidden="true">★★★★★</span></span></li>
                        <li><span>ツーリング気分</span><span class="recommendation-stars" aria-label="5点満点中5点"><span aria-hidden="true">★★★★★</span></span></li>
                        <li><span>のんびりできそう</span><span class="recommendation-stars" aria-label="5点満点中4点"><span aria-hidden="true">★★★★</span><span class="star-empty" aria-hidden="true">★</span></span></li>
                    </ul>
                </section>

                <aside class="recommendation-season-tip">
                    <span class="recommendation-tip-label">秋のワンポイント</span>
                    <p>海沿いは風を感じやすいから、防風できる一枚を用意しておくと安心だよ。</p>
                </aside>

                <p class="recommendation-closing">次のツーリング候補に、ここはかなりいいと思うワン！</p>

                <div class="result-actions recommendation-actions">
                    <a href="${data.mapUrl}" target="_blank" rel="noopener noreferrer" class="recommendation-route-button">
                        この場所へのルートを見てみる
                    </a>
                    <button type="button" class="recommendation-retry-button" onclick="closeSpotResultCardPreview()">
                        もう一度探す
                    </button>
                </div>
            </div>
        </article>
    `;

    resultsBox.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeSpotResultCardPreview() {
    clearResults();
    const intentField = document.querySelector(".intent-field");
    if (intentField) {
        intentField.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

// ===============================
function launchConfetti() {
    const colors = ["#ff7675", "#74b9ff", "#55efc4", "#ffeaa7", "#a29bfe"];

    for (let i = 0; i < 40; i++) {
        const confetti = document.createElement("div");

        confetti.classList.add("confetti");
        confetti.style.left = Math.random() * 100 + "vw";
        confetti.style.backgroundColor =
            colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration =
            2 + Math.random() * 2 + "s";

        document.body.appendChild(confetti);

        setTimeout(() => {
            confetti.remove();
        }, 4000);
    }
}

function rerollSpot() {
    if (!startLat || !startLng) {
        alert("先に検索してね！");
        return;
    }

    const time = Number(document.getElementById("timeSelect").value);
    const highway = document.getElementById("highway").value;
    selectedTouringPreference = getSelectedTouringPreference();
    selectedIntent = resolveSearchIntent(selectedTouringPreference);
    console.log("どこいこMap Ver2 再検索モード:", selectedIntent);
    activeRouteSearchContext = createRouteSearchContext();

    const geocoder = new google.maps.Geocoder();
    const maxDistance = maxDistanceByTime(time, highway);

    clearResults();
    showLoadingState("検索中...", "わんこが目的地を探してるよ");

    findValidPoint(startLat, startLng, maxDistance, geocoder, time, highway);
}

function getCurrentLocation() {
    if (!navigator.geolocation) {
        alert("このブラウザでは位置情報が使えません");
        return;
    }

    navigator.geolocation.getCurrentPosition(function (position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        const geocoder = new google.maps.Geocoder();

        geocoder.geocode(
            { location: { lat: lat, lng: lng } },
            function (results, status) {
                if (status === "OK" && results[0]) {
                    const address = results[0].formatted_address;
                    document.getElementById("startLocation").value = address;
                } else {
                    alert("住所を取得できませんでした");
                }
            }
        );
    }, function () {
        alert("現在地を取得できませんでした");
    });
}

// ===============================
// 高速制御
// ===============================
function updateHighwayControl() {
    const time = document.getElementById("timeSelect").value;
    const highwaySelect = document.getElementById("highway");

    if (time === "30") {
        highwaySelect.value = "no";
        highwaySelect.disabled = true;
    } else {
        highwaySelect.disabled = false;
    }
}

// ページ読み込み後にイベント登録
window.addEventListener("DOMContentLoaded", function () {
    const timeSelect = document.getElementById("timeSelect");

    initializeTouringPreferenceUI();

    timeSelect.addEventListener(
        "change",
        updateHighwayControl
    );

    updateHighwayControl();
});

// ===============================
// 検索中わんこ
// ===============================
function showLoadingState(message = "検索中...", subMessage = "わんこが頑張って目的地を探してるよ") {
    const resultsBox = document.getElementById("results");
    if (!resultsBox) return;

    resultsBox.classList.remove("hidden");
    resultsBox.classList.add("show");
    resultsBox.classList.add("loading");

    resultsBox.innerHTML = `
        <div id="loadingBox" class="loading-box">
            <div class="loading-dog">
                <img src="image/dog.png" alt="検索中" class="loading-dog-image">
            </div>
            <div class="loading-text" id="loadingText">${message}</div>
            <div class="loading-subtext">${subMessage}</div>
        </div>

        <div id="result1" class="result-item"></div>
    `;

    const texts = ["検索中...", "検索中 .", "検索中 ..", "検索中 ..."];
    let i = 0;

    if (loadingTimer) {
        clearInterval(loadingTimer);
    }

    loadingTimer = setInterval(() => {
        const el = document.getElementById("loadingText");
        if (!el) return;
        el.textContent = texts[i % texts.length];
        i++;
    }, 350);
}

function hideLoadingState() {
    if (loadingTimer) {
        clearInterval(loadingTimer);
        loadingTimer = null;
    }

    const resultsBox = document.getElementById("results");
    if (!resultsBox) return;

    resultsBox.classList.remove("loading");

    const loadingBox = document.getElementById("loadingBox");
    if (loadingBox) {
        loadingBox.remove();
    }
}
