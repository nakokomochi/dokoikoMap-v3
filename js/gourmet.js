let map;
let marker;
let startMarker;
let startLat;
let startLng;
let spotMarkers = [];
let startAddressGlobal = "";

const HIGHWAY_SPEED = 80;
const LOCAL_SPEED = 40;

const TOKYO_STATION_POSITION = {
    center: { lat: 35.681236, lng: 139.767125 },
    zoom: 12,
    gestureHandling: "greedy"
};

const EXCLUDE_DISTANCE_KM = 3;
let loadingTimer = null;

// 画像パス
// gourmet.html が themes/gourmet.html にあるなら "../image"
// root直下なら "./image" に変えてね
const IMAGE_BASE_PATH = "../image";

// API使用回数を抑えるための調整
const MAX_POINT_ATTEMPTS = 8;
const SEARCH_RADIUS_MIN = 5000;
const SEARCH_RETRY_LIMIT = 1;

// ルート判定用
const TIME_TOLERANCE_MINUTES = 20;

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
function searchGourmet() {
    const startAddress = document.getElementById("startLocation").value;
    startAddressGlobal = startAddress;

    if (!startAddress) {
        alert("出発地を入力してね！");
        return;
    }

    const time = Number(document.getElementById("timeSelect").value);
    const highway = document.getElementById("highway").value;

    clearResults();
    showLoadingState("検索中...", "おいしそうなスポットを探してるよ");

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

    spotMarkers.forEach(m => m.setMap(null));
    spotMarkers = [];

    const rerollButton = document.getElementById("rerollButton");
    if (rerollButton) {
        rerollButton.classList.add("hidden");
    }
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
function formatGourmetTypes(types = [], spot = null) {
    const typeMap = {
        restaurant: "レストラン",
        cafe: "カフェ",
        bar: "バー",
        bakery: "ベーカリー",
        meal_takeaway: "テイクアウト",
        meal_delivery: "グルメスポット",
        food: "飲食スポット",
        point_of_interest: "人気スポット"
    };

    const labels = types
        .map(type => typeMap[type])
        .filter(Boolean);

    const joined = [...new Set(labels)].slice(0, 2).join("・");
    if (joined) return joined;

    const text = `${spot?.name || ""} ${spot?.vicinity || ""}`;

    if (/ラーメン/i.test(text)) return "ラーメン";
    if (/そば|蕎麦/i.test(text)) return "そば";
    if (/うどん/i.test(text)) return "うどん";
    if (/定食|食堂/i.test(text)) return "定食・食堂";
    if (/パスタ|洋食/i.test(text)) return "洋食";
    if (/カレー/i.test(text)) return "カレー";
    if (/道の駅/i.test(text)) return "道の駅グルメ";
    if (/フードコート/i.test(text)) return "フードコート";
    if (/ドライブイン/i.test(text)) return "ドライブイン";

    return "グルメスポット";
}

// ===============================
// ランダム文言
// ===============================
function pickRandomMessage(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return "気になるグルメスポットです。";
    }

    return messages[Math.floor(Math.random() * messages.length)];
}

