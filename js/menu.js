document.addEventListener("DOMContentLoaded", function () {
  const commonMenu = document.getElementById("commonMenu");

  if (commonMenu) {
    commonMenu.innerHTML = `
      <!-- スマホ用メニューボタン -->
      <button class="menu-toggle" id="menuToggle" aria-label="メニューを開く" aria-expanded="false" aria-controls="mobileMenu">
        ☰
      </button>

      <!-- スマホ用メニュー背景 -->
      <div class="mobile-menu-overlay" id="mobileMenuOverlay"></div>

      <!-- スマホ用メニュー -->
      <nav class="mobile-menu" id="mobileMenu" aria-hidden="true">
        <button class="mobile-menu-close" id="mobileMenuClose" aria-label="メニューを閉じる">✕</button>

        <a href="/index.html">TOP</a>
        <a href="/spot.html">スポット</a>
        <a href="/area.html">地名</a>

        <div class="mobile-submenu-wrap">
          <button class="mobile-submenu-toggle" id="themeSubmenuToggle" aria-expanded="false" aria-controls="themeSubmenu">
            ▼目的
          </button>

          <div class="mobile-submenu" id="themeSubmenu">
            <a href="/theme.html">目的一覧</a>
            <a href="/themes/gourmet.html">飲食店</a>
            <a href="/themes/tourism.html">観光地探し</a>
            <a href="/themes/nature.html">自然でデトックス</a>
            <a href="/themes/goodRoad.html">気持ちよく走れる道</a>
          </div>
        </div>

        <div class="mobile-submenu-wrap">
          <button class="mobile-submenu-toggle" id="columnSubmenuToggle" aria-expanded="false" aria-controls="columnSubmenu">
            ▼📝コラム
          </button>

          <div class="mobile-submenu" id="columnSubmenu">
            <a href="/column_top.html">コラム一覧</a>
          </div>
        </div>

        <a href="/history.html">履歴</a>
        <a href="/what-is.html">What is どこいこMap</a>
        <a href="/about.html">このサイトについて</a>
        <a href="/contact.html">お問い合わせ</a>
      </nav>

      <!-- PC用サイドメニュー -->
      <nav class="pc-side-menu" aria-label="PC用メニュー">
        <a href="/index.html" class="pc-menu-logo">
          <span class="pc-menu-title">どこいこMap</span>
        </a>

        <a href="/index.html">TOP</a>
        <a href="/spot.html">スポット</a>
        <a href="/area.html">地名</a>

        <details class="pc-menu-group">
         <summary>ツーリングの目的</summary>

         <a href="/theme.html">目的一覧</a>
         <a href="/themes/gourmet.html">飲食店</a>
         <a href="/themes/tourism.html">観光地探し</a>
         <a href="/themes/nature.html">自然でデトックス</a>
         <a href="/themes/goodRoad.html">気持ちよく走れる道</a>
        </details>

        <details class="pc-menu-group">
          <summary>📝コラム</summary>
          <a href="/column_top.html">コラム一覧</a>
        </details>

        <a href="/history.html">履歴</a>
        <a href="/what-is.html">What is どこいこMap</a>
        <a href="/about.html">ご挨拶</a>
        <a href="/contact.html">お問い合わせ</a>
        <a href="/privacy-policy.html">プライバシーポリシー</a>
      </nav>
    `;
  }

  const menuToggle = document.getElementById("menuToggle");
  const mobileMenu = document.getElementById("mobileMenu");
  const mobileMenuOverlay = document.getElementById("mobileMenuOverlay");
  const mobileMenuClose = document.getElementById("mobileMenuClose");

  const themeSubmenuToggle = document.getElementById("themeSubmenuToggle");
  const themeSubmenu = document.getElementById("themeSubmenu");

  const columnSubmenuToggle = document.getElementById("columnSubmenuToggle");
  const columnSubmenu = document.getElementById("columnSubmenu");

  if (!menuToggle || !mobileMenu || !mobileMenuOverlay || !mobileMenuClose) {
    return;
  }

  function openMenu() {
    mobileMenu.classList.add("open");
    mobileMenuOverlay.classList.add("open");
    menuToggle.setAttribute("aria-expanded", "true");
    mobileMenu.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeMenu() {
    mobileMenu.classList.remove("open");
    mobileMenuOverlay.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    mobileMenu.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function toggleSubmenu(button, submenu) {
    if (!button || !submenu) return;

    const isOpen = submenu.classList.contains("open");

    if (isOpen) {
      submenu.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
    } else {
      submenu.classList.add("open");
      button.setAttribute("aria-expanded", "true");

      setTimeout(() => {
        submenu.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      }, 100);
    }
  }

  menuToggle.addEventListener("click", openMenu);
  mobileMenuClose.addEventListener("click", closeMenu);
  mobileMenuOverlay.addEventListener("click", closeMenu);

  if (themeSubmenuToggle) {
    themeSubmenuToggle.addEventListener("click", function () {
      toggleSubmenu(themeSubmenuToggle, themeSubmenu);
    });
  }

  if (columnSubmenuToggle) {
    columnSubmenuToggle.addEventListener("click", function () {
      toggleSubmenu(columnSubmenuToggle, columnSubmenu);
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeMenu();
    }
  });
});
