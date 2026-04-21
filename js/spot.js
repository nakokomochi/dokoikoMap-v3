let selectedCity = "";
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
let completedSpotResults = 0;

// API使用回数を抑えるための調整
const MAX_POINT_ATTEMPTS = 8;
const SEARCH_RADIUS_MIN = 5000;
const SEARCH_RETRY_LIMIT = 1;

// ルート判定用
const ROUTE_CHECK_CANDIDATES_PER_GENRE = 4;
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
function searchSpot() {
    const startAddress = document.getElementById("startLocation").value;
    startAddressGlobal = startAddress;

    if (!startAddress) {
        alert("出発地を入力してね！");
        return;
    }

    const time = Number(document.getElementById("timeSelect").value);
    const highway = document.getElementById("highway").value;

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
        resultsBox.classList.add("hidden");

        resultsBox.innerHTML = `
            <div id="result1" class="result-item"></div>
            <div id="result2" class="result-item"></div>
            <div id="result3" class="result-item"></div>
        `;
    }

    if (loadingTimer) {
        clearInterval(loadingTimer);
        loadingTimer = null;
    }

    completedSpotResults = 0;

    spotMarkers.forEach(m => m.setMap(null));
    spotMarkers = [];

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
    if (time === 60) return maxDistance * (highway === "yes" ? 0.40 : 0.30);
    if (time === 90) return maxDistance * (highway === "yes" ? 0.60 : 0.50);
    if (time === 120) return maxDistance * (highway === "yes" ? 0.70 : 0.60);
    return 0;
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
// 候補中心点を探す
// ===============================
function findValidPoint(startLat, startLng, maxDistance, geocoder, time, highway, attempt = 0) {
    if (attempt > MAX_POINT_ATTEMPTS) {
        hideLoadingState();
        alert("海に当たってしまいました、もう一度回してください");
        return;
    }

    const minDistance = getMinDistanceByTime(maxDistance, time, highway);
    const point = createRandomPoint(startLat, startLng, minDistance, maxDistance);

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
                    searchThreeGenres(point.lat, point.lng, point.distanceKm, time, highway);
                    return;
                }
            }

            findValidPoint(startLat, startLng, maxDistance, geocoder, time, highway, attempt + 1);
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
// 履歴保存
// ===============================
function saveSpotHistoryItem(data) {
    const key = "dokoiko_spot_history";
    const current = JSON.parse(localStorage.getItem(key) || "[]");

    const filtered = current.filter(item => {
        return !(item.placeId === data.placeId && item.genreName === data.genreName);
    });

    filtered.unshift({
        savedAt: new Date().toISOString(),
        ...data
    });

    const trimmed = filtered.slice(0, 20);
    localStorage.setItem(key, JSON.stringify(trimmed));
}

