let map;
let marker;
let startMarker;

let startLat;
let startLng;

const HIGHWAY_SPEED = 80;
const LOCAL_SPEED = 40;

const TOKYO_STATION_POSITION = {
    center: { lat: 35.681236, lng: 139.767125 },
    zoom: 12,
    gestureHandling: "cooperative"
};

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
// ランダム地点開始
// ===============================
function searchArea() {

    const startAddress =
        document.getElementById("startLocation").value;

    if (!startAddress) {
        alert("出発地を入力してね！");
        return;
    }

    const time =
        Number(document.getElementById("timeSelect").value);

    const highway =
        document.getElementById("highway").value;

    clearAreaResult();
    showLoadingState("検索中...", "わんこが目的地を探してるよ");

    const geocoder = new google.maps.Geocoder();

    geocoder.geocode(
        { address: startAddress },
        function (results, status) {

            if (status !== "OK" || !results[0]) {
                hideLoadingState();
                alert("出発地を取得できませんでした");
                return;
            }

            startLat =
                results[0].geometry.location.lat();

            startLng =
                results[0].geometry.location.lng();

            const maxDistance =
                maxDistanceByTime(time, highway);

            findValidPoint(
                startLat,
                startLng,
                maxDistance,
                geocoder,
                time,
                highway
            );
        }
    );
}

// ===============================
// 結果クリア
// ===============================
function clearAreaResult() {

    const resultsBox =
        document.getElementById("resultsBox");

    if (resultsBox) {
        resultsBox.classList.remove("show");
        resultsBox.classList.remove("loading");

        resultsBox.innerHTML = `
            <div id="result"></div>
        `;
    }

    if (loadingTimer) {
        clearInterval(loadingTimer);
        loadingTimer = null;
    }
}

// ===============================
// ランダム地点生成
// ===============================
function createRandomPoint(lat, lng, maxDistanceKm) {

    const radiusInDegrees =
        maxDistanceKm / 111;

    const u = Math.random();
    const v = Math.random();

    const w =
        radiusInDegrees * Math.sqrt(u);

    const t =
        2 * Math.PI * v;

    const newLat =
        lat + w * Math.cos(t);

    const newLng =
        lng + w * Math.sin(t) /
        Math.cos(lat * Math.PI / 180);

    return {
        lat: newLat,
        lng: newLng
    };
}

// ===============================
// 海を避けて地点取得
// ===============================
function findValidPoint(
    startLat,
    startLng,
    maxDistance,
    geocoder,
    time,
    highway,
    attempt = 0
) {

    if (attempt > 15) {
        hideLoadingState();
        alert("海に当たってしまいました。もう一度回してください。");
        return;
    }

    const point =
        createRandomPoint(
            startLat,
            startLng,
            maxDistance
        );

    geocoder.geocode(
        { location: point },
        function (results, status) {

            if (status === "OK" && results[0]) {

                let prefecture = "";
                let city = "";

                for (const comp of results[0].address_components) {

                    if (
                        comp.types.includes(
                            "administrative_area_level_1"
                        )
                    ) {
                        prefecture =
                            comp.long_name;
                    }

                    if (
                        comp.types.includes("locality") ||
                        comp.types.includes(
                            "administrative_area_level_2"
                        )
                    ) {
                        city =
                            comp.long_name;
                    }
                }

                if (prefecture) {

                    const distance =
                        calcDistance(
                            startLat,
                            startLng,
                            point.lat,
                            point.lng
                        );

                    hideLoadingState();

                    document.getElementById("result")
                        .innerHTML =

                        `<h2 style="color:red;">
                        ${prefecture}${city}
                        </h2>

                        🚗約${distance.toFixed(1)}km<br>

                        ⏱ ${time}分 /
                        🛣 ${
                            highway === "yes"
                            ? "高速あり"
                            : "下道のみ"
                        }`;

                    showResultWithEffect();

                    showMap(point.lat, point.lng);

                    return;
                }
            }

            findValidPoint(
                startLat,
                startLng,
                maxDistance,
                geocoder,
                time,
                highway,
                attempt + 1
            );
        }
    );
}

