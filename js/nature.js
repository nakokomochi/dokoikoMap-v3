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
function searchNature() {
    const startAddress = document.getElementById("startLocation").value;
    startAddressGlobal = startAddress;

    if (!startAddress) {
        alert("出発地を入力してね！");
        return;
    }

    const time = Number(document.getElementById("timeSelect").value);
    const highway = document.getElementById("highway").value;

    clearResults();
    showLoadingState("検索中...", "わんこが自然スポットを探してるよ");

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
function formatNatureTypes(types = [], spotName = "") {
    const joinedName = String(spotName || "");

    if (joinedName.includes("滝")) return "滝";
    if (joinedName.includes("湖")) return "湖";
    if (joinedName.includes("渓谷")) return "渓谷";
    if (joinedName.includes("高原")) return "高原";
    if (joinedName.includes("展望台")) return "展望台";

    const typeMap = {
        park: "公園",
        campground: "キャンプ場",
        tourist_attraction: "自然スポット",
        natural_feature: "自然地形",
        point_of_interest: "人気スポット",
        establishment: "立ち寄りスポット"
    };

    const labels = types
        .map(type => typeMap[type])
        .filter(Boolean);

    if (labels.length > 0) {
        return [...new Set(labels)].slice(0, 2).join("・");
    }

    return "自然スポット";
}

// ===============================
// ランダム文言
// ===============================
function pickRandomMessage(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return "気になる自然スポットです。";
    }

    return messages[Math.floor(Math.random() * messages.length)];
}

// ===============================
// 軽い説明文
// ===============================
function buildNatureCatchCopy(spot) {
    const rating = Number(spot?.rating || 0);
    const reviews = Number(spot?.user_ratings_total || 0);
    const types = Array.isArray(spot?.types) ? spot.types : [];
    const name = String(spot?.name || "");

    if (name.includes("滝")) {
        return pickRandomMessage([
            "景色と空気感を楽しみに立ち寄りたくなる滝スポットです。",
            "少し非日常感を味わいたい日に合いそうな滝候補です。",
            "自然を感じながら寄り道しやすそうな滝スポットです。"
        ]);
    }

    if (name.includes("湖") || name.includes("沼")) {
        return pickRandomMessage([
            "水辺の景色を眺めながらゆったりできそうな候補です。",
            "のんびり景色を楽しみたい日に良さそうな水辺スポットです。",
            "静かな景色を楽しみに立ち寄れそうな候補です。"
        ]);
    }

    if (name.includes("渓谷") || name.includes("高原")) {
        return pickRandomMessage([
            "自然をしっかり感じたい日に向いていそうな候補です。",
            "景色を楽しみながら走る目的地として良さそうです。",
            "空気感ごと楽しみに行きたくなる自然スポットです。"
        ]);
    }

    if (types.includes("park")) {
        return pickRandomMessage([
            "気軽に立ち寄って自然を感じやすそうなスポットです。",
            "ひと息つきながら景色を楽しめそうな公園候補です。",
            "ドライブ途中の寄り道先として使いやすそうです。"
        ]);
    }

    if (rating >= 4.2 && reviews >= 100) {
        return pickRandomMessage([
            "評価も口コミ数も高めで、景色に期待できそうな人気スポットです。",
            "人気があり、自然を感じる目的地として選びやすそうです。",
            "満足感のある寄り道先になってくれそうな自然候補です。"
        ]);
    }

    if (rating >= 4.0) {
        return pickRandomMessage([
            "自然を感じながら気分転換できそうなスポットです。",
            "ドライブやツーリング途中に立ち寄りやすそうです。",
            "景色を楽しみに寄ってみたくなる候補です。"
        ]);
    }

    return pickRandomMessage([
        "気軽な自然寄りの寄り道先として良さそうです。",
        "景色を見に行く候補として雰囲気が良さそうです。",
        "次の目的地として立ち寄ってみたくなる自然スポットです。"
    ]);
}

// ===============================
// 履歴保存
// ===============================
function saveNatureHistoryItem(data) {
    const key = "dokoiko_nature_history";
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
function shareNatureResult(index) {
    const card = document.getElementById(`result${index + 1}`);
    if (!card) return;

    const shareUrl = card.dataset.mapUrl || location.href;
    const shareText = card.dataset.shareText || "どこいこMapで自然スポットを見つけたよ！";

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
// ランダム座標生成（ドーナツ型）
// ===============================
function createRandomPoint(lat, lng, minDistanceKm, maxDistanceKm) {
    const minR = minDistanceKm / 111;
    const maxR = maxDistanceKm / 111;

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
    if (time === 60) return maxDistance * 0.12;
    if (time === 90) return maxDistance * 0.28;
    if (time === 120) return maxDistance * 0.36;
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
                searchThreeNature(point.lat, point.lng, point.distanceKm, time, highway);
                return;
            }
        }

        findValidPoint(startLat, startLng, maxDistance, geocoder, time, highway, attempt + 1);
    });
}