// ===============================
// 共有
// ===============================
function shareSpotResult(index) {
    const card = document.getElementById(`result${index + 1}`);
    if (!card) return;

    const shareUrl = card.dataset.mapUrl || location.href;
    const shareText = card.dataset.shareText || "どこいこMapで行き先を見つけたよ！";

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
// ジャンル定義
// ===============================
function getSpotGenreGroups() {
    return [
        {
            name: "🔭観光スポット⛩",
            keywords: ["展望台", "絶景", "道の駅", "神社", "寺", "博物館"],
            color: "red"
        },
        {
            name: "🍽グルメ🍜",
            keywords: ["ラーメン", "カフェ", "食堂", "レストラン", "道の駅グルメ"],
            color: "green"
        },
        {
            name: "🌳自然スポット🍃",
            keywords: ["滝", "湖", "渓谷", "ダム", "高原", "公園"],
            color: "orange"
        }
    ];
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
                destination: {
                    placeId: spot.place_id
                },
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
// 実ルートで候補を選ぶ
// ===============================
async function pickBestSpotForGenreByRoute(results, group, usedPlaceIds, time, highway) {
    let candidates = results.filter(place => {
        return place.place_id && !usedPlaceIds.has(place.place_id);
    });

    if (candidates.length === 0) {
        return null;
    }

    candidates.sort((a, b) => {
        return getGenreScore(b, group, time) - getGenreScore(a, group, time);
    });

    const topCandidates = candidates.slice(0, ROUTE_CHECK_CANDIDATES_PER_GENRE);
    const range = getRouteTimeRange(time);
    const checked = [];

    for (const spot of topCandidates) {
        const routeInfo = await getRouteInfoToSpot(spot, highway);

        if (!routeInfo) continue;

        const diff = Math.abs(routeInfo.durationMinutes - time);

        checked.push({
            spot,
            routeInfo,
            diff,
            inRange:
                routeInfo.durationMinutes >= range.min &&
                routeInfo.durationMinutes <= range.max
        });
    }

    const valid = checked.filter(item => item.inRange);

    if (valid.length > 0) {
        valid.sort((a, b) => {
            if (a.diff !== b.diff) return a.diff - b.diff;
            return getGenreScore(b.spot, group, time) - getGenreScore(a.spot, group, time);
        });
        return valid[0];
    }

    if (checked.length > 0) {
        checked.sort((a, b) => {
            if (a.diff !== b.diff) return a.diff - b.diff;
            return getGenreScore(b.spot, group, time) - getGenreScore(a.spot, group, time);
        });
        return checked[0];
    }

    return null;
}

// ===============================
// 1回検索して3ジャンルを作る
// ===============================
function searchThreeGenres(lat, lng, distance, time, highway) {
    completedSpotResults = 0;

    searchNearbySpotsOnce(lat, lng, distance, time, highway, async function (results) {
        const genreGroups = getSpotGenreGroups();

        if (!results || results.length === 0) {
            hideLoadingState();

            genreGroups.forEach((group, index) => {
                const box = document.getElementById(`result${index + 1}`);
                if (box) {
                    box.innerHTML = `
<h3>${group.name}</h3>
見つかりませんでした
`;
                }
            });

            showResultWithEffect();
            document.getElementById("rerollButton").classList.remove("hidden");
            return;
        }

        const usedPlaceIds = new Set();

        for (let index = 0; index < genreGroups.length; index++) {
            const group = genreGroups[index];
            const box = document.getElementById(`result${index + 1}`);

            if (!box) continue;

            const pickedData = await pickBestSpotForGenreByRoute(results, group, usedPlaceIds, time, highway);

            if (!pickedData) {
                box.innerHTML = `
<h3>${group.name}</h3>
見つかりませんでした
`;
                completedSpotResults++;
                continue;
            }

            usedPlaceIds.add(pickedData.spot.place_id);
            renderSpotResultCard(
                box,
                pickedData.spot,
                group,
                distance,
                time,
                highway,
                index,
                pickedData.routeInfo
            );
            completedSpotResults++;
        }

        hideLoadingState();
        showResultWithEffect();
        document.getElementById("rerollButton").classList.remove("hidden");
    });
}

// ===============================
// 1回検索用
// ===============================
function searchNearbySpotsOnce(lat, lng, distance, time, highway, callback, retry = 0) {
    const service = new google.maps.places.PlacesService(map);

    let radius = Math.max(distance * 1000, SEARCH_RADIUS_MIN);
    if (retry === 1) radius *= 1.8;

    const broadKeywordSets = [
        "展望台 絶景 道の駅 神社 寺 博物館 ラーメン カフェ 食堂 滝 湖 渓谷 ダム 高原 公園",
        "観光 グルメ 自然 立ち寄り 景色 ご当地",
        "観光名所 レストラン 自然公園 景勝地"
    ];

    const searchKeyword = broadKeywordSets[Math.min(retry, broadKeywordSets.length - 1)];

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
                    searchNearbySpotsOnce(lat, lng, distance, time, highway, callback, retry + 1);
                    return;
                }

                callback([]);
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

            callback(filtered.length > 0 ? filtered : results);
        }
    );
}

