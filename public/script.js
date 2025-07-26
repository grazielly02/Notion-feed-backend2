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
        container.dataset.type =
          post.media.length > 1
            ? "carousel"
            : isEmbed
            ? "embed"
            : isVideo
            ? "video"
            : "image";

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

        // Garante que vídeos tenham atributos corretos
        if (isVideo) {
          el.muted = true;
          el.playsInline = true;
          el.preload = "metadata";
          if (post.thumbnail) {
            el.poster = post.thumbnail;
          }
        }

        container.appendChild(el);

        // Overlay com título, editoria e data
        const overlay = document.createElement("div");
        overlay.className = "overlay";
        overlay.innerHTML = `
          ${post.editoria ? `<div class="editoria">${post.editoria}</div>` : ""}
          <div class="title">${post.title || ""}</div>
          ${post.date ? `<div class="date">${formatDate(post.date)}</div>` : ""}
        `;
        container.appendChild(overlay);

        // Ícones (vídeo e múltiplas mídias)
        const iconContainer = document.createElement("div");
        iconContainer.className = "icon-container";

        if (isVideo) {
          iconContainer.innerHTML += `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          `;
        }

        if (post.media.length > 1) {
          iconContainer.innerHTML += `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect x="5" y="5" width="12" height="12" rx="2" ry="2" fill="white" opacity="0.8"/>
              <rect x="7" y="7" width="12" height="12" rx="2" ry="2" fill="white"/>
            </svg>
          `;
        }

        container.appendChild(iconContainer);

        // Ação de abrir modal
        container.onclick = () => openModal(post.media, post.thumbnail);
        grid.appendChild(container);
      });
    }
  } catch (error) {
    console.error("Erro ao carregar posts:", error);
  }
  }

function openModal(mediaUrls, thumbnail) {
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

  slides.forEach((slide) => slide.classList.remove("active"));
  dots.forEach((dot) => dot.classList.remove("active"));
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
  const originalText = btn.innerHTML;

  btn.innerHTML = `
    <svg class="spinner" width="16" height="16" viewBox="0 0 50 50">
      <circle class="spinner-circle" cx="25" cy="25" r="20" fill="none" stroke-width="4" stroke-linecap="round"
        stroke-dasharray="31.4 31.4" transform="rotate(-90 25 25)">
        <animateTransform attributeName="transform" type="rotate" values="0 25 25;360 25 25" dur="1s" repeatCount="indefinite"/>
      </circle>
    </svg>
  `;

  await loadPosts(); // recarrega o grid
  btn.innerHTML = "⟳"; // volta ao texto original
  btn.classList.remove("loading");
});

// Aplicar tema salvo ao carregar
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
  document.body.classList.add('light-mode');
  document.body.classList.remove('dark-mode');
  const btn = document.getElementById("toggleTheme");
  if (btn) btn.textContent = "☀︎";
} else {
  document.body.classList.add('dark-mode');
  document.body.classList.remove('light-mode');
  const btn = document.getElementById("toggleTheme");
  if (btn) btn.textContent = "❨";
}

// Evento para alternar o tema e salvar escolha
document.getElementById("toggleTheme")?.addEventListener("click", () => {
  document.body.classList.toggle("light-mode");
  const isLight = document.body.classList.contains("light-mode");
  const btn = document.getElementById("toggleTheme");
  if (btn) btn.textContent = isLight ? "☀︎" : "❨";

  // Salvar escolha no localStorage
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
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
    currentFilter = e.target.dataset.filter;
    applyFilter();
    filterMenu.style.display = "none";
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    fecharPopup();
  }
});

function applyFilter() {
  const grid = document.getElementById("grid");
  if (!grid) return;

  fetch(`${API_URL}?t=${Date.now()}`)
    .then((res) => res.json())
    .then((posts) => {
      const filtered = posts.filter((post) => {
        const mediaUrl = post.media[0];
        const type = post.media.length > 1
          ? "carousel"
          : mediaUrl.endsWith(".mp4")
          ? "video"
          : isEmbedUrl(mediaUrl)
          ? "embed"
          : "image";

        return currentFilter === "all" || type === currentFilter;
      });

      grid.innerHTML = "";

      if (filtered.length === 0) {
        grid.classList.add("empty");
      } else {
        grid.classList.remove("empty");

        filtered.forEach((post) => {
          const mediaUrl = post.media[0];
          const isVideo = mediaUrl.endsWith(".mp4");
          const isCarousel = post.media.length > 1;
          const isEmbed = isEmbedUrl(mediaUrl);

          const container = document.createElement("div");
          container.className = "grid-item";
          container.dataset.id = post.id;
          container.dataset.type = isCarousel
            ? "carousel"
            : isVideo
            ? "video"
            : isEmbed
            ? "embed"
            : "image";

          let el;
          if (isVideo) {
            el = document.createElement("video");
            el.src = mediaUrl;
            el.muted = true;
            el.playsInline = true;
            el.preload = "metadata";
            if (post.thumbnail) {
              el.poster = post.thumbnail;
            }
          } else if (isEmbed) {
            el = document.createElement("iframe");
            el.src = convertToEmbedUrl(mediaUrl); // usa função de conversão
            el.loading = "lazy";
            el.allowFullscreen = true;
            el.referrerPolicy = "no-referrer";
            el.style.border = "none";
          } else {
            el = document.createElement("img");
            el.src = mediaUrl;
          }

          container.appendChild(el);

          // Overlay com editoria, título e data
          const overlay = document.createElement("div");
          overlay.className = "overlay";
          overlay.innerHTML = `
            ${post.editoria ? `<div class="editoria">${post.editoria}</div>` : ""}
            <div class="title">${post.title || ""}</div>
            ${post.date ? `<div class="date">${formatDate(post.date)}</div>` : ""}
          `;
          container.appendChild(overlay);

          // Ícones
          const iconContainer = document.createElement("div");
          iconContainer.className = "icon-container";

          if (isVideo) {
            iconContainer.innerHTML += `
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>`;
          }

          if (isCarousel) {
            iconContainer.innerHTML += `
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <rect x="5" y="5" width="12" height="12" rx="2" ry="2" fill="white" opacity="0.8"/>
                <rect x="7" y="7" width="12" height="12" rx="2" ry="2" fill="white"/>
              </svg>`;
          }

          if (isEmbed) {
            iconContainer.innerHTML += `
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M4 4h16v16H4z" fill="white"/>
                <path d="M7 7h10v10H7z" fill="#999"/>
              </svg>`;
          }

          container.appendChild(iconContainer);
          container.onclick = () => openModal(post.media, post.thumbnail);
          grid.appendChild(container);
        });
      }
    })
    .catch((error) => console.error("Erro ao filtrar posts:", error));
}
