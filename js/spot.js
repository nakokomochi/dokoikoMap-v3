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
}

// ===============================
function createRandomPoint(lat, lng, maxDistanceKm) {

    const radiusInDegrees = maxDistanceKm / 111;

    const u = Math.random();
    const v = Math.random();
    const w = radiusInDegrees * Math.sqrt(u);
    const t = 2 * Math.PI * v;

    const newLat = lat + w * Math.cos(t);
    const newLng = lng + w * Math.sin(t) / Math.cos(lat * Math.PI / 180);

    return { lat: newLat, lng: newLng };
}

// ===============================
function maxDistanceByTime(time, highway) {

    const hours = time / 60;

    let speed;

    if (highway === "yes") {
        speed = HIGHWAY_SPEED;
    } else {
        speed = LOCAL_SPEED;
    }

    return hours * speed;
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
function findValidPoint(startLat, startLng, maxDistance, geocoder, time, highway, attempt = 0) {

    if (attempt > 15) {
        hideLoadingState();
        alert("海に当たってしまいました、もう一度回してください");
        return;
    }

    const point = createRandomPoint(startLat, startLng, maxDistance);

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

                    const distance = calcDistance(startLat, startLng, point.lat, point.lng);

                    searchThreeGenres(point.lat, point.lng, distance, time, highway);
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
    const typeLabel = formatSpotTypes(spot.types, genreName, keyword);

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

    current.unshift({
        savedAt: new Date().toISOString(),
        ...data
    });

    const trimmed = current.slice(0, 20);
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
// 3ジャンル検索
// ===============================
function searchThreeGenres(lat, lng, distance, time, highway) {

    completedSpotResults = 0;

    const genreGroups = [
        { name: "🔭観光スポット⛩", keywords: ["神社", "寺", "展望台", "絶景"], color: "red" },
        { name: "🍽グルメ🍜", keywords: ["ラーメン", "カフェ", "食堂"], color: "green" },
        { name: "🌳自然スポット🍃", keywords: ["滝", "峠", "湖", "渓谷", "ダム"], color: "orange" }
    ];

    genreGroups.forEach((group, index) => {

        const keyword = group.keywords[Math.floor(Math.random() * group.keywords.length)];

        searchNearbySpotByGenre(
            lat,
            lng,
            distance,
            time,
            highway,
            keyword,
            group.name,
            index,
            group.color
        );
    });

    document.getElementById("rerollButton").classList.remove("hidden");
}

// ===============================
// ジャンル検索（完成版）
// ===============================
function searchNearbySpotByGenre(
    lat,
    lng,
    distance,
    time,
    highway,
    keyword,
    genreName,
    index,
    color,
    retry = 0
) {

    const service = new google.maps.places.PlacesService(map);
    const box = document.getElementById(`result${index + 1}`);

    let type = "tourist_attraction";
    let searchKeyword = keyword;

    if (genreName.includes("グルメ")) {
        type = "restaurant";
    }

    if (genreName.includes("自然")) {
        type = "park";
    }

    if (genreName.includes("観光")) {
        searchKeyword = keyword + " 観光名所 絶景 展望台 道の駅 神社 寺";
    }

    let radius = Math.max(distance * 1000, 5000);

    if (retry === 1) radius *= 1.8;
    if (retry === 2) radius *= 2.5;

    service.nearbySearch(
        {
            location: { lat: lat, lng: lng },
            radius: radius,
            keyword: searchKeyword,
            type: type
        },

        function (results, status) {

            if (
                status !== google.maps.places.PlacesServiceStatus.OK ||
                !results ||
                results.length === 0
            ) {

                if (retry < 2) {

                    searchNearbySpotByGenre(
                        lat,
                        lng,
                        distance,
                        time,
                        highway,
                        keyword,
                        genreName,
                        index,
                        color,
                        retry + 1
                    );

                    return;
                }

                if (box) {
                    box.innerHTML = `
<h3>${genreName}</h3>
見つかりませんでした
`;
                }

                handleSpotResultRendered();
                return;
            }

            let filtered = results.filter(r => (r.rating || 0) >= 4.0);

            if (filtered.length === 0) {
                filtered = results;
            }

            filtered = filtered.filter(place => {

                const plat = place.geometry.location.lat();
                const plng = place.geometry.location.lng();

                for (let marker of spotMarkers) {

                    if (!marker || !marker.getPosition) continue;

                    const pos = marker.getPosition();

                    const d = calcDistance(
                        plat,
                        plng,
                        pos.lat(),
                        pos.lng()
                    );

                    if (d < EXCLUDE_DISTANCE_KM) {
                        return false;
                    }
                }

                return true;
            });

            if (filtered.length === 0) {
                filtered = results;
            }

            filtered.sort((a, b) =>
                (b.user_ratings_total || 0) -
                (a.user_ratings_total || 0)
            );

            const top = filtered.slice(0, 5);

            if (top.length === 0) {

                if (box) {
                    box.innerHTML = `
<h3>${genreName}</h3>
見つかりませんでした
`;
                }

                handleSpotResultRendered();
                return;
            }

            const spot = top[Math.floor(Math.random() * top.length)];

            const slat = spot.geometry.location.lat();
            const slng = spot.geometry.location.lng();

            const rating = spot.rating || "評価なし";
            const reviews = spot.user_ratings_total || 0;
            const photoUrl = getSpotPhotoUrl(spot);
            const typeLabel = formatSpotTypes(spot.types, genreName, keyword);
            const catchCopy = buildSpotCatchCopy(spot, genreName, keyword);

            const mapUrl =
                `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(startAddressGlobal)}` +
                `&destination=${encodeURIComponent(spot.name)}` +
                `&destination_place_id=${spot.place_id}`;

            const shareText =
                `${spot.name} を見つけたよ！ ${genreName} / ⭐${rating} #どこいこMap`;

            let dogImage = "image/yellow_dog.png";

            if (genreName.includes("グルメ")) {
                dogImage = "image/red_dog.png";
            }

            if (genreName.includes("自然")) {
                dogImage = "image/green_dog.png";
            }

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

            saveSpotHistoryItem({
                pageType: "spot",
                genreName: genreName,
                keyword: keyword,
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

            if (box) {
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

🚗約${distance.toFixed(1)}km<br>

⏱ ${time}分 ${time === 30
                        ? "/ 下道のみ"
                        : `/ 🛣 ${highway === "yes" ? "高速あり" : "下道のみ"}`
                    }<br><br>

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

            handleSpotResultRendered();
        }
    );
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

    const time =
        document.getElementById("timeSelect").value;

    const highwaySelect =
        document.getElementById("highway");

    if (time === "30") {

        highwaySelect.value = "no";
        highwaySelect.disabled = true;

    } else {

        highwaySelect.disabled = false;

    }
}

// ページ読み込み後にイベント登録
window.addEventListener("DOMContentLoaded", function () {

    const timeSelect =
        document.getElementById("timeSelect");

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
