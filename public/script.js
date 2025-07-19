// script.js 
let currentSlide = 0; let totalSlides = 0;

// Captura o clientId da URL ou caminho 
let clientId = window.clientId || null; if (!clientId) { const params = new URLSearchParams(window.location.search); const pathParts = window.location.pathname.split('/'); if (params.has("clientId")) { clientId = params.get("clientId"); } else if (pathParts.includes("widget")) { clientId = pathParts[pathParts.indexOf("widget") + 1]; } } if (!clientId) clientId = "CLIENTE_PADRAO";

const API_URL = 'https://notion-feed-backend2.onrender.com/widget/${clientId}/posts;

async function loadPosts() { try { const res = await fetch(${API_URL}?t=${Date.now()}); if (!res.ok) throw new Error(Erro ao buscar posts: ${res.statusText}); const posts = await res.json();

const grid = document.getElementById("grid");
if (!grid) return;
grid.innerHTML = "";

if (posts.length === 0) {
  grid.classList.add("empty");
} else {
  grid.classList.remove("empty");

  posts.forEach(post => {
    const mediaUrl = post.media[0];
    const isVideo = mediaUrl.endsWith(".mp4");
    const container = document.createElement("div");
    container.className = "grid-item";
    container.dataset.id = post.id;
    container.dataset.type = post.media.length > 1 ? "carousel" : isVideo ? "video" : "image";

    const el = isVideo ? document.createElement("video") : document.createElement("img");
    el.src = mediaUrl;
    if (isVideo) {
      el.muted = true;
      el.playsInline = true;
      el.preload = "metadata";
      if (post.thumbnail) el.poster = post.thumbnail;
    }
    container.appendChild(el);

    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `
      ${post.editoria ? `<div class="editoria">${post.editoria}</div>` : ""}
      <div class="title">${post.title || ""}</div>
      ${post.date ? `<div class="date">${formatDate(post.date)}</div>` : ""}
    `;
    container.appendChild(overlay);

    const iconContainer = document.createElement("div");
    iconContainer.className = "icon-container";

    if (isVideo) {
      iconContainer.innerHTML += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    }
    if (post.media.length > 1) {
      iconContainer.innerHTML += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="5" y="5" width="12" height="12" rx="2" ry="2" fill="white" opacity="0.8"/><rect x="7" y="7" width="12" height="12" rx="2" ry="2" fill="white"/></svg>`;
    }

    container.appendChild(iconContainer);
    container.onclick = () => openModal(post.media, post.thumbnail);
    grid.appendChild(container);
  });
}

} catch (error) { console.error("Erro ao carregar posts:", error); } }

function openModal(mediaUrls, thumbnail) { const modal = document.getElementById("modal"); const slidesContainer = document.getElementById("slidesContainer"); const dotsContainer = document.getElementById("dotsContainer");

if (!modal || !slidesContainer || !dotsContainer) return; slidesContainer.innerHTML = ""; dotsContainer.innerHTML = ""; currentSlide = 0; totalSlides = mediaUrls.length;

mediaUrls.forEach((url, index) => { const isVideo = url.endsWith(".mp4"); const slide = document.createElement(isVideo ? "video" : "img"); slide.src = url; slide.className = "slide"; if (isVideo) { slide.controls = true; if (thumbnail) slide.poster = thumbnail; } if (index === 0) slide.classList.add("active"); slidesContainer.appendChild(slide);

if (totalSlides > 1) {
  const dot = document.createElement("div");
  dot.className = "dot";
  if (index === 0) dot.classList.add("active");
  dotsContainer.appendChild(dot);
}

});

updateSlideUI(); modal.style.display = "flex"; }

function showSlide(index) { const slides = document.querySelectorAll("#slidesContainer .slide"); const dots = document.querySelectorAll("#dotsContainer .dot"); if (index < 0 || index >= totalSlides) return;

slides.forEach(slide => slide.classList.remove("active")); dots.forEach(dot => dot.classList.remove("active")); slides[index].classList.add("active"); dots[index]?.classList.add("active"); currentSlide = index; updateSlideUI(); }

function updateSlideUI() { const slides = document.querySelectorAll("#slidesContainer .slide"); const dots = document.querySelectorAll("#dotsContainer .dot"); const slideCount = document.getElementById("slideCount"); const dotsContainer = document.getElementById("dotsContainer");

slides.forEach(slide => slide.classList.remove("active")); slides[currentSlide].classList.add("active"); dots.forEach(dot => dot.classList.remove("active")); if (dots[currentSlide]) dots[currentSlide].classList.add("active");

if (totalSlides > 1) { if (slideCount) slideCount.textContent = ${currentSlide + 1} / ${totalSlides}; if (slideCount) slideCount.style.display = "block"; if (dotsContainer) dotsContainer.style.display = "flex"; } else { if (slideCount) slideCount.style.display = "none"; if (dotsContainer) dotsContainer.style.display = "none"; } updateArrowVisibility(); }

function updateArrowVisibility() { const left = document.querySelector(".arrow.left"); const right = document.querySelector(".arrow.right"); if (left) left.style.display = currentSlide > 0 ? "flex" : "none"; if (right) right.style.display = currentSlide < totalSlides - 1 ? "flex" : "none"; }

function fecharPopup() { const modal = document.getElementById("modal"); if (modal) { const videos = modal.querySelectorAll("video"); videos.forEach(video => { video.pause(); video.currentTime = 0; }); modal.style.display = "none"; } }

document.getElementById("closeModal")?.addEventListener("click", fecharPopup);

document.querySelector(".arrow.left")?.addEventListener("click", () => showSlide(currentSlide - 1)); document.querySelector(".arrow.right")?.addEventListener("click", () => showSlide(currentSlide + 1));

document.getElementById("modal")?.addEventListener("click", (event) => { const modalContent = document.getElementById("modalContent"); if (modalContent && !modalContent.contains(event.target)) fecharPopup(); });

document.getElementById("refresh")?.addEventListener("click", async () => { const btn = document.getElementById("refresh"); btn.classList.add("loading"); const originalText = btn.innerHTML; btn.innerHTML = <svg class="spinner" width="16" height="16" viewBox="0 0 50 50"><circle class="spinner-circle" cx="25" cy="25" r="20" fill="none" stroke-width="4" stroke-linecap="round" stroke-dasharray="31.4 31.4" transform="rotate(-90 25 25)"><animateTransform attributeName="transform" type="rotate" values="0 25 25;360 25 25" dur="1s" repeatCount="indefinite"/></circle></svg>; await loadPosts(); btn.innerHTML = originalText; btn.classList.remove("loading"); });

function formatDate(dateString) { const date = new Date(dateString); const day = String(date.getDate()).padStart(2, '0'); const month = date.toLocaleString('pt-BR', { month: 'short' }).toLowerCase(); const year = String(date.getFullYear()).slice(-2); return ${day} ${month} ${year}; }

document.addEventListener("DOMContentLoaded", loadPosts); document.addEventListener("keydown", (event) => { if (event.key === "Escape") fecharPopup(); });

