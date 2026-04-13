let map;
let startMarker;
let startLat;
let startLng;
let spotMarkers = [];
let startAddressGlobal = "";
let loadingTimer = null;

const HIGHWAY_SPEED = 80;
const LOCAL_SPEED = 40;

const TOKYO_STATION_POSITION = {
  center: { lat: 35.681236, lng: 139.767125 },
  zoom: 12,
  gestureHandling: "greedy"
};

const EXCLUDE_DISTANCE_KM = 1.2;
let usedPlaceIds = new Set();
const CANDIDATE_POINT_COUNT = 12;

// ===============================
// 検索タイプ定義
// ===============================
const ROAD_TYPES = [
  {
    key: "relaxed",
    label: "🌿 のんびり道",
    iconEmoji: "🌿",
    keywords: "農道 田園 郊外 ドライブ ロード 景色 川 湖 公園 一本道 広域農道",
    regex: /農道|田園|郊外|広域農道|ロード|景色|川|湖|公園|一本道|田舎/i
  },
  {
    key: "scenic",
    label: "🌅 景色道",
    iconEmoji: "🌅",
    keywords: "海沿い 海岸 展望台 パノラマ 高原 スカイライン 景色 風景 岬 湖",
    regex: /海沿い|海岸|展望台|パノラマ|高原|スカイライン|景色|風景|岬|湖|展望/i
  },
  {
    key: "mild_curve",
    label: "🏍 緩いカーブ道",
    iconEmoji: "🏍",
    keywords: "峠 山道 スカイライン 高原 ワインディング 展望台 ドライブ ロード",
    regex: /峠|山道|スカイライン|高原|ワインディング|展望台|ライン|ロード/i
  }
];

const COMMON_FALLBACK_KEYWORDS =
  "ドライブ ロード 景色 展望 公園 高原 海 湖 農道 郊外 山道 スカイライン 一本道 道の駅 パノラマ";

// ===============================
// Google Map 初期表示
// ===============================
function initMap() {
  ensureLoadingStyle();

  map = new google.maps.Map(
    document.getElementById("map"),
    TOKYO_STATION_POSITION
  );
}

// ===============================
// 検索開始
// ===============================
function searchGoodRoad() {
  const startAddress = document.getElementById("startLocation").value.trim();
  startAddressGlobal = startAddress;

  if (!startAddress) {
    alert("出発地を入力してね！");
    return;
  }

  const time = Number(document.getElementById("timeSelect").value);
  const highway = document.getElementById("highway").value;

  clearResults();
  showLoadingState();

  const geocoder = new google.maps.Geocoder();

  geocoder.geocode({ address: startAddress }, function (results, status) {
    if (status !== "OK" || !results[0]) {
      hideLoadingState();
      alert("出発地を取得できませんでした");
      return;
    }

    startLat = results[0].geometry.location.lat();
    startLng = results[0].geometry.location.lng();

    const startPos = { lat: startLat, lng: startLng };

    map.setCenter(startPos);
    map.setZoom(13);

    if (startMarker) startMarker.setMap(null);

    startMarker = new google.maps.Marker({
      position: startPos,
      map: map,
      title: "出発地",
      icon: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
    });

    findBestGoodRoadPoint(time, highway, function (bestPoint) {
      if (!bestPoint) {
        hideLoadingState();
        alert("候補を見つけにくかったので、もう一度試してみてね！");
        return;
      }

      searchThreeGoodRoad(
        bestPoint.lat,
        bestPoint.lng,
        bestPoint.distanceKm,
        time,
        highway
      );
    });
  });
}

// ===============================
// 結果クリア
// ===============================
function clearResults() {
  const resultsBox = document.getElementById("results");
  resultsBox.classList.remove("show");

  resultsBox.innerHTML = `
    <div id="result1" class="result-item"></div>
    <div id="result2" class="result-item"></div>
    <div id="result3" class="result-item"></div>
  `;

  spotMarkers.forEach(marker => marker.setMap(null));
  spotMarkers = [];
  usedPlaceIds.clear();

  const rerollButton = document.getElementById("rerollButton");
  if (rerollButton) {
    rerollButton.classList.add("hidden");
  }
}

