let map;
let marker;
let startMarker;
let startLat;
let startLng;
let spotMarkers = [];
let currentInfoWindow = null;
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

// tourism.html が themes/tourism.html ならこのまま
const IMAGE_BASE_PATH = "../image";

// API使用回数を抑えるための調整
const MAX_POINT_ATTEMPTS = 8;
const SEARCH_RADIUS_MIN = 5000;
const SEARCH_RETRY_LIMIT = 1;

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
function searchTourism() {
    const startAddress = document.getElementById("startLocation").value;
    startAddressGlobal = startAddress;

    if (!startAddress) {
        alert("出発地を入力してね！");
        return;
    }

    const time = Number(document.getElementById("timeSelect").value);
    const highway = document.getElementById("highway").value;

    clearResults();
    showLoadingState("検索中...", "わんこが観光スポットを探してるよ");

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
function formatTourismTypes(types = [], spotName = "") {
    const joinedName = String(spotName || "");

    if (joinedName.includes("道の駅")) return "道の駅";
    if (/展望台|絶景|景勝地/.test(joinedName)) return "展望・絶景スポット";
    if (/ダム/.test(joinedName)) return "ダム";
    if (/神社/.test(joinedName)) return "神社";
    if (/寺/.test(joinedName)) return "寺";
    if (/公園/.test(joinedName)) return "公園";

    const typeMap = {
        tourist_attraction: "観光スポット",
        museum: "博物館",
        art_gallery: "美術館",
        park: "公園",
        aquarium: "水族館",
        zoo: "動物園",
        amusement_park: "レジャースポット",
        shopping_mall: "ショッピング",
        hindu_temple: "寺院",
        place_of_worship: "名所",
        point_of_interest: "人気スポット",
        establishment: "立ち寄りスポット"
    };

    const labels = types
        .map(type => typeMap[type])
        .filter(Boolean);

    if (labels.length > 0) {
        return [...new Set(labels)].slice(0, 2).join("・");
    }

    return "観光スポット";
}

// ===============================
// ランダム文言
// ===============================
function pickRandomMessage(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return "気になる観光スポットです。";
    }

    return messages[Math.floor(Math.random() * messages.length)];
}

// ===============================
// 軽い説明文
// ===============================
function buildTourismCatchCopy(spot) {
    const rating = Number(spot?.rating || 0);
    const reviews = Number(spot?.user_ratings_total || 0);
    const types = Array.isArray(spot?.types) ? spot.types : [];
    const name = String(spot?.name || "");
    const text = `${name} ${types.join(" ")}`;

    if (name.includes("道の駅")) {
        return pickRandomMessage([
            "休憩も寄り道も楽しみやすい道の駅候補です。",
            "ツーリング途中に立ち寄りやすそうな道の駅です。",
            "ご当地感も味わいやすい道の駅候補です。"
        ]);
    }

    if (/展望台|絶景|景勝地/.test(text)) {
        return pickRandomMessage([
            "景色を楽しみに寄りたくなる展望・絶景スポットです。",
            "走る楽しさの途中に景色も味わえそうな候補です。",
            "ツーリングの立ち寄り先として相性が良さそうな絶景候補です。"
        ]);
    }

    if (/ダム/.test(text)) {
        return pickRandomMessage([
            "バイクで立ち寄る目的地として人気が出やすいダム候補です。",
            "景色や雰囲気を楽しみながら寄り道しやすそうなダムです。",
            "走る途中の目的地としてちょうど良さそうなダム候補です。"
        ]);
    }

    if (/神社|寺|place_of_worship|hindu_temple/.test(text)) {
        return pickRandomMessage([
            "落ち着いて立ち寄りやすそうな神社・寺スポットです。",
            "景色や空気感を楽しみながら寄れそうな候補です。",
            "ツーリング途中の静かな寄り道先として良さそうです。"
        ]);
    }

    if (types.includes("shopping_mall")) {
        return pickRandomMessage([
            "休憩や買い物もあわせて楽しめそうな候補です。",
            "気軽に立ち寄って過ごしやすそうなレジャースポットです。",
            "雨の日の寄り道先としても使いやすそうです。"
        ]);
    }

    if (types.includes("museum") || types.includes("art_gallery")) {
        return pickRandomMessage([
            "その土地らしさを感じながらゆっくり楽しめそうなスポットです。",
            "落ち着いて立ち寄りたい日に合いそうな文化系スポットです。",
            "寄り道しながら雰囲気も楽しめそうな候補です。"
        ]);
    }

    if (types.includes("park")) {
        return pickRandomMessage([
            "景色や空気感を楽しみながら立ち寄れそうなスポットです。",
            "ひと息つきながら寄り道しやすそうな場所です。",
            "のんびり過ごしたい日にちょうど良さそうです。"
        ]);
    }

    if (rating >= 4.2 && reviews >= 100) {
        return pickRandomMessage([
            "評価も口コミ数も高めで、立ち寄り先として期待できそうです。",
            "人気があり、観光寄りの目的地として選びやすそうです。",
            "満足感のある寄り道先になってくれそうな人気スポットです。"
        ]);
    }

    if (rating >= 4.0) {
        return pickRandomMessage([
            "気分転換の寄り道先としてちょうど良さそうです。",
            "ドライブ途中に立ち寄って楽しめそうなスポットです。",
            "その土地らしさを感じに行く候補として良さそうです。"
        ]);
    }

    return pickRandomMessage([
        "気軽な寄り道先として見てみたくなる観光候補です。",
        "ドライブやツーリング途中に立ち寄りやすそうです。",
        "次の目的地候補として雰囲気が良さそうなスポットです。"
    ]);
}

