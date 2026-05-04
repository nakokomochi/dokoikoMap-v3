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

const IMAGE_BASE_PATH = "../image";
const EXCLUDE_DISTANCE_KM = 1.2;
const CANDIDATE_POINT_COUNT = 4;
const SEARCH_RADIUS_MIN = 5000;
const SEARCH_RETRY_LIMIT = 1;

let usedPlaceIds = new Set();

// ===============================
// 道タイプ
// ===============================
const ROAD_TYPES = [
  {
    key: "relaxed",
    label: "🌿 のんびり道",
    keywords: "道の駅 公園 湖 ダム 高原 牧場 展望台 郊外 景色 自然"
  },
  {
    key: "mild_curve",
    label: "🏍 緩いカーブ道",
    keywords: "峠 高原 ダム 渓谷 スカイライン 展望台 山道 景色"
  },
  {
    key: "scenic",
    label: "🌅 景色道",
    keywords: "展望台 絶景 景勝地 高原 湖 ダム 海 岬 道の駅"
  }
];

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
function searchGoodRoad() {
  const startAddress = document.getElementById("startLocation").value.trim();
  startAddressGlobal = startAddress;

  if (!startAddress) {
    alert("出発地を入力してね！");
    return;
  }

  const time = Number(document.getElementById("timeSelect").value);
  const highway = document.getElementById("highway").value;
  const roadType = getSelectedRoadType();

  clearResults();
  showLoadingState("検索中...", "わんこが気持ちよく走れそうな道を探してるよ");

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

    const maxDistance = maxDistanceByTime(time, highway);

    findValidPoint(startLat, startLng, maxDistance, geocoder, time, highway, roadType);
  });
}

// ===============================
// 選択中の道タイプ取得
// ===============================
function getSelectedRoadType() {
  const key = document.getElementById("roadType")?.value || "relaxed";
  return ROAD_TYPES.find(type => type.key === key) || ROAD_TYPES[0];
}

// ===============================
// 結果クリア
// ===============================
function clearResults() {
  const resultsBox = document.getElementById("results");
  if (!resultsBox) return;

  resultsBox.classList.remove("show");
  resultsBox.classList.remove("loading");
  resultsBox.classList.add("hidden");

  resultsBox.innerHTML = `
<div id="result1" class="result-item"></div>
<div id="result2" class="result-item"></div>
<div id="result3" class="result-item"></div>
`;

  if (loadingTimer) {
    clearInterval(loadingTimer);
    loadingTimer = null;
  }

  spotMarkers.forEach(marker => marker.setMap(null));
  spotMarkers = [];
  usedPlaceIds.clear();

  const rerollButton = document.getElementById("rerollButton");
  if (rerollButton) {
    rerollButton.classList.add("hidden");
  }
}

// ===============================
// 最大距離計算
// ===============================
function maxDistanceByTime(time, highway) {
  if (time <= 30) return 10;
  if (time <= 60) return highway === "yes" ? 30 : 25;
  if (time <= 90) return highway === "yes" ? 50 : 48;
  if (time <= 120) return highway === "yes" ? 55 : 50;
  if (time <= 150) return highway === "yes" ? 65 : 60;
  if (time <= 180) return highway === "yes" ? 75 : 65;
  return highway === "yes" ? 120 : 85;
}

// ===============================
// 最小距離計算
// ===============================
function getMinDistanceByTime(maxDistance, time, highway) {
  if (time === 30) return 0;
  if (time === 60) return maxDistance * (highway === "yes" ? 0.30 : 0.25);
  if (time === 90) return maxDistance * (highway === "yes" ? 0.45 : 0.40);
  if (time === 120) return maxDistance * (highway === "yes" ? 0.55 : 0.50);
  if (time === 150) return maxDistance * (highway === "yes" ? 0.65 : 0.60);
  if (time === 180) return maxDistance * (highway === "yes" ? 0.75 : 0.65);
  return 0;
}

