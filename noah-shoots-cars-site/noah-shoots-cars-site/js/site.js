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

// Escapes text before it's dropped into innerHTML, so CMS-entered text
// (show titles, locations, descriptions, etc.) can never break the page
// or inject markup, even though only Shielagh can edit that content.
function esc(s) {
	return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
	}[c]));
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

// ---- Upcoming Shows page (content/shows.json, edited in /admin) ----
function showStatusClass(status) {
	if (status === 'Maybe') return 'maybe';
	if (status === 'Completed') return 'completed';
	return 'going';
}
function showFmtDate(d) {
	if (!d) return '';
	const dt = new Date(d + 'T00:00:00');
	if (isNaN(dt.getTime())) return esc(d);
	return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
function showTimeRange(s) {
	return [s.startTime, s.endTime].filter(Boolean).map(esc).join(' – ');
}
function showCardHTML(s, featured) {
	const status = s.status || "I'll be there";
	return (
		'<div class="show-status ' + showStatusClass(s.status) + '">' + esc(status) + '</div>' +
		(s.image ? '<img src="' + cdnImg(s.image, featured ? 1200 : 700) + '" alt="">' : '') +
		'<' + (featured ? 'h2' : 'h3') + '>' + esc(s.title) + '</' + (featured ? 'h2' : 'h3') + '>' +
		'<div class="show-date">' + showFmtDate(s.date) + '</div>' +
		(showTimeRange(s) ? '<div class="show-time">' + showTimeRange(s) + '</div>' : '') +
		(s.location ? '<div class="show-location">' + esc(s.location) + '</div>' : '') +
		(s.address ? '<div class="show-address">' + esc(s.address) + '</div>' : '') +
		(s.description ? '<p class="show-desc">' + esc(s.description) + '</p>' : '') +
		(s.link ? '<a class="btn ' + (featured ? 'btn-accent' : 'btn-outline') + '" href="' + esc(s.link) + '" target="_blank" rel="noopener">Event info</a>' : '')
	);
}
async function loadShows() {
	const nextWrap = document.getElementById('nextShowWrap');
	const gridWrap = document.getElementById('showsGrid');
	if (!gridWrap) return;

	const data = await loadJSON('/content/shows.json');
	const shows = (data && data.shows) || [];

	if (!shows.length) {
		if (nextWrap) nextWrap.style.display = 'none';
		gridWrap.innerHTML = '<p>No shows added yet — check back soon.</p>';
		return;
	}

	const sorted = shows.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
	const todayStr = new Date().toISOString().slice(0, 10);
	let next = sorted.find(s => s.status !== 'Completed' && s.date >= todayStr);
	if (!next) next = sorted.find(s => s.status !== 'Completed') || sorted[0];

	if (nextWrap && next) {
		nextWrap.innerHTML = '<div class="eyebrow">Next Show</div><div class="show-featured">' + showCardHTML(next, true) + '</div>';
	} else if (nextWrap) {
		nextWrap.style.display = 'none';
	}

	gridWrap.innerHTML = '';
	sorted.forEach(s => {
		const card = document.createElement('div');
		card.className = 'show-card' + (s.status === 'Completed' ? ' status-completed' : '');
		card.innerHTML = showCardHTML(s, false);
		gridWrap.appendChild(card);
	});
}

// ---- Contact page: custom GoHighLevel-connected form ----
// Client-side checks here are just for a fast, friendly experience -- the
// Netlify function (netlify/functions/contact-submit.js) re-checks
// everything server-side before touching GoHighLevel, so nothing here needs
// to be trusted for correctness or security.
function initContactForm() {
	const form = document.getElementById('contactForm');
	if (!form) return;

	const msgBox = document.getElementById('contactFormMsg');
	const submitBtn = document.getElementById('contactSubmitBtn');

	function clearErrors() {
		form.querySelectorAll('.field.has-error').forEach(f => f.classList.remove('has-error'));
		msgBox.classList.remove('show');
		msgBox.textContent = '';
	}

	function showFieldError(input) {
		const field = input.closest('.field');
		if (field) field.classList.add('has-error');
	}

	function showFormMessage(text) {
		msgBox.textContent = text;
		msgBox.classList.add('show');
	}

	// Mirrors the required-field and conditional (contact-method-needs-a-way-
	// to-reach-you) rules enforced again on the server.
	function validate(data) {
		let firstInvalid = null;
		const invalid = (el) => { showFieldError(el); if (!firstInvalid) firstInvalid = el; };

		if (!data.name) invalid(form.elements.name);
		if (!data.phone && !data.email) {
			invalid(form.elements.phone);
			invalid(form.elements.email);
		}
		if (!data.requestType) invalid(form.elements.requestType);
		if (!data.contactMethod) invalid(form.elements.contactMethod);
		if (!data.message) invalid(form.elements.message);
		if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) invalid(form.elements.email);
		if (data.contactMethod === 'text' && !data.phone) invalid(form.elements.phone);
		if (data.contactMethod === 'email' && !data.email) invalid(form.elements.email);

		return firstInvalid;
	}

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		clearErrors();

		const data = {
			name: form.elements.name.value.trim(),
			phone: form.elements.phone.value.trim(),
			instagram: form.elements.instagram.value.trim(),
			email: form.elements.email.value.trim(),
			carInfo: form.elements.carInfo.value.trim(),
			requestType: form.elements.requestType.value,
			contactMethod: form.elements.contactMethod.value,
			message: form.elements.message.value.trim(),
			website: form.elements.website.value // honeypot
		};

		const firstInvalid = validate(data);
		if (firstInvalid) {
			showFormMessage('Please fix the highlighted field(s) below.');
			firstInvalid.focus();
			return;
		}

		submitBtn.disabled = true;
		submitBtn.textContent = 'Sending…';

		try {
			const res = await fetch('/.netlify/functions/contact-submit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			const result = await res.json().catch(() => ({}));

			if (res.ok && result.ok) {
				window.location.href = '/thank-you.html';
				return;
			}

			showFormMessage(result.error || 'Something went wrong sending your request. Please try again, or message Noah directly on Instagram.');
			submitBtn.disabled = false;
			submitBtn.textContent = 'Send Request';
		} catch (err) {
			showFormMessage("Couldn't reach the server. Check your connection and try again, or message Noah directly on Instagram.");
			submitBtn.disabled = false;
			submitBtn.textContent = 'Send Request';
		}
	});
}