// ===============================
// 3つの自然検索
// ===============================
function searchThreeNature(lat, lng, distance, time, highway) {
    let completed = 0;

    for (let i = 0; i < 3; i++) {
        searchNearbyNature(lat, lng, distance, time, highway, i, 0, function () {
            completed++;

            if (completed === 3) {
                hideLoadingState();
                showResultWithEffect();

                const rerollButton = document.getElementById("rerollButton");
                if (rerollButton) {
                    rerollButton.classList.remove("hidden");
                }
            }
        });
    }
}

// ===============================
// Places API検索（自然版）
// park固定をやめて自然候補を広げる
// ===============================
function searchNearbyNature(lat, lng, distance, time, highway, index, retry = 0, callback = null) {
    const service = new google.maps.places.PlacesService(map);
    const box = document.getElementById(`result${index + 1}`);

    let radius = Math.max(distance * 1000, 5000);
    if (retry === 1) radius *= 1.8;
    if (retry === 2) radius *= 2.5;

    const natureKeywordSets = [
        ["絶景", "展望台", "景勝地"],
        ["滝", "渓谷", "清流"],
        ["湖", "沼", "高原"],
        ["自然公園", "森林公園", "ハイキング"],
        ["海", "岬", "海岸"],
        ["山", "登山口", "展望スポット"]
    ];

    let selectedKeywords;

    if (retry === 0) {
        selectedKeywords =
            natureKeywordSets[Math.floor(Math.random() * natureKeywordSets.length)];
    } else if (retry === 1) {
        selectedKeywords = ["絶景", "滝", "湖", "公園"];
    } else if (retry === 2) {
        selectedKeywords = ["自然", "景色", "展望"];
    } else {
        selectedKeywords = ["自然スポット"];
    }

    const keyword = selectedKeywords.join(" ");

    service.nearbySearch(
        {
            location: { lat: lat, lng: lng },
            radius: radius,
            keyword: keyword
        },
        function (results, status) {
            if (status !== google.maps.places.PlacesServiceStatus.OK || !results || results.length === 0) {
                if (retry < 3) {
                    searchNearbyNature(lat, lng, distance, time, highway, index, retry + 1, callback);
                    return;
                }

                if (box) {
                    box.innerHTML = `<h3>🌿 自然</h3>見つかりませんでした`;
                }

                if (callback) callback();
                return;
            }

            let filtered = results.filter(r => (r.rating || 0) >= 4.0);
            if (filtered.length === 0) filtered = results;

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

            if (filtered.length === 0) filtered = results;

            filtered.sort((a, b) => (b.user_ratings_total || 0) - (a.user_ratings_total || 0));
            const top = filtered.slice(0, 5);

            if (!top.length) {
                box.innerHTML = `<h3>🌿 自然</h3>見つかりませんでした`;
                if (callback) callback();
                return;
            }

            const spot = top[Math.floor(Math.random() * top.length)];
            const slat = spot.geometry.location.lat();
            const slng = spot.geometry.location.lng();
            const rating = spot.rating || "評価なし";
            const reviews = spot.user_ratings_total || 0;
            const photoUrl = getSpotPhotoUrl(spot);
            const typeLabel = formatNatureTypes(spot.types, spot.name);
            const catchCopy = buildNatureCatchCopy(spot);

            const mapUrl =
                `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(startAddressGlobal)}` +
                `&destination=${encodeURIComponent(spot.name)}` +
                `&destination_place_id=${spot.place_id}`;

            const shareText =
                `${spot.name} を見つけたよ！ 🌿自然 / ⭐${rating} #どこいこMap`;

            const marker = new google.maps.Marker({
                position: { lat: slat, lng: slng },
                map: map,
                icon: {
                    url: "../image/green_dog.png",
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

            saveNatureHistoryItem({
                pageType: "nature",
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
<img src="../image/green_dog.png" class="genre-dog">
🌿 自然</div>

${photoUrl ? `
<div class="spot-photo-wrap">
<img src="${photoUrl}" alt="${spot.name}" class="spot-photo" loading="lazy">
</div>
` : ""}

<div class="spot-name">${spot.name}</div>
<div class="spot-copy">${catchCopy || "気になる自然スポットです。"}</div>

📍 ${spot.vicinity || ""}<br>
⭐ ${rating} (${reviews}件)<br>
🏷 ${typeLabel}<br>
⏱ 約${distance.toFixed(1)}km / ${time}分以内<br><br>

<div class="result-actions">
<a href="${mapUrl}" target="_blank" rel="noopener noreferrer">
🧭 Googleマップでナビ
</a>

<button type="button" class="share-button" onclick="shareNatureResult(${index})">
共有する
</button>
</div>
`;

            if (callback) callback();
        }
    );
}

// ===============================
// UI表示アニメ
// ===============================
function showResultWithEffect() {
    const box = document.getElementById("results");
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
function rerollNature() {
    if (!startLat || !startLng) {
        alert("先に検索してね！");
        return;
    }

    const time = Number(document.getElementById("timeSelect").value);
    const highway = document.getElementById("highway").value;
    const geocoder = new google.maps.Geocoder();
    const maxDistance = maxDistanceByTime(time, highway);

    clearResults();
    showLoadingState("検索中...", "わんこが自然スポットを探してるよ");
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
function showLoadingState(message = "検索中...", subMessage = "わんこがわくわくの道を探してるよ") {
    const resultsBox = document.getElementById("results");
    if (!resultsBox) return;

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
