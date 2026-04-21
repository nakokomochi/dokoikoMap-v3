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
function saveTourismHistoryItem(data) {
    const key = "dokoiko_tourism_history";
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
// ランダム座標生成
// 観光版は30分でも近場固定にしない
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
// 最大距離計算
// ===============================
function maxDistanceByTime(time, highway) {
    const hours = time / 60;
    const speed = highway === "yes" ? HIGHWAY_SPEED : LOCAL_SPEED;
    return hours * speed;
}

// ===============================
// 最小距離計算（ドーナツ型用）
// ===============================
function getMinDistanceByTime(maxDistance, time, highway) {
    if (time === 30) return 0;
    if (time === 60) return maxDistance * 0.38;
    if (time === 90) return maxDistance * 0.45;
    if (time === 120) return maxDistance * 0.55;
    return 0;
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
    if (/museum|art_gallery|museum|博物館|美術館|資料館/i.test(text)) score += 10;
    if (/park|tourist_attraction|point_of_interest/i.test(types)) score += 8;

    // 駐車や休憩に寄せたい雰囲気
    if (/駐車場|パーキング|parking|大型車/i.test(text)) score += 16;
    if (/道の駅|展望台|公園|ダム/i.test(text)) score += 8;

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

    // tourismでは強すぎる除外は避ける
    if (/ラブホテル|ホテル街/i.test(text)) return true;

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
async function pickBestTourismByRoute(results, time, highway, usedPlaceIds) {
    if (!results || results.length === 0) return null;

    let filtered = results.filter(place => {
        if (!place || !place.place_id) return false;
        if (usedPlaceIds.has(place.place_id)) return false;
        if (isExcludedTourism(place)) return false;
        return true;
    });

    let highRated = filtered.filter(r => (r.rating || 0) >= 4.0);
    if (highRated.length > 0) {
        filtered = highRated;
    }

    filtered = filtered.filter(place => {
        const plat = place.geometry.location.lat();
        const plng = place.geometry.location.lng();

        for (const marker of spotMarkers) {
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
            return place.place_id && !usedPlaceIds.has(place.place_id) && !isExcludedTourism(place);
        });
    }

    if (filtered.length === 0) return null;

    filtered.sort((a, b) => {
        const scoreA =
            getBikerTourismScore(a) +
            Number(a.rating || 0) * 5 +
            Math.min(Number(a.user_ratings_total || 0), 300) * 0.05;

        const scoreB =
            getBikerTourismScore(b) +
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
            const scoreA = getBikerTourismScore(a.spot);
            const scoreB = getBikerTourismScore(b.spot);
            if (scoreB !== scoreA) return scoreB - scoreA;
            return a.diff - b.diff;
        });

        const pool = valid.slice(0, Math.min(valid.length, 3));
        return pool[Math.floor(Math.random() * pool.length)];
    }

    if (checked.length > 0) {
        checked.sort((a, b) => {
            const scoreA = getBikerTourismScore(a.spot);
            const scoreB = getBikerTourismScore(b.spot);
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

    const minDistance = getMinDistanceByTime(maxDistance, time, highway);
    const point = createRandomPoint(startLat, startLng, minDistance, maxDistance);

    geocoder.geocode({ location: { lat: point.lat, lng: point.lng } }, function (results, status) {
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
    });
}

// ===============================
// 3つの観光検索
// ===============================
async function searchThreeTourism(lat, lng, distance, time, highway) {
    const usedPlaceIds = new Set();

    for (let i = 0; i < 3; i++) {
        await searchNearbyTourism(lat, lng, distance, time, highway, i, usedPlaceIds, 0);
    }

    hideLoadingState();
    showResultWithEffect();

    const rerollButton = document.getElementById("rerollButton");
    if (rerollButton) {
        rerollButton.classList.remove("hidden");
    }
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
// Places API検索（観光版）
// ===============================
function searchNearbyTourism(lat, lng, distance, time, highway, index, usedPlaceIds, retry = 0) {
    return new Promise((resolve) => {
        const service = new google.maps.places.PlacesService(map);
        const box = document.getElementById(`result${index + 1}`);

        let radius = Math.max(distance * 1000, 5000);
        if (retry === 1) radius *= 1.8;
        if (retry === 2) radius *= 2.5;

        const tourismKeywordSets = [
            ["展望台", "絶景", "景勝地", "ダム"],
            ["道の駅", "観光案内所", "公園"],
            ["神社", "寺", "高原"],
            ["博物館", "美術館", "資料館"],
            ["湖", "滝", "渓谷"],
            ["水族館", "動物園"],
            ["ショッピングモール", "レジャー"]
        ];

        let selectedKeywords;

        if (retry === 0) {
            selectedKeywords =
                tourismKeywordSets[Math.floor(Math.random() * tourismKeywordSets.length)];
        } else if (retry === 1) {
            selectedKeywords = ["道の駅", "公園", "展望台", "ダム"];
        } else if (retry === 2) {
            selectedKeywords = ["観光", "レジャー", "名所", "絶景"];
        } else {
            selectedKeywords = ["観光スポット"];
        }

        const keyword = selectedKeywords.join(" ");

        service.nearbySearch(
            {
                location: { lat: lat, lng: lng },
                radius: radius,
                keyword: keyword
            },
            async function (results, status) {
                if (status !== google.maps.places.PlacesServiceStatus.OK || !results || results.length === 0) {
                    if (retry < 3) {
                        resolve(searchNearbyTourism(lat, lng, distance, time, highway, index, usedPlaceIds, retry + 1));
                        return;
                    }

                    if (box) {
                        box.innerHTML = `<h3>🏯 観光</h3>見つかりませんでした`;
                    }

                    resolve();
                    return;
                }

                const pickedData = await pickBestTourismByRoute(results, time, highway, usedPlaceIds);

                if (!pickedData || !pickedData.spot) {
                    if (retry < 3) {
                        resolve(searchNearbyTourism(lat, lng, distance, time, highway, index, usedPlaceIds, retry + 1));
                        return;
                    }

                    if (box) {
                        box.innerHTML = `<h3>🏯 観光</h3>見つかりませんでした`;
                    }

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
                const typeLabel = formatTourismTypes(spot.types, spot.name);
                const catchCopy = buildTourismCatchCopy(spot);

                const mapUrl = buildGoogleMapsUrl(spot, highway);

                const shareText =
                    `${spot.name} を見つけたよ！ 🏯観光 / ⭐${rating} #どこいこMap`;

                const marker = new google.maps.Marker({
                    position: { lat: slat, lng: slng },
                    map: map,
                    icon: {
                        url: "../image/yellow_dog.png",
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
<img src="../image/yellow_dog.png" class="genre-dog">
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
    timeSelect.addEventListener("change", updateHighwayControl);
    updateHighwayControl();
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