// ===============================
// ランダム座標生成
// ===============================
function createDirectionalPoint(lat, lng, minDistanceKm, maxDistanceKm) {
  const safeMin = Math.max(0, minDistanceKm || 0);
  const safeMax = Math.max(safeMin + 0.5, maxDistanceKm || safeMin + 0.5);

  const targetDistanceKm = safeMin + Math.random() * (safeMax - safeMin);

  const baseAngles = [
    0,
    Math.PI / 2,
    Math.PI,
    Math.PI * 1.5
  ];

  const baseAngle = baseAngles[Math.floor(Math.random() * baseAngles.length)];
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
// 距離計算
// ===============================
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ===============================
// 候補中心点を探す
// ===============================
function findValidPoint(startLat, startLng, maxDistance, geocoder, time, highway, roadType, attempt = 0) {
  if (attempt > CANDIDATE_POINT_COUNT) {
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
          searchThreeGoodRoad(point.lat, point.lng, point.distanceKm, time, highway, roadType);
          return;
        }
      }

      findValidPoint(startLat, startLng, maxDistance, geocoder, time, highway, roadType, attempt + 1);
    }
  );
}

// ===============================
// 1回検索して3件作る
// ===============================
async function searchThreeGoodRoad(lat, lng, distance, time, highway, roadType) {
  searchNearbyGoodRoadOnce(lat, lng, distance, time, highway, roadType, async function (results) {
    if (!results || results.length === 0) {
      hideLoadingState();

      for (let i = 0; i < 3; i++) {
        const box = document.getElementById(`result${i + 1}`);
        if (box) {
          box.innerHTML = `
<div class="genre">
<img src="${IMAGE_BASE_PATH}/red_dog.png" class="genre-dog">
${roadType.label}
</div>
候補を見つけにくかったので、もう一度まわしてみてね
`;
        }
      }

      showResultWithEffect();

      const rerollButton = document.getElementById("rerollButton");
      if (rerollButton) rerollButton.classList.remove("hidden");

      return;
    }

    const maxDistance = maxDistanceByTime(time, highway);

    for (let index = 0; index < 3; index++) {
      const box = document.getElementById(`result${index + 1}`);
      if (!box) continue;

      const spot = pickBestGoodRoadSmart(results, roadType, time, maxDistance);

      if (!spot) {
        box.innerHTML = `
<div class="genre">
<img src="${IMAGE_BASE_PATH}/red_dog.png" class="genre-dog">
${roadType.label}
</div>
見つかりませんでした
`;
        continue;
      }

      usedPlaceIds.add(spot.place_id);

      const routeInfo = await getRouteInfoToSpot(spot, highway);

      renderGoodRoadResultCard(
        box,
        spot,
        distance,
        time,
        highway,
        roadType,
        index,
        routeInfo
      );
    }

    hideLoadingState();
    showResultWithEffect();

    const rerollButton = document.getElementById("rerollButton");
    if (rerollButton) rerollButton.classList.remove("hidden");
  });
}

// ===============================
// Places API検索：基本1回
// ===============================
function searchNearbyGoodRoadOnce(lat, lng, distance, time, highway, roadType, callback, retry = 0) {
  const service = new google.maps.places.PlacesService(map);

  let radius = Math.max(distance * 1000, SEARCH_RADIUS_MIN);
  if (retry === 1) radius *= 1.8;

  const fallbackKeyword = "道の駅 公園 展望台 景色 高原 湖 ダム 海 自然 ドライブ";
  const searchKeyword = retry === 0 ? roadType.keywords : fallbackKeyword;

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
          searchNearbyGoodRoadOnce(lat, lng, distance, time, highway, roadType, callback, retry + 1);
          return;
        }

        callback([]);
        return;
      }

      const filtered = results.filter(place => {
        if (!place || !place.place_id) return false;
        if (!place.geometry || !place.geometry.location) return false;
        if (usedPlaceIds.has(place.place_id)) return false;
        if (isExcludedGoodRoad(place)) return false;
        return true;
      });

      callback(filtered.length > 0 ? filtered : results);
    }
  );
}

