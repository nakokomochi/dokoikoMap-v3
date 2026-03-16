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
    gestureHandling: "cooperative"
};

// ===============================
// Google Map 初期表示
// ===============================
function initMap() {
    map = new google.maps.Map(document.getElementById("map"), TOKYO_STATION_POSITION);
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
                url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
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
// ジャンル検索
// ===============================
function searchNearbySpotByGenre(lat, lng, distance, time, highway, keyword, genreName, index, color) {

    const service = new google.maps.places.PlacesService(map);

    service.nearbySearch(
        {
            location: { lat: lat, lng: lng },
            radius: 10000,
            keyword: keyword,
            type: "tourist_attraction"
        },
        function (results, status) {

            const box = document.getElementById(`result${index + 1}`);

            if (status === google.maps.places.PlacesServiceStatus.OK && results[0]) {

                const spot = results[0];

                const lat = spot.geometry.location.lat();
                const lng = spot.geometry.location.lng();

                const marker = new google.maps.Marker({
                    position: { lat, lng },
                    map: map,
                    icon: {
                        url: "dog.png",
                        scaledSize: new google.maps.Size(50, 50)
                    }
                });

                spotMarkers.push(marker);

                const bounds = new google.maps.LatLngBounds();

                if (startMarker) {
                    bounds.extend(startMarker.getPosition());
                }

                spotMarkers.forEach(m => {
                    bounds.extend(m.getPosition());
                });

                bounds.extend(marker.getPosition());

                map.fitBounds(bounds);

                box.innerHTML = `
<div class="genre">${genreName}</div>
<div class="spot-name">${spot.name}</div>
📍 ${spot.vicinity}<br>
🎯ジャンル：${keyword}<br><br>

🚗約${distance.toFixed(1)}km<br>
⏱ ${time}分 / 🛣 ${highway === "yes" ? "高速あり" : "下道のみ"}<br><br>

<a href="https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(startAddressGlobal)}&destination_place_id=${spot.place_id}" target="_blank">
🧭 Googleマップで確認
</a>
`;

            } else {

                box.innerHTML = `
<h3>${genreName}</h3>
見つかりませんでした…
`;
            }
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
