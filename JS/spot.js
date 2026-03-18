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

    const geocoder = new google.maps.Geocoder();

    geocoder.geocode({ address: startAddress }, function (results, status) {

        if (status !== "OK" || !results[0]) {
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

    document.getElementById("results").classList.remove("show");

    document.getElementById("result1").innerHTML = "";
    document.getElementById("result2").innerHTML = "";
    document.getElementById("result3").innerHTML = "";

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
// 3ジャンル検索
// ===============================
function searchThreeGenres(lat, lng, distance, time, highway) {

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

    showResultWithEffect();

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

    // ---------------------------
    // 検索パラメータ
    // ---------------------------
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

    // ---------------------------
    // radius
    // ---------------------------
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

            // ---------------------------
            // 検索失敗
            // ---------------------------
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

                box.innerHTML = `
<h3>${genreName}</h3>
見つかりませんでした
`;
                return;
            }

            // ---------------------------
            // 評価フィルター
            // ---------------------------
            let filtered = results.filter(r => (r.rating || 0) >= 4.0);

            if (filtered.length === 0) {
                filtered = results;
            }

            // ---------------------------
            // 既存スポット除外
            // ---------------------------
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

            // ---------------------------
            // レビュー順ソート
            // ---------------------------
            filtered.sort((a, b) =>
                (b.user_ratings_total || 0) -
                (a.user_ratings_total || 0)
            );

            // ---------------------------
            // 上位5件
            // ---------------------------
            const top = filtered.slice(0, 5);

            if (top.length === 0) {

                box.innerHTML = `
<h3>${genreName}</h3>
見つかりませんでした
`;
                return;
            }

            // ---------------------------
            // ランダム抽選
            // ---------------------------
            const spot = top[Math.floor(Math.random() * top.length)];

            const slat = spot.geometry.location.lat();
            const slng = spot.geometry.location.lng();

            const rating = spot.rating || "評価なし";
            const reviews = spot.user_ratings_total || 0;

            // ---------------------------
            // 犬画像決定
            // ---------------------------
            let dogImage = "image/yellow_dog.png";

            if (genreName.includes("グルメ")) {
                dogImage = "image/red_dog.png";
            }

            if (genreName.includes("自然")) {
                dogImage = "image/green_dog.png";
            }

            // ---------------------------
            // マーカー
            // ---------------------------
            const marker = new google.maps.Marker({
                position: { lat: slat, lng: slng },
                map: map,
                icon: {
                    url: dogImage,
                    scaledSize: new google.maps.Size(50, 50)
                }
            });

            spotMarkers.push(marker);

            // ---------------------------
            // マップ範囲
            // ---------------------------
            const bounds = new google.maps.LatLngBounds();

            if (startMarker && startMarker.getPosition) {
                bounds.extend(startMarker.getPosition());
            }

            spotMarkers.forEach(m => {

                if (m && m.getPosition) {
                    bounds.extend(m.getPosition());
                }

            });

            // ---------------------------
            // UI表示
            // ---------------------------
            box.innerHTML = `
<div class="genre">
<img src="${dogImage}" class="genre-dog">
${genreName}</div>

<div class="spot-name">${spot.name}</div>

📍 ${spot.vicinity || ""}<br>

⭐ ${rating} (${reviews}件)<br>

🎯ジャンル：${keyword}<br><br>

🚗約${distance.toFixed(1)}km<br>

⏱ ${time}分 ${time === 30
                    ? "/ 下道のみ"
                    : `/ 🛣 ${highway === "yes" ? "高速あり" : "下道のみ"}`
                }<br><br>

<a href="https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(startAddressGlobal)}&destination=${encodeURIComponent(spot.name)}&destination_place_id=${spot.place_id}" target="_blank">
🧭 Googleマップでナビ
</a>
`;
        }
    );
}


// ===============================
function showResultWithEffect() {

    const box = document.getElementById("results");

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

window.initMap = function () {
  console.log("initMap動いた！");
}

  const map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 35.681236, lng: 139.767125 },
    zoom: 14,
  });
}
