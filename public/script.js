let currentSlide = 0;
let totalSlides = 0;

// Captura o clientId da URL ou caminho
let clientId = window.clientId || null;

if (!clientId) {
  const params = new URLSearchParams(window.location.search);
  const pathParts = window.location.pathname.split('/');

  if (params.has("clientId")) {
    clientId = params.get("clientId");
  } else if (pathParts.includes("widget")) {
    clientId = pathParts[pathParts.indexOf("widget") + 1];
  }
}

if (!clientId) {
  clientId = "CLIENTE_PADRAO";
}

const API_URL = `https://notion-feed-backend2.onrender.com/widget/${clientId}/posts`;

function convertToEmbedUrl(url) {
  // Se já for um embed gerado corretamente do Figma
  if (url.includes("embed.figma.com/design")) {
    return url;
  }

  // Figma normal
  if (url.includes("figma.com")) {
    return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`;
  }

  // Canva com /view
  if (url.includes("canva.com") && url.includes("/view")) {
    return `${url}?embed`;
  }
  
// Default: retorna o link original
return url;
}

function isEmbedUrl(url) {
  return (
    url.includes("embed.figma.com/design") ||
    (url.includes("canva.com") && url.includes("/view"))
  );
}

async function loadPosts() {
  try {
    const res = await fetch(`${API_URL}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`Erro ao buscar posts: ${res.statusText}`);

    const posts = await res.json();
    const grid = document.getElementById("grid");
    if (!grid) return;

    grid.innerHTML = "";

    const postCount = posts.length;

    if (postCount === 0) {
      grid.classList.add("empty");
    } else {
      grid.classList.remove("empty");

      posts.forEach((post) => {
        const mediaUrl = post.media[0];
        const isVideo = mediaUrl.endsWith(".mp4");
        const isEmbed = isEmbedUrl(mediaUrl);

        const container = document.createElement("div");
        container.className = "grid-item";
        container.dataset.type = post.formato?.toLowerCase() || "imagem";
          
        let el;
        if (isEmbed) {
          el = document.createElement("iframe");
          el.src = convertToEmbedUrl(mediaUrl);
          el.width = "100%";
          el.height = "100%";
          el.style.border = "none";
          el.setAttribute("allowfullscreen", "true");
          el.setAttribute("loading", "lazy");
          el.style.aspectRatio = "16/9";
        } else if (isVideo) {
          el = document.createElement("video");
          el.src = mediaUrl;
          el.muted = true;
          el.playsInline = true;
          el.preload = "metadata";
          if (post.thumbnail) {
            el.poster = post.thumbnail;
          }
        } else {
          el = document.createElement("img");
          el.src = mediaUrl;
        }

        container.appendChild(el);
        
        // Overlay com título, editoria e data
        const overlay = document.createElement("div");
        overlay.className = "overlay";
        overlay.innerHTML = `
  ${post.editoria ? `<div class="editoria">${post.editoria}</div>` : ""}
  <div class="title">${post.title || ""}</div>
  ${
    post.date
      ? `<div class="date">${formatDate(post.date)}</div>`
      : `<div class="missing-date">⚠ Sem data</div>`
  }
`;
        container.appendChild(overlay);

        // Se não tiver data, adiciona selo no canto superior esquerdo
if (!post.date) {
  const warningBadge = document.createElement("div");
  warningBadge.className = "missing-date-badge";
  warningBadge.textContent = "⚠ Sem data";
  container.appendChild(warningBadge);
}
        
        // Ícones (vídeo e múltiplas mídias)
        const iconContainer = document.createElement("div");
        iconContainer.className = "icon-container";

        if (post.formato?.toLowerCase() === "vídeo" || post.formato?.toLowerCase() === "reels" ||
           mediaUrl?.toLowerCase().endsWith(".mp4")) {
          iconContainer.innerHTML += `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          `;
        }

        if (post.formato?.toLowerCase() === "carrossel" || post.media.length > 1) {
          iconContainer.innerHTML += `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="24" height="24">  
      <rect x="128" y="128" width="208" height="208" rx="48" ry="48" fill="#fff"/>  
      <path d="M386 230v110a48 48 0 0 1-48 48H230" fill="none" stroke="#fff" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/>  
    </svg>
          `;
        }

        container.appendChild(iconContainer);

        // Ação de abrir modal
        container.onclick = () => openModal(post.media, post.thumbnail, post.formato?.toLowerCase());
        grid.appendChild(container);
      });
    }
  } catch (error) {
    console.error("Erro ao carregar posts:", error);
  }
  }