// ===============================
// ローディング表示
// ===============================
function ensureLoadingStyle() {
  if (document.getElementById("goodroad-loading-style")) return;

  const style = document.createElement("style");
  style.id = "goodroad-loading-style";
  style.textContent = `
    .loading-box {
      text-align: center;
      padding: 24px 16px;
      border-radius: 16px;
      background: rgba(228, 249, 251, 0.75);
      margin-top: 16px;
    }

    .loading-dog {
      font-size: 42px;
      display: inline-block;
      animation: dogBounce 0.9s ease-in-out infinite;
      margin-bottom: 10px;
    }

    .loading-text {
      font-weight: bold;
      font-size: 18px;
      margin-bottom: 8px;
      color: #19a7b8;
    }

    .loading-subtext {
      font-size: 13px;
      opacity: 0.9;
      color: #226b74;
    }

    .fallback-note {
      margin: 8px 0 12px;
      font-size: 0.85rem;
      line-height: 1.5;
      color: #3b7981;
    }

    .spot-photo-wrap {
      margin: 12px 0;
      border-radius: 16px;
      overflow: hidden;
    }

    .spot-photo {
      display: block;
      width: 100%;
      height: auto;
      aspect-ratio: 16 / 10;
      object-fit: cover;
    }

    .spot-copy {
      margin: 10px 0 14px;
      line-height: 1.6;
      font-size: 0.95rem;
    }

    .result-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .share-button {
      border: none;
      border-radius: 999px;
      padding: 10px 14px;
      font-size: 0.95rem;
      cursor: pointer;
    }

    @keyframes dogBounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
  `;
  document.head.appendChild(style);
}

