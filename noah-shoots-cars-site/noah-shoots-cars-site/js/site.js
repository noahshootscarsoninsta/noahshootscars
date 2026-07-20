// ---- Nav: hamburger toggle + active link highlight ----
document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.getElementById('navLinks');

                          function closeMenu() {
                              if (!navLinks || !hamburger) return;
                              navLinks.classList.remove('open');
                              hamburger.setAttribute('aria-expanded', 'false');
                          }
    function openMenu() {
        if (!navLinks || !hamburger) return;
        navLinks.classList.add('open');
        hamburger.setAttribute('aria-expanded', 'true');
    }

                          if (hamburger && navLinks) {
                              hamburger.setAttribute('aria-expanded', 'false');
                              hamburger.setAttribute('aria-controls', 'navLinks');
                              hamburger.addEventListener('click', (e) => {
                                  e.stopPropagation();
                                  if (navLinks.classList.contains('open')) closeMenu(); else openMenu();
                              });
                              navLinks.querySelectorAll('a').forEach(a => {
                                  a.addEventListener('click', closeMenu);
                              });
                              document.addEventListener('click', (e) => {
                                  if (!navLinks.classList.contains('open')) return;
                                  if (navLinks.contains(e.target) || hamburger.contains(e.target)) return;
                                  closeMenu();
                              });
                              document.addEventListener('keydown', (e) => {
                                  if (e.key === 'Escape' && navLinks.classList.contains('open')) closeMenu();
                              });
                          }

                          const here = document.body.dataset.page;
    document.querySelectorAll('.nav-links a').forEach(a => {
        a.classList.toggle('active', a.dataset.page === here);
    });
});

// ---- Lightbox (used on portfolio page) ----
function openLightbox(src) {
    const lb = document.getElementById('lightbox');
    const content = document.getElementById('lightboxContent');
    if (!lb || !content) return;
    content.innerHTML = '<img src="' + src + '" alt="">';
    lb.classList.add('open');
}
function closeLightbox(e) {
    if (!e || e.target.id === 'lightbox' || e.target.classList.contains('lightbox-close') || e.target.tagName === 'BUTTON') {
        document.getElementById('lightbox')?.classList.remove('open');
    }
}
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.getElementById('lightbox')?.classList.remove('open');
});

// ---- Image CDN helper ----
// Wraps an /images/uploads/... path so the browser fetches a resized,
// compressed, web-friendly version via Netlify's built-in Image CDN
// instead of the original (often multi-MB) camera file. The original
// file in the repo is untouched -- this only affects what gets served.
function cdnImg(path, width) {
    if (!path) return path;
    var w = width || 1200;
    return '/.netlify/images?url=' + encodeURIComponent(path) + '&w=' + w + '&q=75&fm=webp';
}


// ---- CMS-driven image loading ----
// These fetch the JSON files that Decap CMS (the /admin editor) writes to.
// Until Shielagh adds real photos in /admin, each grid falls back to a
// clearly-labeled placeholder tile so the layout never looks broken.

async function loadJSON(path) {
    try {
        const res = await fetch(path, { cache: 'no-store' });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

function placeholderTile(label, ratio) {
    const div = document.createElement('div');
    div.className = 'ph';
    if (ratio) div.style.aspectRatio = ratio;
    div.innerHTML = '<span><span>' + label + '</span><small>Add a photo in /admin</small></span>';
    div.querySelector('span').style.display = 'block';
    return div;
}

// Home page: hero background photo (single image, from content/hero.json)
async function loadHeroPhoto() {
    const el = document.getElementById('heroPhoto');
    if (!el) return;
    const data = await loadJSON('/content/hero.json');
    if (data && data.image) {
        const img = document.createElement('img');
        img.src = cdnImg(data.image, 1600);
        img.alt = 'Featured automotive photo';
        el.appendChild(img);
    }
}

// Home page: 4-photo "Featured Work" grid (content/featured.json)
// Each photo keeps its own natural aspect ratio -- nothing here is
// cropped or forced into a fixed shape.
async function loadFeatured() {
    const grid = document.getElementById('featuredGrid');
    if (!grid) return;
    const data = await loadJSON('/content/featured.json');
    const photos = (data && data.photos) || [];
    for (let i = 0; i < 4; i++) {
        const photo = photos[i];
        if (photo && photo.image) {
            const wrap = document.createElement('div');
            wrap.className = 'photo-tile-natural';
            const img = document.createElement('img');
            img.src = cdnImg(photo.image, 900);
            img.alt = photo.caption || 'Featured automotive photo';
            wrap.appendChild(img);
            grid.appendChild(wrap);
        } else {
            grid.appendChild(placeholderTile('Featured ' + (i + 1), '3 / 2'));
        }
    }
}

// Home / About: single photographer photo (content/profile.json)
async function loadProfilePhoto(targetId) {
    const el = document.getElementById(targetId);
    if (!el) return;
    const data = await loadJSON('/content/profile.json');
    if (data && data.image) {
        const img = document.createElement('img');
        img.src = cdnImg(data.image, 900);
        img.alt = 'The photographer';
        el.appendChild(img);
    } else {
        el.appendChild(placeholderTile('Photographer photo', '4/5'));
    }
}

// Portfolio page: full gallery grid (content/gallery.json)
async function loadGallery() {
    const grid = document.getElementById('masonryGrid');
    if (!grid) return;
    const data = await loadJSON('/content/gallery.json');
    const photos = (data && data.photos) || [];

if (photos.length === 0) {
    const msg = document.createElement('p');
    msg.textContent = 'No photos added yet — head to /admin to upload your first portfolio photos.';
    grid.appendChild(msg);
    return;
}

photos.forEach(photo => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    const img = document.createElement('img');
    img.src = cdnImg(photo.image, 900);
    img.alt = photo.caption || 'Portfolio photo';
    img.loading = 'lazy';
    img.addEventListener('click', () => openLightbox(cdnImg(photo.image, 1800)));
    tile.appendChild(img);
    grid.appendChild(tile);
});
}