function openModal(mediaUrls, thumbnail, formato) {
  const modal = document.getElementById("modal");
  const slidesContainer = document.getElementById("slidesContainer");
  const dotsContainer = document.getElementById("dotsContainer");

  if (!modal || !slidesContainer || !dotsContainer) return;

  slidesContainer.innerHTML = "";
  dotsContainer.innerHTML = "";
  currentSlide = 0;
  totalSlides = mediaUrls.length;

  mediaUrls.forEach((url, index) => {
    const isVideo = url.endsWith(".mp4");
    const isEmbed = isEmbedUrl(url);

    let slide;
    if (isEmbed) {
      slide = document.createElement("iframe");
      slide.src = convertToEmbedUrl(url);
      slide.width = "100%";
      slide.height = "100%";
      slide.style.border = "none";
      slide.setAttribute("allowfullscreen", "true");
      slide.setAttribute("loading", "lazy");
      slide.style.aspectRatio = "16/9";
      slide.style.resize = "none";
    } else if (isVideo) {
      slide = document.createElement("video");
      slide.src = url;
      slide.controls = true;
      if (thumbnail) {
        slide.poster = thumbnail;
      }
    } else {
      slide = document.createElement("img");
      slide.src = url;
    }

    slide.className = "slide";

    // Garantindo atributos em vídeos
    if (isVideo) {
      slide.controls = true;
      if (thumbnail) {
        slide.poster = thumbnail;
      }
    }

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

  currentSlide = index;
  updateSlideUI();
}

function updateSlideUI() {
  const slides = document.querySelectorAll("#slidesContainer .slide");
  const dots = document.querySelectorAll("#dotsContainer .dot");
  const slideCount = document.getElementById("slideCount");
  const dotsContainer = document.getElementById("dotsContainer");

  slides.forEach((slide) => slide.classList.remove("active"));
  slides[currentSlide].classList.add("active");

  dots.forEach((dot) => dot.classList.remove("active"));
  if (dots[currentSlide]) dots[currentSlide].classList.add("active");

  if (totalSlides > 1) {
    if (slideCount) slideCount.textContent = `${currentSlide + 1} / ${totalSlides}`;
    if (slideCount) slideCount.style.display = "block";
    if (dotsContainer) dotsContainer.style.display = "flex";
  } else {
    if (slideCount) slideCount.style.display = "none";
    if (dotsContainer) dotsContainer.style.display = "none";
  }
  updateArrowVisibility();
  }

function updateArrowVisibility() {
  const left = document.querySelector(".arrow.left");
  const right = document.querySelector(".arrow.right");

  if (left) left.style.display = currentSlide > 0 ? "flex" : "none";
  if (right) right.style.display = currentSlide < totalSlides - 1 ? "flex" : "none";
}

function fecharPopup() {
  const modal = document.getElementById("modal");
  if (modal) {
    const videos = modal.querySelectorAll("video");
    videos.forEach((video) => {
      video.pause();
      video.currentTime = 0;
    });

    modal.style.display = "none";

    // Forçar reestilização de iframes do grid após o modal ser fechado
document.querySelectorAll(".grid-item iframe[src*='canva.com']").forEach((iframe) => {
  iframe.style.pointerEvents = "none";
});
  }
}

// Botão fechar (remove duplicidade)
document.getElementById("closeModal")?.addEventListener("click", fecharPopup);

// Setas de navegação
document.querySelector(".arrow.left")?.addEventListener("click", () => {
  showSlide(currentSlide - 1);
});

document.querySelector(".arrow.right")?.addEventListener("click", () => {
  showSlide(currentSlide + 1);
});

function formatDate(dateString) {
  const date = new Date(dateString);
  const adjustedDate = new Date(date.getTime() + 3 * 60 * 60 * 1000); // Ajuste de fuso horário (+3h)

  const day = String(adjustedDate.getDate()).padStart(2, '0');
  const month = adjustedDate.toLocaleString('pt-BR', { month: 'short' });
  const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1).toLowerCase();
  const year = String(adjustedDate.getFullYear()).slice(-2);

  return `${day} ${capitalizedMonth} ${year}`;
}

function toggleHide(postId, shouldHide) {
  const postEl = document.querySelector(`.grid-item[data-id="${postId}"]`);
  if (!postEl) return;

  if (shouldHide) {
    postEl.remove(); // Remove do DOM imediatamente
  } else {
    loadPosts(); // Recarrega para exibir novamente
  }
}

document.addEventListener("DOMContentLoaded", loadPosts);

// Fecha o modal ao clicar fora da área central do pop-up
document.getElementById("modal")?.addEventListener("click", (event) => {
  const modalContent = document.getElementById("modalContent");
  if (modalContent && !modalContent.contains(event.target)) {
    fecharPopup();
  }
});

document.getElementById("refresh")?.addEventListener("click", async () => {
  const btn = document.getElementById("refresh");
  btn.classList.add("loading");

  // Salva o SVG novo como original
  const originalSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" transform="rotate(90)">
      <path d="m2 12 4 4 4-4"/>
      <path d="M6 16V8a6 6 0 0 1 6-6"/>
      <path d="M22 12l-4-4-4 4"/>
      <path d="M18 8v8a6 6 0 0 1-6 6"/>
    </svg>
  `;

  // Substitui por spinner animado
  btn.innerHTML = `
    <svg class="spinner" width="16" height="16" viewBox="0 0 50 50">
      <circle class="spinner-circle" cx="25" cy="25" r="20" fill="none" stroke="currentColor"
        stroke-width="4" stroke-linecap="round" stroke-dasharray="31.4 31.4"
        transform="rotate(-90 25 25)">
        <animateTransform attributeName="transform" type="rotate" values="0 25 25;360 25 25"
          dur="1s" repeatCount="indefinite" />
      </circle>
    </svg>
  `;

  await loadPosts(); // recarrega o grid

  // Volta para o novo SVG
  btn.innerHTML = originalSVG;
  btn.classList.remove("loading");
});

const toggleThemeBtn = document.getElementById("toggleTheme");

const sunSVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42
             M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>
`;

const moonSVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 
             7 7 0 0 0 21 12.79"/>
  </svg>
`;

function updateThemeIcon(isDark) {
  if (toggleThemeBtn) {
    toggleThemeBtn.innerHTML = isDark ? sunSVG : moonSVG;
  }
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('light-mode', !isDark);
  document.body.classList.toggle('dark-mode', isDark);
  updateThemeIcon(isDark);
  localStorage.setItem('theme', theme);
}

// Aplicar tema salvo ao carregar
const savedTheme = localStorage.getItem('theme') || 'dark';
applyTheme(savedTheme);

// Alternar tema no clique
toggleThemeBtn?.addEventListener("click", () => {
  const isCurrentlyDark = document.body.classList.contains("dark-mode");
  applyTheme(isCurrentlyDark ? 'light' : 'dark');
});

// Toggle do menu
const filterBtn = document.getElementById("filterBtn");
const filterMenu = document.getElementById("filterMenu");
let currentFilter = "all";

filterBtn?.addEventListener("click", () => {
  filterMenu.style.display = (filterMenu.style.display === "flex") ? "none" : "flex";
});

// Clicar fora fecha o menu
document.addEventListener("click", (e) => {
  if (!filterMenu.contains(e.target) && e.target !== filterBtn) {
    filterMenu.style.display = "none";
  }
});

// Clique nas opções
filterMenu?.addEventListener("click", (e) => {
  if (e.target.dataset.filter) {
    currentFilter = normalize(e.target.dataset.filter);
    applyFilter();
    filterMenu.style.display = "none";
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    fecharPopup();
  }
});

function normalize(str) {
  return str?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function applyFilter() {
  const grid = document.getElementById("grid");
  if (!grid) return;

  fetch(`${API_URL}?t=${Date.now()}`)
    .then((res) => res.json())
    .then((posts) => {
      const filtered = posts.filter((post) => {
        return currentFilter === "all" || normalize(post.formato) === normalize(currentFilter);
      });

      grid.innerHTML = "";

      if (filtered.length === 0) {
        grid.classList.add("empty");
      } else {
        grid.classList.remove("empty");

        filtered.forEach((post) => {
          const mediaUrl = post.media[0];
          const isVideo = post.formato === "vídeo" || post.formato === "video";
          const isCarousel = post.formato === "carrossel";
          const isReel = post.formato === "reels";
          const isImage = post.formato === "imagem";

          const isEmbed = isEmbedUrl(mediaUrl);
          
          const container = document.createElement("div");
          container.className = "grid-item";
          container.dataset.id = post.id;
          container.dataset.type = normalize(post.formato);

          let el;
          
          if (isVideo || isReel) {
            el = document.createElement("video");
            el.src = mediaUrl;
            el.muted = true;
            el.playsInline = true;
            el.preload = "metadata";
            if (post.thumbnail) {
              el.poster = post.thumbnail;
            }
          } else if (isImage || isCarousel) {
         if
            (mediaUrl.includes("canva.com")){
            el = document.createElement("iframe");
            el.src = convertToEmbedUrl(mediaUrl); // usa função de conversão
            el.loading = "lazy";
            el.allowFullscreen = true;
            el.referrerPolicy = "no-referrer";
            el.classList.add("canva-embed");
            el.style.pointerEvents = "none";
          } else {
             el = document.createElement("img");
            el.src = mediaUrl;
          }
          }
    
          container.appendChild(el);

          // Overlay com editoria, título e data
          const overlay = document.createElement("div");
          overlay.className = "overlay";
          overlay.innerHTML = `
  ${post.editoria ? `<div class="editoria">${post.editoria}</div>` : ""}
  <div class="title">${post.title || ""}</div>
  ${
    post.date
      ? `<div class="date">${formatDate(post.date)}</div>`
      : `<div class="missing-date">⚠ Sem data</div>`
  }
`;
          container.appendChild(overlay);

          // Ícones
          const iconContainer = document.createElement("div");
          iconContainer.className = "icon-container";

          if (isVideo || isReel || mediaUrl.endsWith(".mp4")) {
            iconContainer.innerHTML += `
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>`;
          }

          if (isCarousel && !iconContainer.querySelector('svg')) {
  iconContainer.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="24" height="24">
      <rect x="128" y="128" width="208" height="208" rx="48" ry="48" fill="#fff"/>
      <path d="M386 230v110a48 48 0 0 1-48 48H230" fill="none" stroke="#fff" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
        }

          container.appendChild(iconContainer);
          container.onclick = () => openModal(post.media, post.thumbnail, post.formato);
          grid.appendChild(container);
        });
      }
    })
    .catch((error) => console.error("Erro ao filtrar posts:", error));
}
