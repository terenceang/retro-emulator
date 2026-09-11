const n = document.getElementById("nav-toggle");
const m = document.getElementById("mobile-menu");
const open = () => { m.classList.add("open"); n.classList.add("open"); n.setAttribute("aria-expanded", "true"); m.setAttribute("aria-hidden", "false"); };
const close = () => { m.classList.remove("open"); n.classList.remove("open"); n.setAttribute("aria-expanded", "false"); m.setAttribute("aria-hidden", "true"); };
n.addEventListener("click", (e) => {
  e.stopPropagation();
  m.classList.contains("open") ? close() : open();
});
m.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && m.classList.contains("open")) { close(); n.focus(); } });
document.addEventListener("click", (e) => { if (m.classList.contains("open") && !m.contains(e.target) && !n.contains(e.target)) close(); });
window.addEventListener("resize", () => { if (window.innerWidth > 640 && m.classList.contains("open")) close(); });

const vc = document.getElementById("visitor-count-value");
if (vc) {
  fetch("/api/count", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((j) => { vc.textContent = Number(j.count).toLocaleString("en-US"); })
    .catch(() => { vc.textContent = "–"; });
}
