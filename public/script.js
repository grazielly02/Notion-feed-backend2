let currentSlide = 0;
let totalSlides = 0;

// Capturar clientId a partir da URL tipo: /widget/:clientId/view
const pathParts = window.location.pathname.split('/');
let clientId = null;

if (pathParts.includes('widget')) {
  clientId = pathParts[pathParts.indexOf('widget') + 1];
}

// Se não tiver clientId na URL (ex: testes locais), usar um clientId fictício
if (!clientId) {
  clientId = 'CLIENTE_PADRAO_AQUI';  // Caso queira testar local, coloque um ID de cliente válido aqui
}

const API_URL = `/widget/${clientId}/posts`;

async function loadPosts() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) {
      throw new Error(`Erro ao buscar posts: ${res.statusText}`);
    }

    const posts = await res.json();
    const grid = document.getElementById("grid");
    grid.innerHTML = "";

    posts.forEach(post => {
      const mediaUrl = post.media[0];
      const isVideo = mediaUrl.endsWith(".mp4");

      const container = document.createElement("div");
      container.className = "grid-item";

      const el = isVideo ? document.createElement("video") : document.createElement("img");
      el.src = mediaUrl;

      if (isVideo) {
        el.muted = true;
        el.playsInline = true;
        el.preload = "metadata";
      }

      container.appendChild(el);

      const overlay = document.createElement("div");
      overlay.className = "overlay";

      const title = post.title || "";
      const date = post.date ? formatDate(post.date) : "";

      overlay.innerHTML = `<strong>${title}</strong><br>${date}`;
      container.appendChild(overlay);

      const iconContainer = document.createElement("div");
      iconContainer.className = "icon-container";

      if (isVideo) {
        iconContainer.innerHTML += `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>`;
      }

      if (post.media.length > 1) {
        iconContainer.innerHTML += `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <rect x="5" y="5" width="12" height="12" rx="2" ry="2" fill="white" opacity="0.8"/>
            <rect x="7" y="7" width="12" height="12" rx="2" ry="2" fill="white"/>
          </svg>`;
      }

      container.appendChild(iconContainer);

      container.onclick = () => openModal(post.media);
      grid.appendChild(container);
    });
  } catch (error) {
    console.error("Erro ao carregar posts:", error);
  }
}

function openModal(mediaUrls) {
  const modal = document.getElementById("modal");
  const slidesContainer = document.getElementById("slidesContainer");
  const dotsContainer = document.getElementById("dotsContainer");

  slidesContainer.innerHTML = "";
  dotsContainer.innerHTML = "";
  currentSlide = 0;
  totalSlides = mediaUrls.length;

  mediaUrls.forEach((url, index) => {
    const isVideo = url.endsWith(".mp4");
    const slide = document.createElement(isVideo ? "video" : "img");

    slide.src = url;
    slide.className = "slide";
    if (isVideo) slide.controls = true;
    if (index === 0) slide.classList.add("active");

    slidesContainer.appendChild(slide);

    if (totalSlides > 1) {
      const dot = document.createElement("div");
      dot.className = "dot";
      if (index === 0) dot.classList.add("active");
      dotsContainer.appendChild(dot);
    }
  });

  updateSlideUI();
  modal.style.display = "flex";
}

function showSlide(index) {
  const slides = document.querySelectorAll("#slidesContainer .slide");
  const dots = document.querySelectorAll("#dotsContainer .dot");
  if (index < 0 || index >= totalSlides) return;

  slides.forEach(slide => slide.classList.remove("active"));
  dots.forEach(dot => dot.classList.remove("active"));

  slides[index].classList.add("active");
  if (dots[index]) dots[index].classList.add("active");
  currentSlide = index;

  updateSlideUI();
}

function updateSlideUI() {
  const slides = document.querySelectorAll("#slidesContainer .slide");
  const dots = document.querySelectorAll("#dotsContainer .dot");
  const slideCount = document.getElementById("slideCount");
  const dotsContainer = document.getElementById("dotsContainer");

  slides.forEach(slide => slide.classList.remove("active"));
  slides[currentSlide].classList.add("active");

  dots.forEach(dot => dot.classList.remove("active"));
  if (dots[currentSlide]) dots[currentSlide].classList.add("active");

  if (totalSlides > 1) {
    slideCount.textContent = `${currentSlide + 1} / ${totalSlides}`;
    slideCount.style.display = "block";
    dotsContainer.style.display = "flex";
  } else {
    slideCount.style.display = "none";
    dotsContainer.style.display = "none";
  }

  updateArrowVisibility();
}

function updateArrowVisibility() {
  document.querySelector(".arrow.left").style.display = (currentSlide > 0) ? "flex" : "none";
  document.querySelector(".arrow.right").style.display = (currentSlide < totalSlides - 1) ? "flex" : "none";
}

document.getElementById("closeModal").onclick = () => {
  document.getElementById("modal").style.display = "none";
};

document.querySelector(".arrow.left").onclick = () => {
  showSlide(currentSlide - 1);
};

document.querySelector(".arrow.right").onclick = () => {
  showSlide(currentSlide + 1);
};

function formatDate(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

document.getElementById("refresh").onclick = loadPosts;
loadPosts();