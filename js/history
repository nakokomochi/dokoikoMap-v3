const HISTORY_KEY = "dokoiko_history";

document.addEventListener("DOMContentLoaded", () => {
    renderHistory();

    const clearBtn = document.getElementById("clearHistoryBtn");
    if (clearBtn) {
        clearBtn.addEventListener("click", clearHistory);
    }
});

function safeParseHistory() {
    try {
        const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
        return Array.isArray(data) ? data : [];
    } catch (e) {
        return [];
    }
}

function renderHistory() {
    const historyList = document.getElementById("historyList");
    if (!historyList) return;

    const histories = safeParseHistory();

    if (histories.length === 0) {
        historyList.innerHTML = `
            <div class="empty-history">
                <p>まだ履歴がないみたい(´・ω・｀)</p>
                <p>スポット版やテーマ版で行き先を探すと、ここに表示されます。</p>
                <button onclick="location.href='spot.html'">スポット版を使う</button>
                <button onclick="location.href='theme.html'">テーマ版を使う</button>
            </div>
        `;
        return;
    }

    historyList.innerHTML = histories.map((item, index) => {
        const name = item.name || item.placeName || item.title || "名称不明のスポット";
        const sourceLabel = item.sourceLabel || getSourceLabel(item);
        const genre = item.genreName || item.genre || item.roadTypeLabel || "";
        const address = item.address || item.vicinity || item.formatted_address || "";
        const photoUrl = item.photoUrl || item.imageUrl || "";
        const savedDate = formatSavedDate(item.savedAt);
        const mapUrl = item.mapUrl || createGoogleMapsUrl(item, name);
        const catchCopy = item.catchCopy || "";

        return `
            <article class="history-card">
                ${photoUrl ? `
                    <div class="history-image-wrap">
                        <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(name)}" class="history-image">
                    </div>
                ` : ""}

                <div class="history-content">
                    <div class="history-meta">
                        <span class="history-genre">
                            ${escapeHtml(sourceLabel)}${genre ? "｜" + escapeHtml(genre) : ""}
                        </span>
                        <span class="history-date">${escapeHtml(savedDate)}</span>
                    </div>

                    <h3>${escapeHtml(name)}</h3>

                    ${catchCopy ? `<p class="history-copy">${escapeHtml(catchCopy)}</p>` : ""}
                    ${address ? `<p class="history-address">📍 ${escapeHtml(address)}</p>` : ""}
                    ${item.distanceText ? `<p class="history-distance">🚗 ${escapeHtml(item.distanceText)}</p>` : ""}
                    ${item.durationText ? `<p class="history-duration">⏱ ${escapeHtml(item.durationText)}</p>` : ""}

                    <div class="history-card-actions">
                        <a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer" class="history-map-btn">
                            Google Mapsで見る
                        </a>

                        <button class="history-delete-btn" onclick="deleteHistoryItem(${index})">
                         この履歴を削除
                        </button>
                    </div>
                 
                </div>
            </article>
        `;
    }).join("");
}

function getSourceLabel(item) {
    if (item.sourceType === "spot") return "スポット版";
    if (item.sourceType === "gourmet") return "グルメ版";
    if (item.sourceType === "tourism") return "観光版";
    if (item.sourceType === "nature") return "自然版";
    if (item.sourceType === "goodroad" || item.sourceType === "goodRoad") return "気持ちよく走れる道版";

    if (item.pageType === "spot") return "スポット版";
    if (item.pageType === "gourmet") return "グルメ版";
    if (item.pageType === "tourism") return "観光版";
    if (item.pageType === "nature") return "自然版";
    if (item.pageType === "goodroad" || item.pageType === "goodRoad") return "気持ちよく走れる道版";

    return "どこいこMap";
}

function createGoogleMapsUrl(item, name) {
    if (item.lat && item.lng) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.lat + "," + item.lng)}`;
    }

    if (item.latitude && item.longitude) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.latitude + "," + item.longitude)}`;
    }

    if (item.placeId || item.place_id) {
        const placeId = item.placeId || item.place_id;
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(placeId)}`;
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
}

function clearHistory() {
    const ok = confirm("履歴をすべて削除しますか？");
    if (!ok) return;

    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
}

function formatSavedDate(savedAt) {
    if (!savedAt) return "";

    const date = new Date(savedAt);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("ja-JP", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, match => {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[match];
    });
}

function deleteHistoryItem(index) {
    const histories = safeParseHistory();

    if (!histories[index]) return;

    const ok = confirm("この履歴を削除しますか？");
    if (!ok) return;

    histories.splice(index, 1);

    localStorage.setItem(HISTORY_KEY, JSON.stringify(histories));

    renderHistory();
}