// ===============================
// バイカー向け説明文
// ===============================
function buildGourmetCatchCopy(spot) {
    const rating = Number(spot?.rating || 0);
    const reviews = Number(spot?.user_ratings_total || 0);
    const name = spot?.name || "";
    const vicinity = spot?.vicinity || "";
    const types = Array.isArray(spot?.types) ? spot.types : [];
    const text = `${name} ${vicinity} ${types.join(" ")}`;

    if (/道の駅/i.test(text)) {
        return pickRandomMessage([
            "休憩もごはんもまとめて済ませやすい道の駅グルメ候補です。",
            "ツーリング途中に立ち寄りやすそうな道の駅グルメです。",
            "バイク途中のひと休みにも合いそうな道の駅候補です。"
        ]);
    }

    if (/ラーメン/i.test(text)) {
        return pickRandomMessage([
            "ツーリング途中にしっかり食べたくなったときに合いそうなラーメン候補です。",
            "サッと立ち寄って満足感を得やすそうなラーメン候補です。",
            "バイクで走ったあとに食べたくなる系のラーメン候補です。"
        ]);
    }

    if (/そば|蕎麦/i.test(text)) {
        return pickRandomMessage([
            "軽すぎず重すぎず、ツーリング途中にも寄りやすそうなそば候補です。",
            "景色を楽しむ途中で立ち寄りやすそうなそば処候補です。",
            "バイク旅の途中ごはんとして相性が良さそうなそば候補です。"
        ]);
    }

    if (/うどん/i.test(text)) {
        return pickRandomMessage([
            "気軽に立ち寄って食べやすそうなうどん候補です。",
            "ツーリング途中のごはん候補としてちょうど良さそうなうどん店です。",
            "ひと休みしながら寄りやすそうなうどん候補です。"
        ]);
    }

    if (/定食|食堂/i.test(text)) {
        return pickRandomMessage([
            "しっかり食べたいツーリング途中に合いそうな食堂候補です。",
            "ひとりでも寄りやすそうな定食・食堂系の候補です。",
            "走ったあとに満足感を得やすそうな食堂候補です。"
        ]);
    }

    const isCafe = types.includes("cafe");
    const isBakery = types.includes("bakery");
    const isRestaurant = types.includes("restaurant");

    if (isCafe) {
        return pickRandomMessage([
            "ツーリング途中の休憩にも合いそうなカフェです。",
            "気軽に立ち寄ってひと息つけそうなカフェ候補です。",
            "ひと休みしながら寄り道しやすそうなカフェです。"
        ]);
    }

    if (isBakery) {
        return pickRandomMessage([
            "軽く立ち寄って楽しめそうなベーカリー候補です。",
            "寄り道グルメとしてちょうど良さそうなベーカリーです。",
            "ドライブ途中に立ち寄りたくなるパン系スポットです。"
        ]);
    }

    if (isRestaurant && rating >= 4.2 && reviews >= 100) {
        return pickRandomMessage([
            "人気があり、目的地グルメとして選びやすそうなお店です。",
            "しっかりごはんを楽しみたい日に向いていそうな人気店です。",
            "ツーリングの寄り道先として満足感が期待できそうなお店です。"
        ]);
    }

    if (rating >= 4.0) {
        return pickRandomMessage([
            "立ち寄りグルメとして選びやすそうなお店です。",
            "気軽にごはんを楽しみたい日に良さそうな候補です。",
            "途中でおいしいものを食べたい日に合いそうなお店です。"
        ]);
    }

    return pickRandomMessage([
        "気になるグルメスポットとして立ち寄ってみたくなる候補です。",
        "ドライブ途中のごはん候補としてちょうど良さそうです。",
        "気分転換もかねて楽しめそうなグルメ候補です。"
    ]);
}

// ===============================
// 履歴保存
// ===============================
const DOKOIKO_HISTORY_KEY = "dokoiko_history";
const DOKOIKO_HISTORY_MAX = 6;

function saveGourmetHistoryItem(data) {
    let current = [];

    try {
        current = JSON.parse(localStorage.getItem(DOKOIKO_HISTORY_KEY) || "[]");
    } catch (e) {
        current = [];
    }

    const historyItem = {
        savedAt: new Date().toISOString(),
        sourceType: "gourmet",
        sourceLabel: "グルメ版",
        genreName: "グルメ",
        placeId: data.placeId || data.place_id || data.name || "",
        ...data
    };

    const filtered = current.filter(item => {
        return !(item.placeId === historyItem.placeId && item.sourceType === historyItem.sourceType);
    });

    filtered.unshift(historyItem);
    localStorage.setItem(DOKOIKO_HISTORY_KEY, JSON.stringify(filtered.slice(0, DOKOIKO_HISTORY_MAX)));
}

// ===============================
// 共有
// ===============================
function shareGourmetResult(index) {
    const card = document.getElementById(`result${index + 1}`);
    if (!card) return;

    const shareUrl = card.dataset.mapUrl || location.href;
    const shareText = card.dataset.shareText || "どこいこMapでグルメスポットを見つけたよ！";

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
// 方角ベースの候補中心点生成
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
// バイカー向けスコア
// ===============================
function getBikerGourmetScore(place) {
    const name = place?.name || "";
    const vicinity = place?.vicinity || "";
    const types = Array.isArray(place?.types) ? place.types.join(" ") : "";
    const text = `${name} ${vicinity} ${types}`;

    let score = 0;

    if (/ラーメン/i.test(text)) score += 22;
    if (/そば|蕎麦/i.test(text)) score += 20;
    if (/うどん/i.test(text)) score += 20;
    if (/定食|食堂/i.test(text)) score += 24;
    if (/パスタ|洋食/i.test(text)) score += 14;
    if (/カレー/i.test(text)) score += 14;
    if (/道の駅/i.test(text)) score += 28;
    if (/フードコート/i.test(text)) score += 18;
    if (/ドライブイン/i.test(text)) score += 24;
    if (/喫茶店|cafe|カフェ/i.test(text)) score += 10;

    if (/restaurant|meal_takeaway|food|cafe/i.test(types)) score += 8;
    if (/bakery/i.test(types)) score += 4;

    if (/駐車場|パーキング|parking|大型車|ロードサイド|国道沿い/i.test(text)) score += 20;
    if (/道の駅|ドライブイン|食堂|フードコート/i.test(text)) score += 10;

    return score;
}

// ===============================
// 出したくない候補を除外
// ===============================
function isExcludedGourmet(place) {
    const name = place?.name || "";
    const vicinity = place?.vicinity || "";
    const types = Array.isArray(place?.types) ? place.types.join(" ") : "";
    const text = `${name} ${vicinity} ${types}`;

    if (/居酒屋|バー/i.test(text)) return true;
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
// 候補中心点を探す
// ===============================
function findValidPoint(startLat, startLng, maxDistance, geocoder, time, highway, attempt = 0) {
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
                    searchThreeGourmet(point.lat, point.lng, point.distanceKm, time, highway);
                    return;
                }
            }

            findValidPoint(startLat, startLng, maxDistance, geocoder, time, highway, attempt + 1);
        }
    );
}