// ===============================
// 候補をスコアで選ぶ
// ===============================
function pickBestGoodRoadSmart(results, roadType, time, maxDistance) {
  let candidates = results.filter(place => {
    if (!place || !place.place_id) return false;
    if (usedPlaceIds.has(place.place_id)) return false;
    if (!place.geometry || !place.geometry.location) return false;
    if (isExcludedGoodRoad(place)) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  candidates = candidates.filter(place => {
    const plat = place.geometry.location.lat();
    const plng = place.geometry.location.lng();

    const tooClose = spotMarkers.some(marker => {
      if (!marker || !marker.getPosition) return false;
      const pos = marker.getPosition();
      return calcDistance(plat, plng, pos.lat(), pos.lng()) < EXCLUDE_DISTANCE_KM;
    });

    return !tooClose;
  });

  if (candidates.length === 0) {
    candidates = results.filter(place => {
      return place.place_id && !usedPlaceIds.has(place.place_id) && !isExcludedGoodRoad(place);
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aDistance = calcDistance(
      startLat,
      startLng,
      a.geometry.location.lat(),
      a.geometry.location.lng()
    );

    const bDistance = calcDistance(
      startLat,
      startLng,
      b.geometry.location.lat(),
      b.geometry.location.lng()
    );

    const aScore =
      getGoodRoadScore(a, roadType) +
      getDistanceScore(aDistance, maxDistance, time) +
      Number(a.rating || 0) * 5 +
      Math.min(Number(a.user_ratings_total || 0), 300) * 0.05;

    const bScore =
      getGoodRoadScore(b, roadType) +
      getDistanceScore(bDistance, maxDistance, time) +
      Number(b.rating || 0) * 5 +
      Math.min(Number(b.user_ratings_total || 0), 300) * 0.05;

    return bScore - aScore;
  });

  const top = candidates.slice(0, 6);
  return top[Math.floor(Math.random() * Math.min(top.length, 3))] || top[0];
}

// ===============================
// goodRoadスコア
// ===============================
function getGoodRoadScore(place, roadType) {
  const name = place?.name || "";
  const vicinity = place?.vicinity || "";
  const types = Array.isArray(place?.types) ? place.types.join(" ") : "";
  const text = `${name} ${vicinity} ${types}`;

  let score = 0;

  if (/道の駅/i.test(text)) score += 28;
  if (/展望台|絶景|景勝地/i.test(text)) score += 28;
  if (/高原|スカイライン|ライン/i.test(text)) score += 30;
  if (/湖|ダム|海|岬|海岸/i.test(text)) score += 24;
  if (/公園|自然公園/i.test(text)) score += 14;
  if (/滝|渓谷|峡/i.test(text)) score += 18;
  if (/峠|山道|林道/i.test(text)) score += 22;

  if (/tourist_attraction|park|natural_feature|point_of_interest/i.test(types)) {
    score += 10;
  }

  if (roadType.key === "relaxed") {
    if (/道の駅|公園|湖|ダム|海|牧場|高原|郊外/i.test(text)) score += 22;
    if (/峠|林道|険道|酷道/i.test(text)) score -= 16;
  }

  if (roadType.key === "mild_curve") {
    if (/峠|山道|高原|スカイライン|ライン|渓谷|ダム/i.test(text)) score += 24;
    if (/駅前|商業施設|ショッピング/i.test(text)) score -= 8;
  }

  if (roadType.key === "scenic") {
    if (/展望台|絶景|景勝地|高原|湖|海|岬|海岸|ダム|滝/i.test(text)) score += 26;
    if (/ビル|駅前|商業施設/i.test(text)) score -= 12;
  }

  if (/オフィス|ビル|企業|学校|大学|病院|センター|会館|ホール/i.test(text)) score -= 25;
  if (/レストラン|カフェ|食堂|ラーメン|居酒屋/i.test(text)) score -= 8;
  if (/ホテル|旅館/i.test(text)) score -= 8;

  return score;
}

// ===============================
// 除外
// ===============================
function isExcludedGoodRoad(place) {
  const name = place?.name || "";
  const vicinity = place?.vicinity || "";
  const types = Array.isArray(place?.types) ? place.types.join(" ") : "";
  const text = `${name} ${vicinity} ${types}`;

  if (/ラブホテル|ホテル街|居酒屋|バー/i.test(text)) return true;
  if (/night_club/i.test(types)) return true;

  return false;
}

// ===============================
// 距離スコア
// ===============================
function getDistanceScore(straightDistance, maxDistance, time) {
  const ratio = straightDistance / maxDistance;

  let idealMin = 0.4;
  let idealMax = 0.8;

  if (time >= 90) {
    idealMin = 0.55;
    idealMax = 0.9;
  }

  if (time >= 120) {
    idealMin = 0.65;
    idealMax = 0.95;
  }

  let score = 0;

  if (ratio >= idealMin && ratio <= idealMax) score += 30;
  if (ratio < idealMin) score -= 20;
  if (ratio > idealMax) score -= 30;

  return score;
}

// ===============================
// 実ルート取得：選ばれた結果だけ
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
        destination: { placeId: spot.place_id },
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: highway !== "yes",
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

        resolve({
          durationMinutes: Math.round(leg.duration.value / 60),
          durationText: leg.duration.text,
          distanceKm: Number((leg.distance.value / 1000).toFixed(1)),
          distanceText: leg.distance.text
        });
      }
    );
  });
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
function formatGoodRoadTypes(types = [], spotName = "", roadType = null) {
  const name = String(spotName || "");

  if (/道の駅/.test(name)) return "道の駅";
  if (/展望台|絶景|景勝地/.test(name)) return "景色スポット";
  if (/高原|スカイライン|ライン/.test(name)) return "走って気持ちいい道";
  if (/峠|山道|林道/.test(name)) return "山道・峠道";
  if (/湖|ダム|海|岬|海岸/.test(name)) return "景色道";
  if (/公園/.test(name)) return "のんびり立ち寄り";

  const typeMap = {
    tourist_attraction: "立ち寄りスポット",
    park: "公園",
    point_of_interest: "スポット",
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

  return roadType ? roadType.label.replace(/[🌿🌅🏍]/g, "").trim() : "気持ちよく走れそうな道";
}

// ===============================
// 説明文
// ===============================
function buildGoodRoadCatchCopy(spot, roadType) {
  const name = String(spot?.name || "");
  const types = Array.isArray(spot?.types) ? spot.types.join(" ") : "";
  const text = `${name} ${types}`;

  if (/道の駅/.test(text)) {
    return "走ったあとの休憩にも使いやすそうな道の駅候補です。";
  }

  if (/展望台|絶景|景勝地/.test(text)) {
    return "景色を楽しみながら走った先に立ち寄りたくなる候補です。";
  }

  if (/高原|スカイライン|ライン/.test(text)) {
    return "開放感のある走りを楽しめそうな候補です。";
  }

  if (/峠|山道|林道/.test(text)) {
    return "緩いカーブを楽しみたい日に合いそうな候補です。";
  }

  if (/湖|ダム|海|岬|海岸/.test(text)) {
    return "景色を見ながらのんびり走りたくなる候補です。";
  }

  if (roadType.key === "mild_curve") {
    return "緩やかなカーブを楽しみながら向かえそうな候補です。";
  }

  if (roadType.key === "scenic") {
    return "景色を楽しみながら向かいたくなる候補です。";
  }

  return "のんびり走りたい日にちょうど良さそうな候補です。";
}

// ===============================
// 履歴保存
// ===============================
const DOKOIKO_HISTORY_KEY = "dokoiko_history";
const DOKOIKO_HISTORY_MAX = 6;

function saveGoodRoadHistoryItem(data) {
  let current = [];

  try {
    current = JSON.parse(localStorage.getItem(DOKOIKO_HISTORY_KEY) || "[]");
  } catch (e) {
    current = [];
  }

  const historyItem = {
    savedAt: new Date().toISOString(),
    sourceType: "goodroad",
    sourceLabel: "気持ちよく走れる道版",
    genreName: "気持ちよく走れる道",
    placeId: data.placeId || data.place_id || data.name || "",
    ...data
  };

  const filtered = current.filter(item => {
    return !(item.placeId === historyItem.placeId && item.sourceType === historyItem.sourceType);
  });

  filtered.unshift(historyItem);

  localStorage.setItem(
    DOKOIKO_HISTORY_KEY,
    JSON.stringify(filtered.slice(0, DOKOIKO_HISTORY_MAX))
  );
}

// ===============================
// GoogleマップURL
// ===============================
function buildGoogleMapsUrl(spot, highway) {
  let url =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${encodeURIComponent(startAddressGlobal)}` +
    `&destination=${encodeURIComponent(spot.name)}` +
    `&destination_place_id=${spot.place_id}` +
    `&travelmode=driving`;

  if (highway !== "yes") {
    url += `&avoid=highways`;
  }

  return url;
}

// ===============================
// 結果カード描画
// ===============================
function renderGoodRoadResultCard(box, spot, distance, time, highway, roadType, index, routeInfo = null) {
  const slat = spot.geometry.location.lat();
  const slng = spot.geometry.location.lng();
  const rating = spot.rating || "評価なし";
  const reviews = spot.user_ratings_total || 0;
  const photoUrl = getSpotPhotoUrl(spot);
  const typeLabel = formatGoodRoadTypes(spot.types, spot.name, roadType);
  const catchCopy = buildGoodRoadCatchCopy(spot, roadType);
  const mapUrl = buildGoogleMapsUrl(spot, highway);

  const shareText =
    `${spot.name} を見つけたよ！ ${roadType.label} / ⭐${rating} #どこいこMap`;

  const marker = new google.maps.Marker({
    position: { lat: slat, lng: slng },
    map: map,
    title: spot.name,
    icon: {
      url: `${IMAGE_BASE_PATH}/red_dog.png`,
      scaledSize: new google.maps.Size(50, 50)
    }
  });

  spotMarkers.push(marker);
  fitMapToMarkers();

  const displayDistanceKm = routeInfo ? routeInfo.distanceKm : Number(distance.toFixed(1));
  const displayDistanceText = routeInfo ? routeInfo.distanceText : `約${distance.toFixed(1)}km`;
  const displayDurationText = routeInfo ? routeInfo.durationText : `${time}分以内`;

  saveGoodRoadHistoryItem({
    pageType: "goodRoad",
    roadTypeKey: roadType.key,
    roadTypeLabel: roadType.label,
    name: spot.name,
    address: spot.vicinity || "",
    rating: rating,
    reviews: reviews,
    distanceKm: displayDistanceKm,
    distanceText: displayDistanceText,
    durationText: displayDurationText,
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
<img src="${IMAGE_BASE_PATH}/red_dog.png" class="genre-dog">
${roadType.label}
</div>

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
🎯 道の雰囲気：${roadType.label}<br>
🚗 ${displayDistanceText}<br>
⏱ ${displayDurationText}<br>
🛣 ${time === 30 ? "下道のみ" : (highway === "yes" ? "高速あり" : "下道のみ")}<br><br>

<div class="result-actions">
<a href="${mapUrl}" target="_blank" rel="noopener noreferrer">
🧭 Googleマップでナビ
</a>

<button type="button" class="share-button" onclick="shareGoodRoadResult(${index})">
共有する
</button>
</div>
`;
}

// ===============================
// 地図範囲
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
// 表示アニメ
// ===============================
function showResultWithEffect() {
  const box = document.getElementById("results");
  if (!box) return;

  box.classList.remove("hidden");
  box.classList.remove("show");

  void box.offsetWidth;

  box.classList.add("show");

  if (hasRealResults()) {
    launchConfetti();
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

function hasRealResults() {
  const ids = ["result1", "result2", "result3"];

  return ids.some(id => {
    const el = document.getElementById(id);
    if (!el) return false;
    return el.querySelector(".spot-name");
  });
}

// ===============================
// もう一回
// ===============================
function rerollGoodRoad() {
  if (!startLat || !startLng) {
    alert("先に検索してね！");
    return;
  }

  const time = Number(document.getElementById("timeSelect").value);
  const highway = document.getElementById("highway").value;
  const roadType = getSelectedRoadType();

  const geocoder = new google.maps.Geocoder();
  const maxDistance = maxDistanceByTime(time, highway);

  clearResults();
  showLoadingState("検索中...", "わんこが別の気持ちいい道を探してるよ");

  findValidPoint(startLat, startLng, maxDistance, geocoder, time, highway, roadType);
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

window.addEventListener("DOMContentLoaded", function () {
  const timeSelect = document.getElementById("timeSelect");

  if (timeSelect) {
    timeSelect.addEventListener("change", updateHighwayControl);
    updateHighwayControl();
  }
});

// ===============================
// 検索中わんこ
// ===============================
function showLoadingState(message = "検索中...", subMessage = "わんこが目的地を探してるよ") {
  const resultsBox = document.getElementById("results");
  if (!resultsBox) return;

  resultsBox.classList.remove("hidden");
  resultsBox.classList.add("show");
  resultsBox.classList.add("loading");

  resultsBox.innerHTML = `
<div id="loadingBox" class="loading-box">
<div class="loading-dog">
<img src="${IMAGE_BASE_PATH}/dog.png" alt="検索中" class="loading-dog-image">
</div>
<div class="loading-text" id="loadingText">${message}</div>
<div class="loading-subtext">${subMessage}</div>
</div>

<div id="result1" class="result-item"></div>
<div id="result2" class="result-item"></div>
<div id="result3" class="result-item"></div>
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

// ===============================
// 検索中解除
// ===============================
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