// ===============================
// 地図表示
// ===============================
function showMap(lat, lng) {

    const destination = { lat, lng };

    map.setCenter(destination);

    if (marker) {
        marker.setMap(null);
    }

    marker =
        new google.maps.Marker({
            position: destination,
            map: map,
            icon: {
                url: "image/dog.png",
                scaledSize:
                    new google.maps.Size(60, 60)
            }
        });

    if (startLat && startLng) {

        if (startMarker) {
            startMarker.setMap(null);
        }

        startMarker =
            new google.maps.Marker({
                position: {
                    lat: startLat,
                    lng: startLng
                },
                map: map,
                icon: {
                    url:
                        "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                }
            });

        const bounds =
            new google.maps.LatLngBounds();

        bounds.extend({
            lat: startLat,
            lng: startLng
        });

        bounds.extend(destination);

        map.fitBounds(bounds);
    }
}

// ===============================
// 時間 → 距離計算
// ===============================
function maxDistanceByTime(time, highway) {

    const hours = time / 60;

    const speed =
        highway === "yes"
            ? HIGHWAY_SPEED
            : LOCAL_SPEED;

    return hours * speed;
}

// ===============================
// 距離計算
// ===============================
function calcDistance(
    lat1,
    lng1,
    lat2,
    lng2
) {

    const R = 6371;

    const dLat =
        (lat2 - lat1) *
        Math.PI / 180;

    const dLng =
        (lng2 - lng1) *
        Math.PI / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}

// ===============================
// 高速制御
// ===============================
function updateHighwayControl() {

    const time =
        document.getElementById("timeSelect")
            .value;

    const highwaySelect =
        document.getElementById("highway");

    if (time === "30") {

        highwaySelect.value = "no";
        highwaySelect.disabled = true;

    } else {

        highwaySelect.disabled = false;

    }
}

document
.getElementById("timeSelect")
.addEventListener(
    "change",
    updateHighwayControl
);

window.addEventListener(
    "load",
    updateHighwayControl
);

// ===============================
// 結果アニメーション
// ===============================
function showResultWithEffect() {

    const box =
        document.getElementById("resultsBox");

    box.classList.remove("show");

    void box.offsetWidth;

    box.classList.add("show");

    launchConfetti();
}

// ===============================
// 紙吹雪
// ===============================
function launchConfetti() {

    const colors = [
        "#ff7675",
        "#74b9ff",
        "#55efc4",
        "#ffeaa7",
        "#a29bfe"
    ];

    for (let i = 0; i < 40; i++) {

        const confetti =
            document.createElement("div");

        confetti.classList.add("confetti");

        confetti.style.left =
            Math.random() * 100 + "vw";

        confetti.style.backgroundColor =
            colors[
                Math.floor(
                    Math.random() * colors.length
                )
            ];

        confetti.style.animationDuration =
            2 + Math.random() * 2 + "s";

        document.body.appendChild(confetti);

        setTimeout(() => {
            confetti.remove();
        }, 4000);
    }
}

// ===============================
// 現在地取得
// ===============================
function getCurrentLocation() {

    const btn =
        document.querySelector(".location-btn");

    const originalText =
        btn.innerHTML;

    if (!navigator.geolocation) {
        alert("位置情報が使えません");
        return;
    }

    btn.innerHTML = "取得中…";
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(

        function (position) {

            startLat =
                position.coords.latitude;

            startLng =
                position.coords.longitude;

            const currentPos = {
                lat: startLat,
                lng: startLng
            };

            map.setCenter(currentPos);
            map.setZoom(14);

            if (startMarker) {
                startMarker.setMap(null);
            }

            startMarker =
                new google.maps.Marker({
                    position: currentPos,
                    map: map,
                    icon: {
                        url:
                        "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                    }
                });

            const geocoder =
                new google.maps.Geocoder();

            geocoder.geocode(
                { location: currentPos },
                function (results, status) {

                    if (status === "OK" && results[0]) {

                        document.getElementById("startLocation")
                        .value =
                        results[0].formatted_address;
                    }
                }
            );

            btn.innerHTML = originalText;
            btn.disabled = false;
        },

        function () {

            alert("位置情報が許可されませんでした");

            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    );
}

// ===============================
// 検索中わんこ
// ===============================
function showLoadingState(message = "検索中...", subMessage = "わんこが目的地を探してるよ") {
    const resultsBox = document.getElementById("resultsBox");
    if (!resultsBox) return;

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

        <div id="result"></div>
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

    const resultsBox = document.getElementById("resultsBox");
    if (!resultsBox) return;

    resultsBox.classList.remove("loading");

    const loadingBox = document.getElementById("loadingBox");
    if (loadingBox) {
        loadingBox.remove();
    }
}