function showLoadingState() {
  const resultsBox = document.getElementById("results");
  resultsBox.classList.add("show");
  resultsBox.innerHTML = `
    <div class="loading-box">
      <div class="loading-dog">
        <img src="../image/dog.png" alt="検索中" class="loading-dog-image">
      </div>
      <div class="loading-text" id="loadingText">検索中...</div>
      <div class="loading-subtext">気持ちよく走れそうな道を探してるよ</div>
    </div>
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
  resultsBox.innerHTML = `
    <div id="result1" class="result-item"></div>
    <div id="result2" class="result-item"></div>
    <div id="result3" class="result-item"></div>
  `;
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
function formatGoodRoadTypes(types = [], roadType) {
  const typeMap = {
    tourist_attraction: "立ち寄りスポット",
    park: "公園",
    point_of_interest: "スポット",
    scenic_lookout: "展望スポット",
    campground: "キャンプ場",
    natural_feature: "自然スポット",
    museum: "観光スポット"
  };

  const labels = types
    .map(type => typeMap[type])
    .filter(Boolean);

  if (labels.length > 0) {
    return [...new Set(labels)].slice(0, 2).join("・");
  }

  if (roadType && roadType.key === "relaxed") return "のんびり走りやすい道";
  if (roadType && roadType.key === "scenic") return "景色を楽しみやすい道";
  if (roadType && roadType.key === "mild_curve") return "緩いカーブを楽しみやすい道";

  return "気持ちよく走れそうな道";
}

// ===============================
// 軽い説明文
// ===============================
function buildGoodRoadCatchCopy(spot, roadType) {
  const rating = Number(spot.rating || 0);
  const reviews = Number(spot.user_ratings_total || 0);

  if (roadType.key === "relaxed") {
    if (rating >= 4.2 && reviews >= 100) {
      return "のんびり景色を楽しみながら走りたい日に向いていそうです。";
    }
    return "混みすぎない雰囲気で、落ち着いて走りたい日に合いそうです。";
  }

  if (roadType.key === "scenic") {
    if (rating >= 4.2) {
      return "景色を楽しみながら走りたい日に立ち寄りたくなる候補です。";
    }
    return "景色重視で気分転換したいときに良さそうな候補です。";
  }

  if (rating >= 4.2 && reviews >= 100) {
    return "緩いカーブや道の雰囲気を楽しみやすい人気候補です。";
  }

  return "走ること自体も楽しみたい日に向いていそうな候補です。";
}

// ===============================
// 履歴保存
// ===============================
function saveGoodRoadHistoryItem(data) {
  const key = "dokoiko_goodroad_history";
  const current = JSON.parse(localStorage.getItem(key) || "[]");

  const filtered = current.filter(item => item.placeId !== data.placeId);

  filtered.unshift({
    savedAt: new Date().toISOString(),
    ...data
  });

  const trimmed = filtered.slice(0, 8);
  localStorage.setItem(key, JSON.stringify(trimmed));
}

// ===============================
// 共有
// ===============================
function shareGoodRoadResult(index) {
  const card = document.getElementById(`result${index + 1}`);
  if (!card) return;

  const shareUrl = card.dataset.mapUrl || location.href;
  const shareText = card.dataset.shareText || "どこいこMapで気持ちよく走れそうな道を見つけたよ！";

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

  window.open(xUrl, "_blank");
}

// ===============================
// ランダム座標生成
// ===============================
function createRandomPoint(lat, lng, maxDistanceKm, minDistanceKm = 0) {
  const radiusKm =
    minDistanceKm + Math.random() * Math.max(maxDistanceKm - minDistanceKm, 0.5);

  const radiusInDegrees = radiusKm / 111;
  const u = Math.random();
  const v = Math.random();
  const w = radiusInDegrees * Math.sqrt(u);
  const t = 2 * Math.PI * v;

  const newLat = lat + w * Math.cos(t);
  const newLng = lng + (w * Math.sin(t)) / Math.cos((lat * Math.PI) / 180);

  return { lat: newLat, lng: newLng, distanceKm: radiusKm };
}

// ===============================
// 最大距離計算
// ===============================
function maxDistanceByTime(time, highway) {
  const hours = time / 60;
  const speed = highway === "yes" ? HIGHWAY_SPEED : LOCAL_SPEED;
  return hours * speed;
}

// ===============================
// 時間ごとの雰囲気
// ===============================
function getTimeProfile(time) {
  if (time <= 30) {
    return {
      candidateMinDistance: 6,
      candidateMaxRatio: 0.55,
      typeOrder: ["relaxed", "scenic", "mild_curve"]
    };
  }

  if (time <= 60) {
    return {
      candidateMinDistance: 12,
      candidateMaxRatio: 0.75,
      typeOrder: ["relaxed", "mild_curve", "scenic"]
    };
  }

  if (time <= 90) {
    return {
      candidateMinDistance: 18,
      candidateMaxRatio: 0.85,
      typeOrder: ["mild_curve", "scenic", "relaxed"]
    };
  }

  return {
    candidateMinDistance: 25,
    candidateMaxRatio: 1.0,
    typeOrder: ["scenic", "mild_curve", "relaxed"]
  };
}

function getRoadTypeByIndex(index, time) {
  const profile = getTimeProfile(time);
  const key = profile.typeOrder[index] || "relaxed";
  return ROAD_TYPES.find(type => type.key === key) || ROAD_TYPES[0];
}

function getRoadTypeByKey(key) {
  return ROAD_TYPES.find(type => type.key === key) || ROAD_TYPES[0];
}

function getSelectedRoadTypeKey() {
  const el = document.getElementById("roadType");
  return el ? el.value : null;
}

function buildFallbackTypeOrder(selectedKey, time, slotIndex) {
  const profile = getTimeProfile(time);
  const baseOrder = [...profile.typeOrder];

  if (selectedKey && !baseOrder.includes(selectedKey)) {
    baseOrder.unshift(selectedKey);
  }

  const rotated = [];
  if (selectedKey) {
    rotated.push(selectedKey);
  } else {
    rotated.push(baseOrder[slotIndex] || baseOrder[0]);
  }

  baseOrder.forEach(key => {
    if (!rotated.includes(key)) rotated.push(key);
  });

  return rotated.map(getRoadTypeByKey);
}

// ===============================
// 距離計算
// ===============================
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * Math.PI / 180;
}

function calcBearing(lat1, lng1, lat2, lng2) {
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));

  return Math.atan2(y, x) * 180 / Math.PI;
}

function normalizeAngle(angle) {
  let a = angle;
  while (a > 180) a -= 360;
  while (a < -180) a += 360;
  return Math.abs(a);
}

// ===============================
// ルート評価
// ===============================
function scoreRouteComfort(route) {
  if (!route || !route.overview_path || route.overview_path.length < 3) {
    return 1;
  }

  const path = route.overview_path;
  let mildTurnCount = 0;
  let sharpTurnCount = 0;
  let totalAngleChange = 0;

  for (let i = 1; i < path.length - 1; i++) {
    const p1 = path[i - 1];
    const p2 = path[i];
    const p3 = path[i + 1];

    const b1 = calcBearing(p1.lat(), p1.lng(), p2.lat(), p2.lng());
    const b2 = calcBearing(p2.lat(), p2.lng(), p3.lat(), p3.lng());
    const diff = normalizeAngle(b2 - b1);

    if (diff > 12 && diff <= 45) mildTurnCount++;
    if (diff > 45) sharpTurnCount++;
    totalAngleChange += diff;
  }

  const leg = route.legs && route.legs[0];
  const distanceKm = leg ? leg.distance.value / 1000 : 1;
  const durationMin = leg ? leg.duration.value / 60 : 1;

  const mildDensity = mildTurnCount / Math.max(distanceKm, 1);
  const sharpDensity = sharpTurnCount / Math.max(distanceKm, 1);
  const speedFactor = distanceKm / Math.max(durationMin, 1);

  return (
    mildDensity * 18 +
    speedFactor * 25 -
    sharpDensity * 20 +
    totalAngleChange * 0.01
  );
}

function getRouteToCandidate(origin, destination, highway, callback) {
  try {
    const directionsService = new google.maps.DirectionsService();

    directionsService.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: highway === "no",
        optimizeWaypoints: false
      },
      function (result, status) {
        if (status !== "OK" || !result.routes || !result.routes[0]) {
          callback({ route: null, score: 1 });
          return;
        }

        const route = result.routes[0];
        const score = scoreRouteComfort(route);
        callback({ route, score });
      }
    );
  } catch (error) {
    callback({ route: null, score: 1 });
  }
}

// ===============================
// 候補中心点の品質判定
// ===============================
function analyzeAreaPreference(results) {
  const addressText =
    (results[0] && results[0].formatted_address ? results[0].formatted_address : "") +
    " " +
    (results[0] && results[0].address_components
      ? results[0].address_components.map(c => c.long_name).join(" ")
      : "");

  let score = 0;

  if (/東京都千代田区|東京都中央区|東京都港区|東京都新宿区|東京都渋谷区|東京都豊島区|東京都台東区|東京都品川区|東京都目黒区|東京都文京区|東京都墨田区|東京都江東区/i.test(addressText)) {
    score -= 4;
  }

  if (/八王子|青梅|あきる野|日の出|檜原|奥多摩|秩父|飯能|君津|富津|館山|いすみ|鴨川|南房総|御宿|勝浦|銚子|鹿嶋|神栖|大洗|那須|日光|伊豆|箱根|富士|山中湖|河口湖|軽井沢|蓼科|清里/i.test(addressText)) {
    score += 4;
  }

  if (/郊外|高原|山|湖|海|岬|渓谷|農|田|原|自然|公園|丘/i.test(addressText)) {
    score += 2;
  }

  if (/駅|駅前|銀座|新宿|渋谷|池袋|上野|秋葉原|六本木|繁華街|都心/i.test(addressText)) {
    score -= 3;
  }

  return score;
}

function findBestGoodRoadPoint(time, highway, callback) {
  const maxDistance = maxDistanceByTime(time, highway);
  const geocoder = new google.maps.Geocoder();
  const profile = getTimeProfile(time);

  let checked = 0;
  let bestCandidate = null;

  for (let i = 0; i < CANDIDATE_POINT_COUNT; i++) {
    const point = createRandomPoint(
      startLat,
      startLng,
      maxDistance * profile.candidateMaxRatio,
      profile.candidateMinDistance
    );

    geocoder.geocode(
      { location: { lat: point.lat, lng: point.lng } },
      function (results, status) {
        if (status === "OK" && results[0]) {
          const areaScore = analyzeAreaPreference(results);

          getRouteToCandidate(
            { lat: startLat, lng: startLng },
            { lat: point.lat, lng: point.lng },
            highway,
            function (routeData) {
              checked++;

              const totalScore = (routeData ? routeData.score : 1) + areaScore;

              const candidate = {
                lat: point.lat,
                lng: point.lng,
                distanceKm: point.distanceKm,
                score: totalScore,
                route: routeData ? routeData.route : null
              };

              if (!bestCandidate || candidate.score > bestCandidate.score) {
                bestCandidate = candidate;
              }

              if (checked === CANDIDATE_POINT_COUNT) {
                callback(bestCandidate);
              }
            }
          );
          return;
        }

        checked++;
        if (checked === CANDIDATE_POINT_COUNT) {
          callback(bestCandidate);
        }
      }
    );
  }
}

// ===============================
// 3件検索
// ===============================
function searchThreeGoodRoad(lat, lng, distance, time, highway) {
  hideLoadingState();
  searchGoodRoadSequentially(0, lat, lng, distance, time, highway);
}

function searchGoodRoadSequentially(index, baseLat, baseLng, baseDistance, time, highway) {
  if (index >= 3) {
    showResultWithEffect();
    document.getElementById("rerollButton").classList.remove("hidden");
    return;
  }

  const profile = getTimeProfile(time);
  const point = createRandomPoint(
    baseLat,
    baseLng,
    Math.max(baseDistance * 0.22, 5),
    Math.max(profile.candidateMinDistance * 0.3, 2)
  );

  const selectedKey = getSelectedRoadTypeKey();
  const fallbackTypes = buildFallbackTypeOrder(selectedKey, time, index);

  searchNearbyGoodRoad(
    point.lat,
    point.lng,
    point.distanceKm,
    time,
    highway,
    index,
    fallbackTypes,
    0,
    function (success, usedRoadType) {
      if (!success) {
        const defaultType = fallbackTypes[0];
        document.getElementById(`result${index + 1}`).innerHTML = `
          <div class="genre">
            <img src="../image/red_dog.png" class="genre-dog">
            ${defaultType.label}
          </div>
          候補を見つけにくかったので、もう一度まわしてみてね
        `;
      }

      searchGoodRoadSequentially(index + 1, baseLat, baseLng, baseDistance, time, highway);
    }
  );
}

// ===============================
// Placesスコア
// ===============================
function getPlaceScore(place, roadType, time) {
  const name = place.name || "";
  const vicinity = place.vicinity || "";
  const types = Array.isArray(place.types) ? place.types.join(" ") : "";
  const text = `${name} ${vicinity} ${types}`;

  let score = 0;

  if (roadType.regex.test(text)) score += 10;

  if (/海|海岸|展望|パノラマ|高原|スカイライン|岬|湖|風景|景色/i.test(text)) {
    score += roadType.key === "scenic" ? 8 : 3;
  }

  if (/農道|田園|郊外|公園|川|湖|ロード|ドライブ/i.test(text)) {
    score += roadType.key === "relaxed" ? 8 : 3;
  }

  if (/峠|山道|ワインディング|ライン|高原|スカイライン/i.test(text)) {
    score += roadType.key === "mild_curve" ? 8 : 3;
  }

  if (/道の駅|展望広場|絶景スポット|ビューポイント|park|point_of_interest|tourist_attraction/i.test(text)) {
    score += 4;
  }

  if (/駅|駅前|繁華街|商店街|ビル|シティ|都心/i.test(text)) {
    score -= 8;
  }

  if (/東京都千代田区|東京都中央区|東京都港区|東京都新宿区|東京都渋谷区|東京都豊島区|東京都台東区/i.test(vicinity)) {
    score -= 10;
  }

  score += Math.min(place.user_ratings_total || 0, 300) * 0.02;
  score += (place.rating || 0) * 1.2;

  if (time <= 30 && /展望台|岬|峠/.test(text)) {
    score -= 2;
  }

  if (time >= 120 && /展望台|高原|スカイライン|峠|海岸/.test(text)) {
    score += 3;
  }

  return score;
}

// ===============================
// Places API検索
// ===============================
function searchNearbyGoodRoad(lat, lng, distance, time, highway, index, roadTypes, typeTryIndex = 0, callback = null) {
  const currentRoadType = roadTypes[typeTryIndex];
  if (!currentRoadType) {
    if (callback) callback(false, null);
    return;
  }

  const service = new google.maps.places.PlacesService(map);
  const box = document.getElementById(`result${index + 1}`);

  const radiusBase = Math.max(distance * 1000, 8000);
  const radiusList = [
    radiusBase,
    Math.floor(radiusBase * 1.5),
    Math.floor(radiusBase * 2.0)
  ];

  searchNearbyGoodRoadByRadius(
    service,
    lat,
    lng,
    radiusList,
    currentRoadType,
    time,
    function (success, spot) {
      if (success && spot) {
        usedPlaceIds.add(spot.place_id);

        const slat = spot.geometry.location.lat();
        const slng = spot.geometry.location.lng();
        const rating = spot.rating || "評価なし";
        const reviews = spot.user_ratings_total || 0;
        const photoUrl = getSpotPhotoUrl(spot);
        const typeLabel = formatGoodRoadTypes(spot.types, currentRoadType);
        const catchCopy = buildGoodRoadCatchCopy(spot, currentRoadType);

        const mapUrl =
          `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(startAddressGlobal)}` +
          `&destination=${encodeURIComponent(spot.name)}` +
          `&destination_place_id=${spot.place_id}`;

        const shareText =
          `${spot.name} を見つけたよ！ ${currentRoadType.label} / ⭐${rating} #どこいこMap`;

        const marker = new google.maps.Marker({
          position: { lat: slat, lng: slng },
          map: map,
          title: spot.name,
          icon: {
            url: "../image/red_dog.png",
            scaledSize: new google.maps.Size(50, 50)
          }
        });

        spotMarkers.push(marker);
        fitMapToMarkers();

        const fallbackNote =
          typeTryIndex > 0
            ? `<div class="fallback-note">※近い候補が少なかったため「${currentRoadType.label}」で表示しています</div>`
            : "";

        saveGoodRoadHistoryItem({
          pageType: "goodRoad",
          roadTypeKey: currentRoadType.key,
          roadTypeLabel: currentRoadType.label,
          name: spot.name,
          address: spot.vicinity || "",
          rating: rating,
          reviews: reviews,
          distanceKm: Number(distance.toFixed(1)),
          time: time,
          highway: highway,
          placeId: spot.place_id,
          mapUrl: mapUrl,
          photoUrl: photoUrl,
          catchCopy: catchCopy
        });

        box.dataset.mapUrl = mapUrl;
        box.dataset.shareText = shareText;

        box.innerHTML = `
          <div class="genre">
            <img src="../image/red_dog.png" class="genre-dog">
            ${currentRoadType.label}
          </div>

          ${fallbackNote}

          ${photoUrl ? `
          <div class="spot-photo-wrap">
            <img src="${photoUrl}" alt="${spot.name}" class="spot-photo" loading="lazy">
          </div>
          ` : ""}

          <div class="spot-name">${spot.name}</div>
          <div class="spot-copy">${catchCopy}</div>

          📍 ${spot.vicinity || "住所情報なし"}<br>
          ⭐ ${rating} (${reviews}件)<br>
          🏷 ${typeLabel}<br>
          🚗 約${distance.toFixed(1)}km / ${time}分以内<br><br>

          <div class="result-actions">
            <a
              href="${mapUrl}"
              target="_blank"
              rel="noopener noreferrer"
            >
              🧭 Googleマップでナビ
            </a>

            <button type="button" class="share-button" onclick="shareGoodRoadResult(${index})">
              共有する
            </button>
          </div>
        `;

        if (callback) callback(true, currentRoadType);
        return;
      }

      searchNearbyGoodRoad(
        lat,
        lng,
        distance,
        time,
        highway,
        index,
        roadTypes,
        typeTryIndex + 1,
        callback
      );
    }
  );
}