// ===============================
// ジャンルごとの候補点数計算
// ===============================
function getGenreScore(place, group, time) {
    const name = place.name || "";
    const vicinity = place.vicinity || "";
    const types = Array.isArray(place.types) ? place.types.join(" ") : "";
    const text = `${name} ${vicinity} ${types}`;
    const rating = Number(place.rating || 0);
    const reviews = Number(place.user_ratings_total || 0);

    let score = rating * 5 + Math.min(reviews, 300) * 0.05;

    if (group.name.includes("観光")) {
        if (/展望台|絶景|景勝地|道の駅|神社|寺|博物館|美術館|観光/i.test(text)) score += 18;
        if (/shopping_mall|museum|art_gallery|tourist_attraction|shrine|temple/i.test(types)) score += 12;
        if (/ラーメン|カフェ|食堂|restaurant|cafe/i.test(text)) score -= 10;
        if (/滝|湖|渓谷|ダム|高原|park|natural_feature/i.test(text)) score -= 4;
    }

    if (group.name.includes("グルメ")) {
        if (/ラーメン|カフェ|食堂|レストラン|restaurant|cafe|bakery|meal_takeaway|food/i.test(text)) score += 20;
        if (/restaurant|cafe|food|bakery/i.test(types)) score += 14;
        if (/道の駅/i.test(text)) score += 6;
        if (/神社|寺|展望台|滝|渓谷|湖|ダム/i.test(text)) score -= 8;
    }

    if (group.name.includes("自然")) {
        if (/滝|湖|渓谷|ダム|高原|公園|自然|山|海|岬|展望台/i.test(text)) score += 18;
        if (/park|campground|natural_feature|tourist_attraction/i.test(types)) score += 12;
        if (/restaurant|cafe|食堂|ラーメン/i.test(text)) score -= 10;
        if (/神社|寺/i.test(text)) score -= 4;
    }

    if (time >= 90 && /展望台|絶景|景勝地|高原|海岸|渓谷|ダム|湖/i.test(text)) {
        score += 3;
    }

    return score;
}

// ===============================
// ジャンルごとにベスト候補を選ぶ（旧構造維持用）
// ===============================
function pickBestSpotForGenre(results, group, usedPlaceIds, time) {
    let candidates = results.filter(place => {
        return place.place_id && !usedPlaceIds.has(place.place_id);
    });

    if (candidates.length === 0) {
        return null;
    }

    candidates.sort((a, b) => {
        return getGenreScore(b, group, time) - getGenreScore(a, group, time);
    });

    const top = candidates.slice(0, 6);
    if (top.length === 0) return null;

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
function renderSpotResultCard(box, spot, group, distance, time, highway, index, routeInfo = null) {
    const genreName = group.name;
    const keyword = pickBestKeywordLabel(spot, group);
    const rating = spot.rating || "評価なし";
    const reviews = spot.user_ratings_total || 0;
    const photoUrl = getSpotPhotoUrl(spot);
    const typeLabel = formatSpotTypes(spot.types || [], genreName, keyword);
    const catchCopy = buildSpotCatchCopy(spot, genreName, keyword);

    const mapUrl = buildGoogleMapsUrl(spot, highway);

    const shareText =
        `${spot.name} を見つけたよ！ ${genreName} / ⭐${rating} #どこいこMap`;

    let dogImage = "image/yellow_dog.png";
    if (genreName.includes("グルメ")) dogImage = "image/red_dog.png";
    if (genreName.includes("自然")) dogImage = "image/green_dog.png";

    const slat = spot.geometry.location.lat();
    const slng = spot.geometry.location.lng();

    const marker = new google.maps.Marker({
        position: { lat: slat, lng: slng },
        map: map,
        icon: {
            url: dogImage,
            scaledSize: new google.maps.Size(50, 50)
        }
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
    const displayDurationText = routeInfo ? routeInfo.durationText : `${time}分`;

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
    <img src="${dogImage}" class="genre-dog">
    ${genreName}
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

🎯ジャンル：${keyword}<br><br>

🚗 ${displayDistanceText}<br>

⏱ ${displayDurationText}<br>

🛣 ${time === 30 ? "下道のみ" : (highway === "yes" ? "高速あり" : "下道のみ")}<br><br>

<div class="result-actions">
    <button type="button" a href="${mapUrl}" target="_blank" rel="noopener noreferrer">
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
