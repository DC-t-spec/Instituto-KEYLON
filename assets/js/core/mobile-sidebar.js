export function initMobileSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const toggleBtn = document.getElementById("menu-toggle");
  const backdrop = document.getElementById("mobile-backdrop");
  const navLinks = document.querySelectorAll(".sidebar .nav-link");

  if (!sidebar || !toggleBtn || !backdrop) return;

  function openSidebar() {
    sidebar.classList.add("is-open");
    backdrop.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeSidebar() {
    sidebar.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  toggleBtn.addEventListener("click", () => {
    if (sidebar.classList.contains("is-open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  backdrop.addEventListener("click", closeSidebar);

  navLinks.forEach((link) => {
    link.addEventListener("click", closeSidebar);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 920) {
      closeSidebar();
    }
  });
}