// ===============================
// 1回検索して3つのグルメを作る
// ===============================
async function searchThreeGourmet(lat, lng, distance, time, highway) {
    searchNearbyGourmetOnce(lat, lng, distance, time, highway, async function (results) {
        if (!results || results.length === 0) {
            hideLoadingState();

            for (let i = 0; i < 3; i++) {
                const box = document.getElementById(`result${i + 1}`);
                if (box) box.innerHTML = `<h3>🍽 グルメ</h3>見つかりませんでした`;
            }

            showResultWithEffect();
            document.getElementById("rerollButton").classList.remove("hidden");
            return;
        }

        const usedPlaceIds = new Set();
        const maxDistance = maxDistanceByTime(time, highway);

        for (let index = 0; index < 3; index++) {
            const box = document.getElementById(`result${index + 1}`);
            if (!box) continue;

            const spot = pickBestGourmetSmart(results, usedPlaceIds, time, maxDistance);

            if (!spot) {
                box.innerHTML = `<h3>🍽 グルメ</h3>見つかりませんでした`;
                continue;
            }

            usedPlaceIds.add(spot.place_id);

            const routeInfo = await getRouteInfoToSpot(spot, highway);

            renderGourmetResultCard(
                box,
                spot,
                distance,
                time,
                highway,
                index,
                routeInfo
            );
        }

        hideLoadingState();
        showResultWithEffect();
        document.getElementById("rerollButton").classList.remove("hidden");
    });
}

// ===============================
// Places API検索：1回だけ回す
// ===============================
function searchNearbyGourmetOnce(lat, lng, distance, time, highway, callback, retry = 0) {
    const service = new google.maps.places.PlacesService(map);

    let radius = Math.max(distance * 1000, SEARCH_RADIUS_MIN);
    if (time <= 30) radius = Math.max(distance * 1000, 2000);
    if (retry === 1) radius *= 1.8;

    const keywordSets = [
        "ラーメン 定食 食堂 そば うどん 道の駅 カフェ ドライブイン",
        "グルメ ランチ レストラン フードコート カレー 洋食",
        "飲食店 ご当地グルメ 人気店"
    ];

    const searchKeyword = keywordSets[Math.min(retry, keywordSets.length - 1)];

    service.nearbySearch(
        {
            location: { lat: lat, lng: lng },
            radius: radius,
            type: "restaurant",
            keyword: searchKeyword
        },
        function (results, status) {
            if (
                status !== google.maps.places.PlacesServiceStatus.OK ||
                !results ||
                results.length === 0
            ) {
                if (retry < SEARCH_RETRY_LIMIT) {
                    searchNearbyGourmetOnce(lat, lng, distance, time, highway, callback, retry + 1);
                    return;
                }

                callback([]);
                return;
            }

            const filtered = results.filter(place => {
                if (!place || !place.place_id) return false;
                if (!place.geometry || !place.geometry.location) return false;
                if (isExcludedGourmet(place)) return false;
                return true;
            });

            callback(filtered.length > 0 ? filtered : results);
        }
    );
}

// ===============================
// グルメ候補をスコアで選ぶ
// ===============================
function pickBestGourmetSmart(results, usedPlaceIds, time, maxDistance) {
    let candidates = results.filter(place => {
        if (!place || !place.place_id) return false;
        if (usedPlaceIds.has(place.place_id)) return false;
        if (!place.geometry || !place.geometry.location) return false;
        if (isExcludedGourmet(place)) return false;
        return true;
    });

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
            getBikerGourmetScore(a) +
            getDistanceScore(aDistance, maxDistance, time) +
            Number(a.rating || 0) * 5 +
            Math.min(Number(a.user_ratings_total || 0), 300) * 0.05;

        const bScore =
            getBikerGourmetScore(b) +
            getDistanceScore(bDistance, maxDistance, time) +
            Number(b.rating || 0) * 5 +
            Math.min(Number(b.user_ratings_total || 0), 300) * 0.05;

        return bScore - aScore;
    });

    const top = candidates.slice(0, 6);
    return top[Math.floor(Math.random() * Math.min(top.length, 3))] || top[0];
}