function searchNearbyGoodRoadByRadius(service, lat, lng, radiusList, roadType, time, done) {
  let radiusIndex = 0;

  function tryNextRadius() {
    if (radiusIndex >= radiusList.length) {
      done(false, null);
      return;
    }

    const radius = radiusList[radiusIndex];

    const requests = [
      {
        location: { lat, lng },
        radius,
        keyword: roadType.keywords
      },
      {
        location: { lat, lng },
        radius,
        keyword: COMMON_FALLBACK_KEYWORDS
      },
      {
        location: { lat, lng },
        radius,
        type: "tourist_attraction",
        keyword: "展望 景色 ドライブ"
      },
      {
        location: { lat, lng },
        radius,
        type: "park",
        keyword: "景色 高原 公園"
      }
    ];

    searchNearbyByRequests(service, requests, function (results) {
      if (!results || results.length === 0) {
        radiusIndex++;
        tryNextRadius();
        return;
      }

      let filtered = results.filter(place => {
        if (!place.geometry || !place.geometry.location) return false;
        if (!place.place_id) return false;
        if (usedPlaceIds.has(place.place_id)) return false;

        const plat = place.geometry.location.lat();
        const plng = place.geometry.location.lng();

        const tooClose = spotMarkers.some(marker => {
          if (!marker || !marker.getPosition) return false;
          const pos = marker.getPosition();
          return calcDistance(plat, plng, pos.lat(), pos.lng()) < EXCLUDE_DISTANCE_KM;
        });

        return !tooClose;
      });

      if (filtered.length === 0) {
        radiusIndex++;
        tryNextRadius();
        return;
      }

      filtered.sort((a, b) => {
        return getPlaceScore(b, roadType, time) - getPlaceScore(a, roadType, time);
      });

      const top = filtered.slice(0, 8);
      const pick = top[Math.floor(Math.random() * Math.min(top.length, 3))] || top[0];

      if (!pick) {
        radiusIndex++;
        tryNextRadius();
        return;
      }

      done(true, pick);
    });
  }

  tryNextRadius();
}

