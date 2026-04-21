let map;
let marker;
let startMarker;
let startLat;
let startLng;
let spotMarkers = [];
let startAddressGlobal = "";

const HIGHWAY_SPEED = 80; // km/h
const LOCAL_SPEED = 40;

const TOKYO_STATION_POSITION = {
    center: { lat: 35.681236, lng: 139.767125 },
    zoom: 12,
    gestureHandling: "greedy"
};

const EXCLUDE_DISTANCE_KM = 3;
let loadingTimer = null;

// ルート判定用
const ROUTE_CHECK_CANDIDATES = 4;
const TIME_TOLERANCE_MINUTES = 20;

// ===============================
// Google Map 初期表示
// ===============================
function initMap() {
    map = new google.maps.Map(
        document.getElementById("map"),
        TOKYO_STATION_POSITION
    );
}

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

    if (/パスタ|洋食/i.test(text)) {
        return pickRandomMessage([
            "ツーリング途中の寄り道ごはんとして楽しめそうな洋食候補です。",
            "景色もごはんも楽しみたい日に合いそうな洋食系の候補です。",
            "少し気分を変えて立ち寄りたくなる洋食候補です。"
        ]);
    }

    if (/フードコート|ドライブイン/i.test(text)) {
        return pickRandomMessage([
            "休憩と食事をまとめて済ませやすそうな候補です。",
            "バイク途中にサッと入りやすそうな候補です。",
            "立ち寄りやすさ重視で選びやすそうな候補です。"
        ]);
    }

    const isCafe = types.includes("cafe");
    const isBakery = types.includes("bakery");
    const isRestaurant = types.includes("restaurant");

    if (isCafe) {
        if (rating >= 4.2 && reviews >= 100) {
            return pickRandomMessage([
                "休憩しながらゆったり過ごしたい日に良さそうな人気カフェです。",
                "ひと休みしたいツーリング途中に寄りたくなるカフェ候補です。",
                "景色のいい道を走ったあとに立ち寄りたくなるカフェ候補です。"
            ]);
        }

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
function saveGourmetHistoryItem(data) {
    const key = "dokoiko_gourmet_history";
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
// ランダム座標生成（30分は近場寄り）
// ===============================
function createRandomPoint(lat, lng, maxDistanceKm, time = 60) {
    let effectiveMaxDistance = maxDistanceKm;

    if (time <= 30) {
        effectiveMaxDistance = Math.min(maxDistanceKm, 5);
    }

    const radiusKm = Math.random() * effectiveMaxDistance;
    const radiusInDegrees = radiusKm / 111;

    const u = Math.random();
    const v = Math.random();
    const w = radiusInDegrees * Math.sqrt(u);
    const t = 2 * Math.PI * v;

    const newLat = lat + w * Math.cos(t);
    const newLng = lng + w * Math.sin(t) / Math.cos(lat * Math.PI / 180);

    return { lat: newLat, lng: newLng, distanceKm: radiusKm };
}

// ===============================
// 最大距離計算
// ===============================
function maxDistanceByTime(time, highway) {
    const hours = time / 60;
    let speed = highway === "yes" ? HIGHWAY_SPEED : LOCAL_SPEED;
    return hours * speed;
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

    // 駐車しやすそうな雰囲気を少し優先
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
// 実ルート許容範囲
// ===============================
function getRouteTimeRange(time) {
    const min = Math.max(10, time - TIME_TOLERANCE_MINUTES);
    const max = time + TIME_TOLERANCE_MINUTES;
    return { min, max };
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
// ルート考慮で候補を1件選ぶ
// ===============================
async function pickBestGourmetByRoute(results, time, highway, usedPlaceIds) {
    if (!results || results.length === 0) return null;

    let filtered = results.filter(place => {
        if (!place || !place.place_id) return false;
        if (usedPlaceIds.has(place.place_id)) return false;
        if (isExcludedGourmet(place)) return false;
        return true;
    });

    let highRated = filtered.filter(r => (r.rating || 0) >= 4.0);
    if (highRated.length > 0) {
        filtered = highRated;
    }

    filtered = filtered.filter(place => {
        const plat = place.geometry.location.lat();
        const plng = place.geometry.location.lng();

        for (let marker of spotMarkers) {
            if (!marker || !marker.getPosition) continue;
            const pos = marker.getPosition();
            if (calcDistance(plat, plng, pos.lat(), pos.lng()) < EXCLUDE_DISTANCE_KM) {
                return false;
            }
        }
        return true;
    });

    if (filtered.length === 0) {
        filtered = results.filter(place => {
            return place.place_id && !usedPlaceIds.has(place.place_id) && !isExcludedGourmet(place);
        });
    }

    if (filtered.length === 0) return null;

    filtered.sort((a, b) => {
        const scoreA =
            getBikerGourmetScore(a) +
            Number(a.rating || 0) * 5 +
            Math.min(Number(a.user_ratings_total || 0), 300) * 0.05;

        const scoreB =
            getBikerGourmetScore(b) +
            Number(b.rating || 0) * 5 +
            Math.min(Number(b.user_ratings_total || 0), 300) * 0.05;

        return scoreB - scoreA;
    });

    const top = filtered.slice(0, ROUTE_CHECK_CANDIDATES);
    if (!top.length) return null;

    const checked = [];
    const range = getRouteTimeRange(time);

    for (const spot of top) {
        const routeInfo = await getRouteInfoToSpot(spot, highway);
        if (!routeInfo) continue;

        checked.push({
            spot,
            routeInfo,
            diff: Math.abs(routeInfo.durationMinutes - time),
            inRange:
                routeInfo.durationMinutes >= range.min &&
                routeInfo.durationMinutes <= range.max
        });
    }

    const valid = checked.filter(item => item.inRange);

    if (valid.length > 0) {
        valid.sort((a, b) => {
            const scoreA = getBikerGourmetScore(a.spot);
            const scoreB = getBikerGourmetScore(b.spot);
            if (scoreB !== scoreA) return scoreB - scoreA;
            return a.diff - b.diff;
        });

        const pool = valid.slice(0, Math.min(valid.length, 3));
        return pool[Math.floor(Math.random() * pool.length)];
    }

    if (checked.length > 0) {
        checked.sort((a, b) => {
            const scoreA = getBikerGourmetScore(a.spot);
            const scoreB = getBikerGourmetScore(b.spot);
            if (scoreB !== scoreA) return scoreB - scoreA;
            return a.diff - b.diff;
        });
        return checked[0];
    }

    return {
        spot: top[0],
        routeInfo: null
    };
}

// ===============================
// ランダムポイント検索
// ===============================
function findValidPoint(startLat, startLng, maxDistance, geocoder, time, highway, attempt = 0) {
    if (attempt > 15) {
        hideLoadingState();
        alert("海に当たってしまいました、もう一度回してください");
        return;
    }

    const point = createRandomPoint(startLat, startLng, maxDistance, time);

    geocoder.geocode({ location: { lat: point.lat, lng: point.lng } }, function (results, status) {
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
    });
}

// ===============================
// 3つのグルメ検索
// ===============================
async function searchThreeGourmet(lat, lng, distance, time, highway) {
    const usedPlaceIds = new Set();

    for (let i = 0; i < 3; i++) {
        await searchNearbyGourmet(lat, lng, distance, time, highway, i, usedPlaceIds, 0);
    }

    hideLoadingState();
    showResultWithEffect();
    document.getElementById("rerollButton").classList.remove("hidden");
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
// Places API検索（グルメ版）
// ===============================
function searchNearbyGourmet(lat, lng, distance, time, highway, index, usedPlaceIds, retry = 0) {
    return new Promise((resolve) => {
        const service = new google.maps.places.PlacesService(map);
        const box = document.getElementById(`result${index + 1}`);

        let radius;
        if (time <= 30) {
            radius = Math.max(distance * 1000, 2000);
        } else {
            radius = Math.max(distance * 1000, 5000);
        }

        if (retry === 1) radius *= 1.8;
        if (retry === 2) radius *= 2.5;

        const keywordSets = [
            "ラーメン 定食 食堂 そば うどん 道の駅 パスタ",
            "フードコート ドライブイン カレー 洋食 カフェ",
            "グルメ ランチ レストラン"
        ];
        const searchKeyword = keywordSets[Math.min(retry, keywordSets.length - 1)];

        service.nearbySearch(
            {
                location: { lat: lat, lng: lng },
                radius: radius,
                type: "restaurant",
                keyword: searchKeyword
            },
            async function (results, status) {
                if (status !== google.maps.places.PlacesServiceStatus.OK || !results || results.length === 0) {
                    if (retry < 2) {
                        resolve(searchNearbyGourmet(lat, lng, distance, time, highway, index, usedPlaceIds, retry + 1));
                        return;
                    }

                    box.innerHTML = `<h3>🍽 グルメ</h3>見つかりませんでした`;
                    resolve();
                    return;
                }

                const pickedData = await pickBestGourmetByRoute(results, time, highway, usedPlaceIds);

                if (!pickedData || !pickedData.spot) {
                    if (retry < 2) {
                        resolve(searchNearbyGourmet(lat, lng, distance, time, highway, index, usedPlaceIds, retry + 1));
                        return;
                    }

                    box.innerHTML = `<h3>🍽 グルメ</h3>見つかりませんでした`;
                    resolve();
                    return;
                }

                const spot = pickedData.spot;
                const routeInfo = pickedData.routeInfo;

                if (spot.place_id) {
                    usedPlaceIds.add(spot.place_id);
                }

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
                        url: "../image/red_dog.png",
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
<img src="../image/red_dog.png" class="genre-dog">
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

                resolve();
            }
        );
    });
}

// ===============================
// UI表示アニメ
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
// ちょっとお祝い用エフェクト
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
        setTimeout(() => { confetti.remove(); }, 4000);
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

// ページ読み込み後イベント
window.addEventListener("DOMContentLoaded", function () {
    const timeSelect = document.getElementById("timeSelect");
    timeSelect.addEventListener("change", updateHighwayControl);
    updateHighwayControl();
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
<img src="../image/dog.png" alt="検索中" class="loading-dog-image">
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