// ===============================
// 履歴保存
// ===============================
const DOKOIKO_HISTORY_KEY = "dokoiko_history";
const DOKOIKO_HISTORY_MAX = 6;

function saveTourismHistoryItem(data) {
    let current = [];

    try {
        current = JSON.parse(localStorage.getItem(DOKOIKO_HISTORY_KEY) || "[]");
    } catch (e) {
        current = [];
    }

    const historyItem = {
        savedAt: new Date().toISOString(),
        sourceType: "tourism",
        sourceLabel: "観光版",
        genreName: "観光",
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
// 共有
// ===============================
function shareTourismResult(index) {
    const card = document.getElementById(`result${index + 1}`);
    if (!card) return;

    const shareUrl = card.dataset.mapUrl || location.href;
    const shareText = card.dataset.shareText || "どこいこMapで観光スポットを見つけたよ！";

    if (navigator.share) {
        navigator.share({
            title: "どこいこMap",
            text: shareText,
            url: shareUrl
        }).catch(() => { });
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
// バイカー向け観光スコア
// ===============================
function getBikerTourismScore(place) {
    const name = place?.name || "";
    const vicinity = place?.vicinity || "";
    const types = Array.isArray(place?.types) ? place.types.join(" ") : "";
    const text = `${name} ${vicinity} ${types}`;

    let score = 0;

    if (/道の駅/i.test(text)) score += 30;
    if (/展望台|絶景|景勝地/i.test(text)) score += 26;
    if (/ダム/i.test(text)) score += 24;
    if (/神社|寺/i.test(text)) score += 18;
    if (/公園|高原|湖|滝|渓谷/i.test(text)) score += 16;
    if (/museum|art_gallery|博物館|美術館|資料館/i.test(text)) score += 10;
    if (/park|tourist_attraction|point_of_interest/i.test(types)) score += 8;

    if (/駐車場|パーキング|parking|大型車/i.test(text)) score += 16;
    if (/道の駅|展望台|公園|ダム/i.test(text)) score += 8;

    // 観光っぽさが弱い候補を軽く下げる
    if (/オフィス|ビル|企業|学校|大学|病院|センター/i.test(text)) score -= 20;
    if (/ラーメン|カフェ|レストラン|食堂|居酒屋/i.test(text)) score -= 8;

    return score;
}

// ===============================
// 除外したい観光候補
// ===============================
function isExcludedTourism(place) {
    const name = place?.name || "";
    const vicinity = place?.vicinity || "";
    const types = Array.isArray(place?.types) ? place.types.join(" ") : "";
    const text = `${name} ${vicinity} ${types}`;

    if (/ラブホテル|ホテル街/i.test(text)) return true;
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
                    searchThreeTourism(point.lat, point.lng, point.distanceKm, time, highway);
                    return;
                }
            }

            findValidPoint(startLat, startLng, maxDistance, geocoder, time, highway, attempt + 1);
        }
    );
}