function searchNearbyByRequests(service, requests, callback) {
  const merged = [];
  let finished = 0;

  requests.forEach(request => {
    service.nearbySearch(request, function (results, status) {
      if (
        status === google.maps.places.PlacesServiceStatus.OK &&
        results &&
        results.length > 0
      ) {
        results.forEach(place => {
          if (!merged.some(item => item.place_id === place.place_id)) {
            merged.push(place);
          }
        });
      }

      finished++;
      if (finished === requests.length) {
        callback(merged);
      }
    });
  });
}

// ===============================
// 地図の表示範囲調整
// ===============================
function fitMapToMarkers() {
  const bounds = new google.maps.LatLngBounds();

  if (startMarker && startMarker.getPosition) {
    bounds.extend(startMarker.getPosition());
  }

  spotMarkers.forEach(marker => {
    if (marker && marker.getPosition) {
      bounds.extend(marker.getPosition());
    }
  });

  if (!bounds.isEmpty()) {
    map.fitBounds(bounds);

    google.maps.event.addListenerOnce(map, "bounds_changed", function () {
      if (map.getZoom() > 12) {
        map.setZoom(12);
      }
    });
  }
}

// ===============================
// UI表示アニメ
// ===============================
function showResultWithEffect() {
  const box = document.getElementById("results");
  box.classList.remove("show");
  void box.offsetWidth;
  box.classList.add("show");

  if (hasRealResults()) {
    setTimeout(() => {
      launchConfetti();
    }, 250);
  }
}