// ===============================
// GoogleマップURL生成
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
function renderGourmetResultCard(box, spot, distance, time, highway, index, routeInfo = null) {
    const slat = spot.geometry.location.lat();
    const slng = spot.geometry.location.lng();
    const rating = spot.rating || "評価なし";
    const reviews = spot.user_ratings_total || 0;
    const photoUrl = getSpotPhotoUrl(spot);
    const typeLabel = formatGourmetTypes(spot.types, spot);
    const catchCopy = buildGourmetCatchCopy(spot);
    const mapUrl = buildGoogleMapsUrl(spot, highway);

    const shareText =
        `${spot.name} を見つけたよ！ 🍽グルメ / ⭐${rating} #どこいこMap`;

    const marker = new google.maps.Marker({
        position: { lat: slat, lng: slng },
        map: map,
        icon: {
            url: `${IMAGE_BASE_PATH}/red_dog.png`,
            scaledSize: new google.maps.Size(50, 50)
        }
    });

    spotMarkers.push(marker);

    const bounds = new google.maps.LatLngBounds();
    if (startMarker && startMarker.getPosition) bounds.extend(startMarker.getPosition());

    spotMarkers.forEach(m => {
        if (m && m.getPosition) bounds.extend(m.getPosition());
    });

    map.fitBounds(bounds);

    const displayDistanceKm = routeInfo ? routeInfo.distanceKm : Number(distance.toFixed(1));
    const displayDistanceText = routeInfo ? routeInfo.distanceText : `約${distance.toFixed(1)}km`;
    const displayDurationText = routeInfo ? routeInfo.durationText : `${time}分以内`;

    saveGourmetHistoryItem({
        pageType: "gourmet",
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
🍽 グルメ</div>

${photoUrl ? `
<div class="spot-photo-wrap">
<img src="${photoUrl}" alt="${spot.name}" class="spot-photo" loading="lazy">
</div>
` : ""}

<div class="spot-name">${spot.name}</div>
<div class="spot-copy">${catchCopy || "気になるグルメスポットです。"}</div>

📍 ${spot.vicinity || ""}<br>
⭐ ${rating} (${reviews}件)<br>
🏷 ${typeLabel}<br>
🚗 ${displayDistanceText}<br>
⏱ ${displayDurationText}<br>
🛣 ${time === 30 ? "下道のみ" : (highway === "yes" ? "高速あり" : "下道のみ")}<br><br>

<div class="result-actions">
<a href="${mapUrl}" target="_blank" rel="noopener noreferrer">
🧭 Googleマップでナビ
</a>

<button type="button" class="share-button" onclick="shareGourmetResult(${index})">
共有する
</button>
</div>
`;
}

// ===============================
// UI表示アニメ
// ===============================
function showResultWithEffect() {
    const box = document.getElementById("results");
    if (!box) return;

    box.classList.remove("hidden");
    box.classList.remove("show");

    void box.offsetWidth;

    box.classList.add("show");
    launchConfetti();
}

// ===============================
// 紙吹雪
// ===============================
function launchConfetti() {
    const colors = ["#ff7675", "#74b9ff", "#55efc4", "#ffeaa7", "#a29bfe"];

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
function rerollGourmet() {
    if (!startLat || !startLng) {
        alert("先に検索してね！");
        return;
    }

    const time = Number(document.getElementById("timeSelect").value);
    const highway = document.getElementById("highway").value;
    const geocoder = new google.maps.Geocoder();
    const maxDistance = maxDistanceByTime(time, highway);

    clearResults();
    showLoadingState("検索中...", "おいしそうなスポットを探してるよ");

    findValidPoint(startLat, startLng, maxDistance, geocoder, time, highway);
}

// ===============================
// 現在地取得
// ===============================
function getCurrentLocation() {
    if (!navigator.geolocation) {
        alert("このブラウザでは位置情報が使えません");
        return;
    }

    navigator.geolocation.getCurrentPosition(function (position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const geocoder = new google.maps.Geocoder();

        geocoder.geocode({ location: { lat: lat, lng: lng } }, function (results, status) {
            if (status === "OK" && results[0]) {
                document.getElementById("startLocation").value = results[0].formatted_address;
            } else {
                alert("住所を取得できませんでした");
            }
        });
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
// 結果枠隠し
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
