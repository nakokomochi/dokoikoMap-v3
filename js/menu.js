document.addEventListener("DOMContentLoaded", function () {
  const menuToggle = document.getElementById("menuToggle");
  const mobileMenu = document.getElementById("mobileMenu");
  const mobileMenuOverlay = document.getElementById("mobileMenuOverlay");
  const mobileMenuClose = document.getElementById("mobileMenuClose");

  const themeSubmenuToggle = document.getElementById("themeSubmenuToggle");
  const themeSubmenu = document.getElementById("themeSubmenu");

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

  function toggleThemeSubmenu() {
    if (!themeSubmenuToggle || !themeSubmenu) return;

    const isOpen = themeSubmenu.classList.contains("open");

    if (isOpen) {
      themeSubmenu.classList.remove("open");
      themeSubmenuToggle.setAttribute("aria-expanded", "false");
    } else {
      themeSubmenu.classList.add("open");
      themeSubmenuToggle.setAttribute("aria-expanded", "true");
    }
  }

  menuToggle.addEventListener("click", openMenu);
  mobileMenuClose.addEventListener("click", closeMenu);
  mobileMenuOverlay.addEventListener("click", closeMenu);

  if (themeSubmenuToggle) {
    themeSubmenuToggle.addEventListener("click", toggleThemeSubmenu);
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeMenu();
    }
  });
});