// ===============================
// 紙吹雪
// ===============================
function launchConfetti() {
  const colors = ["#19a7b8", "#63d2db", "#8ee3ea", "#e4f9fb", "#d6f4f7"];

  for (let i = 0; i < 40; i++) {
    const confetti = document.createElement("div");
    confetti.classList.add("confetti");
    confetti.style.left = Math.random() * 100 + "vw";
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDuration = 2 + Math.random() * 2 + "s";
    document.body.appendChild(confetti);

    setTimeout(() => {
      confetti.remove();
    }, 4000);
  }
}

// ===============================
// もう一回まわす
// ===============================
function rerollGoodRoad() {
  if (!startLat || !startLng) {
    alert("先に検索してね！");
    return;
  }

  const time = Number(document.getElementById("timeSelect").value);
  const highway = document.getElementById("highway").value;

  clearResults();
  showLoadingState();

  findBestGoodRoadPoint(time, highway, function (bestPoint) {
    if (!bestPoint) {
      hideLoadingState();
      alert("別候補をうまく見つけられませんでした。もう一度試してみてね！");
      return;
    }

    searchThreeGoodRoad(bestPoint.lat, bestPoint.lng, bestPoint.distanceKm, time, highway);
  });
}

// ===============================
// 現在地取得
// ===============================
function getCurrentLocation() {
  if (!navigator.geolocation) {
    alert("このブラウザでは位置情報が使えません");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (position) {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const geocoder = new google.maps.Geocoder();

      geocoder.geocode({ location: { lat, lng } }, function (results, status) {
        if (status === "OK" && results[0]) {
          document.getElementById("startLocation").value = results[0].formatted_address;
        } else {
          alert("住所を取得できませんでした");
        }
      });
    },
    function () {
      alert("現在地を取得できませんでした");
    }
  );
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

// ===============================
// 初期イベント
// ===============================
window.addEventListener("DOMContentLoaded", function () {
  const timeSelect = document.getElementById("timeSelect");
  timeSelect.addEventListener("change", updateHighwayControl);
  updateHighwayControl();
});

function hasRealResults() {
  const ids = ["result1", "result2", "result3"];

  return ids.some(id => {
    const el = document.getElementById(id);
    if (!el) return false;
    return el.querySelector(".spot-name");
  });
}