// ===============================
// 1回検索して3つの観光スポットを作る
// ===============================
async function searchThreeTourism(lat, lng, distance, time, highway) {
    searchNearbyTourismOnce(lat, lng, distance, time, highway, async function (results) {
        if (!results || results.length === 0) {
            hideLoadingState();

            for (let i = 0; i < 3; i++) {
                const box = document.getElementById(`result${i + 1}`);
                if (box) box.innerHTML = `<h3>🏯 観光</h3>見つかりませんでした`;
            }

            showResultWithEffect();

            const rerollButton = document.getElementById("rerollButton");
            if (rerollButton) rerollButton.classList.remove("hidden");

            return;
        }

        const usedPlaceIds = new Set();
        const maxDistance = maxDistanceByTime(time, highway);

        for (let index = 0; index < 3; index++) {
            const box = document.getElementById(`result${index + 1}`);
            if (!box) continue;

            const spot = pickBestTourismSmart(results, usedPlaceIds, time, maxDistance);

            if (!spot) {
                box.innerHTML = `<h3>🏯 観光</h3>見つかりませんでした`;
                continue;
            }

            usedPlaceIds.add(spot.place_id);

            const routeInfo = await getRouteInfoToSpot(spot, highway);

            renderTourismResultCard(
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

        const rerollButton = document.getElementById("rerollButton");
        if (rerollButton) rerollButton.classList.remove("hidden");
    });
}

// ===============================
// Places API検索：1回だけ回す
// ===============================
function searchNearbyTourismOnce(lat, lng, distance, time, highway, callback, retry = 0) {
    const service = new google.maps.places.PlacesService(map);

    let radius = Math.max(distance * 1000, SEARCH_RADIUS_MIN);
    if (retry === 1) radius *= 1.8;

    const keywordSets = [
        "展望台 絶景 景勝地 ダム 道の駅 神社 寺 公園 博物館 美術館 高原 湖 滝 渓谷",
        "観光 名所 レジャー 道の駅 公園 展望台 ダム",
        "観光スポット 人気スポット 景色 立ち寄り"
    ];

    const searchKeyword = keywordSets[Math.min(retry, keywordSets.length - 1)];

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
                    searchNearbyTourismOnce(lat, lng, distance, time, highway, callback, retry + 1);
                    return;
                }

                callback([]);
                return;
            }

            const filtered = results.filter(place => {
                if (!place || !place.place_id) return false;
                if (!place.geometry || !place.geometry.location) return false;
                if (isExcludedTourism(place)) return false;
                return true;
            });

            callback(filtered.length > 0 ? filtered : results);
        }
    );
}

// ===============================
// 観光候補をスコアで選ぶ
// ===============================
function pickBestTourismSmart(results, usedPlaceIds, time, maxDistance) {
    let candidates = results.filter(place => {
        if (!place || !place.place_id) return false;
        if (usedPlaceIds.has(place.place_id)) return false;
        if (!place.geometry || !place.geometry.location) return false;
        if (isExcludedTourism(place)) return false;
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
            getBikerTourismScore(a) +
            getDistanceScore(aDistance, maxDistance, time) +
            Number(a.rating || 0) * 5 +
            Math.min(Number(a.user_ratings_total || 0), 300) * 0.05;

        const bScore =
            getBikerTourismScore(b) +
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
// 地図わんこタップで表示
// ===============================
function scrollToTourismResultCard(index) {
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
function renderTourismResultCard(box, spot, distance, time, highway, index, routeInfo = null) {
    const slat = spot.geometry.location.lat();
    const slng = spot.geometry.location.lng();
    const rating = spot.rating || "評価なし";
    const reviews = spot.user_ratings_total || 0;
    const photoUrl = getSpotPhotoUrl(spot);
    const typeLabel = formatTourismTypes(spot.types, spot.name);
    const catchCopy = buildTourismCatchCopy(spot);
    const mapUrl = buildGoogleMapsUrl(spot, highway);

    const shareText =
        `${spot.name} を見つけたよ！ 🏯観光 / ⭐${rating} #どこいこMap`;

    const infoRatingText = spot.rating ? `⭐${spot.rating}` : "評価なし";

    const marker = new google.maps.Marker({
        position: { lat: slat, lng: slng },
        map: map,
        icon: {
            url: `${IMAGE_BASE_PATH}/yellow_dog.png`,
            scaledSize: new google.maps.Size(50, 50)
        },
        title: spot.name
    });

    const infoWindow = new google.maps.InfoWindow({
        content: `
        <div class="dog-pin-info">
            <div class="dog-pin-info-title">${spot.name}</div>
            <div class="dog-pin-info-rating">${infoRatingText}</div>
            <button type="button" class="dog-pin-info-button" onclick="scrollToTourismResultCard(${index})">
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

    const displayDistanceKm = routeInfo ? routeInfo.distanceKm : Number(distance.toFixed(1));
    const displayDistanceText = routeInfo ? routeInfo.distanceText : `約${distance.toFixed(1)}km`;
    const displayDurationText = routeInfo ? routeInfo.durationText : `${time}分以内`;

    saveTourismHistoryItem({
        pageType: "tourism",
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
<img src="${IMAGE_BASE_PATH}/yellow_dog.png" class="genre-dog">
🏯 観光</div>

${photoUrl ? `
<div class="spot-photo-wrap">
<img src="${photoUrl}" alt="${spot.name}" class="spot-photo" loading="lazy">
</div>
` : ""}

<div class="spot-name">${spot.name}</div>
<div class="spot-copy">${catchCopy || "気になる観光スポットです。"}</div>

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

<button type="button" class="share-button" onclick="shareTourismResult(${index})">
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
function rerollTourism() {
    if (!startLat || !startLng) {
        alert("先に検索してね！");
        return;
    }

    const time = Number(document.getElementById("timeSelect").value);
    const highway = document.getElementById("highway").value;
    const geocoder = new google.maps.Geocoder();
    const maxDistance = maxDistanceByTime(time, highway);

    clearResults();
    showLoadingState("検索中...", "わんこが観光スポットを探してるよ");

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
function showLoadingState(message = "検索中...", subMessage = "わんこが楽しそうな場所を探してるよ") {
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
