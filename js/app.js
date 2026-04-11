/**
 * Ronin Ventures - Project Hub
 * Main application controller
 */

class RoninHub {
    constructor() {
        this.projects = [];
        this.currentFilter = 'all';
        this.modal = document.getElementById('project-modal');
        this.notifyModal = document.getElementById('notify-modal');
        this.currentProject = null;
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.init();
    }

    async init() {
        await this.loadProjects();
        this.renderFeaturedProjects();
        this.renderAllProjects();
        this.bindEvents();
        this.updateProjectCount();
        await this.inlineSVGs();
        this.initScrollReveal();
    }

    async loadProjects() {
        try {
            const response = await fetch('/data/projects.json');
            const data = await response.json();
            this.projects = data.projects;
        } catch (error) {
            console.error('Failed to load projects:', error);
            this.projects = [];
        }
    }

    getFeaturedProjects() {
        return this.projects.filter(p => p.featured);
    }

    getFilteredProjects() {
        if (this.currentFilter === 'all') return this.projects;
        if (this.currentFilter === 'featured') return this.getFeaturedProjects();
        return this.projects.filter(p => p.category === this.currentFilter);
    }

    renderFeaturedProjects() {
        const container = document.getElementById('featured-projects');
        const featured = this.getFeaturedProjects();

        if (featured.length === 0) {
            document.getElementById('featured-section').style.display = 'none';
            return;
        }

        container.innerHTML = featured.map(project => this.createFeaturedCard(project)).join('');
    }

    renderAllProjects() {
        const container = document.getElementById('projects-grid');
        const projects = this.getFilteredProjects();

        if (projects.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#9671;</div>
                    <p>No projects found in this category</p>
                </div>
            `;
            return;
        }

        container.innerHTML = projects.map(project => this.createProjectCard(project)).join('');
        this.updateProjectCount();
    }

    createCardMedia(project) {
        const preview = project.preview;
        const src = (preview && preview.src) || project.thumbnail;

        if (preview && preview.type === 'video') {
            const poster = preview.poster || project.thumbnail;
            return `
                <div class="card-media" data-preview="video">
                    <img class="card-media-poster" src="${poster}" alt="${project.title}" loading="lazy">
                    <video src="${src}" muted loop playsinline preload="none" class="card-media-video"></video>
                </div>
            `;
        }

        return `
            <div class="card-media">
                <img src="${src}" alt="${project.title}" loading="lazy">
            </div>
        `;
    }

    createFeaturedCard(project) {
        const statusClass = project.status === 'beta' ? 'beta' :
                           project.status === 'archived' ? 'archived' : '';
        const badge = project.comingSoon
            ? '<span class="coming-soon-badge">Coming Soon</span>'
            : '<span class="featured-badge">Featured</span>';

        return `
            <article class="featured-card reveal" data-project-id="${project.id}">
                ${this.createCardMedia(project)}
                ${badge}
                <div class="featured-card-content">
                    <span class="featured-card-category">${project.categoryLabel}</span>
                    <h3 class="featured-card-title">${project.title}</h3>
                    <p class="featured-card-description">${project.shortDescription}</p>
                    <div class="featured-card-footer">
                        <div class="featured-card-tech">
                            ${project.tech.slice(0, 3).map(t => `<span class="tech-tag">${t}</span>`).join('')}
                        </div>
                        <div class="featured-card-status">
                            <span class="status-dot ${statusClass}"></span>
                            <span>${project.status}</span>
                        </div>
                    </div>
                </div>
            </article>
        `;
    }

    createProjectCard(project) {
        return `
            <article class="project-card reveal" data-project-id="${project.id}">
                ${this.createCardMedia(project)}
                <div class="project-card-content">
                    <span class="project-card-category">${project.categoryLabel}</span>
                    <h3 class="project-card-title">${project.title}</h3>
                    <p class="project-card-description">${project.shortDescription}</p>
                </div>
            </article>
        `;
    }

    // ── SVG Inlining ────────────────────────────────────────────────────

    async inlineSVGs() {
        const imgs = document.querySelectorAll('.card-media img[src$=".svg"]');
        const promises = Array.from(imgs).map(async (img) => {
            try {
                const resp = await fetch(img.src);
                const text = await resp.text();
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(text, 'image/svg+xml');
                const svg = svgDoc.documentElement;
                if (svg.nodeName !== 'svg') return;
                svg.setAttribute('aria-hidden', 'true');
                svg.style.width = '100%';
                svg.style.height = '100%';
                img.replaceWith(svg);
            } catch (e) {
                // Keep img fallback on error
            }
        });
        await Promise.all(promises);

        // On touch devices, auto-play SVGs when they scroll into view
        if (this.isTouchDevice) {
            this.initTouchSVGPlay();
        }
    }

    initTouchSVGPlay() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const svg = entry.target.querySelector('svg');
                if (!svg) return;
                if (entry.isIntersecting) {
                    svg.classList.add('playing');
                } else {
                    svg.classList.remove('playing');
                }
            });
        }, { threshold: 0.3 });

        document.querySelectorAll('.card-media').forEach(media => {
            observer.observe(media);
        });
    }

    // ── Scroll Reveal ───────────────────────────────────────────────────

    initScrollReveal() {
        // Tag section headers as reveal targets
        document.querySelectorAll('.section-header').forEach(el => {
            if (!el.classList.contains('reveal')) {
                el.classList.add('reveal');
            }
        });

        // Simple scroll-based reveal -check on scroll + initial call
        const revealVisible = () => {
            const viewH = window.innerHeight;
            document.querySelectorAll('.reveal:not(.revealed)').forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.top < viewH - 40) {
                    el.classList.add('revealed');
                }
            });
        };

        // Run immediately
        revealVisible();

        // Run on scroll (passive, debounced)
        if (!this._scrollRevealBound) {
            this._scrollRevealBound = true;
            let ticking = false;
            window.addEventListener('scroll', () => {
                if (!ticking) {
                    requestAnimationFrame(() => {
                        revealVisible();
                        ticking = false;
                    });
                    ticking = true;
                }
            }, { passive: true });
        }
    }

    // ── Modal ───────────────────────────────────────────────────────────

    openModal(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        document.getElementById('modal-hero-img').src = project.thumbnail;
        document.getElementById('modal-hero-img').alt = project.title;
        document.getElementById('modal-category').textContent = project.categoryLabel;
        document.getElementById('modal-title').textContent = project.title;
        document.getElementById('modal-description').textContent = project.description;
        document.getElementById('modal-status').textContent = project.status;
        document.getElementById('modal-tech').textContent = project.tech.join(', ');
        document.getElementById('modal-date').textContent = project.lastUpdated;

        // Screenshots
        const screenshotsContainer = document.getElementById('modal-screenshots');
        if (project.screenshots && project.screenshots.length > 0) {
            screenshotsContainer.innerHTML = project.screenshots
                .map(src => `<img src="${src}" alt="Screenshot" loading="lazy">`)
                .join('');
            screenshotsContainer.style.display = 'flex';
        } else {
            screenshotsContainer.style.display = 'none';
        }

        // Launch button
        const launchBtn = document.getElementById('modal-launch');
        this.currentProject = project;

        if (project.comingSoon) {
            launchBtn.href = '#';
            launchBtn.target = '';
            launchBtn.rel = '';
            launchBtn.className = 'btn-coming-soon';
            launchBtn.innerHTML = '<span class="btn-icon">&#9671;</span> Coming Soon';
        } else {
            const launchUrl = project.externalUrl || project.path;
            launchBtn.href = launchUrl;
            launchBtn.target = '_blank';
            launchBtn.rel = 'noopener noreferrer';
            launchBtn.className = 'btn-launch';
            const isExternal = !!project.externalUrl;
            launchBtn.innerHTML = isExternal
                ? '<span class="btn-icon">&#8599;</span> Open Site'
                : '<span class="btn-icon">&#9654;</span> Launch Experience';
        }

        // Stats
        const stats = project.stats || this.generatePlaceholderStats();
        document.getElementById('modal-visits').textContent = stats.visits;
        document.getElementById('modal-unique').textContent = stats.uniqueViews;
        document.getElementById('modal-time').textContent = stats.avgTime;

        // Source button
        const sourceBtn = document.getElementById('modal-source');
        if (project.sourceUrl) {
            sourceBtn.href = project.sourceUrl;
            sourceBtn.style.display = 'inline-flex';
        } else {
            sourceBtn.style.display = 'none';
        }

        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    openNotifyModal() {
        this.notifyModal.classList.add('active');
        document.getElementById('notify-email').value = '';
        const form = document.querySelector('.notify-form');
        const success = document.querySelector('.notify-success');
        if (success) success.remove();
        form.style.display = 'flex';
    }

    closeNotifyModal() {
        this.notifyModal.classList.remove('active');
    }

    handleNotifySubmit() {
        const email = document.getElementById('notify-email').value;
        if (!email || !email.includes('@')) {
            document.getElementById('notify-email').style.borderColor = '#ff453a';
            return;
        }

        const form = document.querySelector('.notify-form');
        form.style.display = 'none';

        const successDiv = document.createElement('div');
        successDiv.className = 'notify-success';
        successDiv.innerHTML = `<p>Thanks! You'd be notified when <strong>${this.currentProject?.title || 'this project'}</strong> launches.</p>`;
        form.parentNode.insertBefore(successDiv, form);

        setTimeout(() => this.closeNotifyModal(), 2500);
    }

    // ── Filtering ───────────────────────────────────────────────────────

    setFilter(filter) {
        this.currentFilter = filter;

        document.querySelectorAll('.nav-pill').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        const featuredSection = document.getElementById('featured-section');
        if (filter === 'all' || filter === 'featured') {
            featuredSection.style.display = '';
        } else {
            featuredSection.style.display = 'none';
        }

        this.renderAllProjects();

        // Re-inline SVGs and re-init scroll reveal after re-render
        this.inlineSVGs().then(() => {
            this.initScrollReveal();
        });
    }

    updateProjectCount() {
        const count = this.getFilteredProjects().length;
        document.getElementById('project-count').textContent =
            `${count} project${count !== 1 ? 's' : ''}`;
    }

    generatePlaceholderStats() {
        const visits = Math.floor(Math.random() * 9000) + 1000;
        const uniqueViews = Math.floor(visits * (0.6 + Math.random() * 0.3));
        const minutes = Math.floor(Math.random() * 8) + 1;
        const seconds = Math.floor(Math.random() * 60);
        return {
            visits: visits.toLocaleString(),
            uniqueViews: uniqueViews.toLocaleString(),
            avgTime: `${minutes}:${seconds.toString().padStart(2, '0')}`
        };
    }

    // ── Events ──────────────────────────────────────────────────────────

    bindEvents() {
        // Nav scroll effect
        const nav = document.getElementById('site-nav');
        window.addEventListener('scroll', () => {
            nav.classList.toggle('scrolled', window.scrollY > 60);
        }, { passive: true });

        // Filter pills
        document.querySelectorAll('.nav-pill').forEach(btn => {
            btn.addEventListener('click', () => this.setFilter(btn.dataset.filter));
        });

        // Project cards (open modal)
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.featured-card, .project-card');
            if (card) this.openModal(card.dataset.projectId);
        });

        // SVG hover animation (desktop only)
        if (!this.isTouchDevice) {
            document.addEventListener('mouseenter', (e) => {
                const card = e.target.closest('.featured-card, .project-card');
                if (!card) return;
                const svg = card.querySelector('.card-media svg');
                if (svg) svg.classList.add('playing');
                const video = card.querySelector('.card-media video');
                if (video) {
                    video.play().catch(() => {});
                    video.closest('.card-media').classList.add('playing');
                }
            }, true);

            document.addEventListener('mouseleave', (e) => {
                const card = e.target.closest('.featured-card, .project-card');
                if (!card) return;
                const svg = card.querySelector('.card-media svg');
                if (svg) svg.classList.remove('playing');
                const video = card.querySelector('.card-media video');
                if (video) {
                    video.pause();
                    video.closest('.card-media').classList.remove('playing');
                }
            }, true);
        }

        // Modal close
        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.notifyModal.classList.contains('active')) this.closeNotifyModal();
                else if (this.modal.classList.contains('active')) this.closeModal();
            }
        });

        // Coming Soon button
        document.addEventListener('click', (e) => {
            const launchBtn = e.target.closest('#modal-launch');
            if (launchBtn && launchBtn.classList.contains('btn-coming-soon')) {
                e.preventDefault();
                this.openNotifyModal();
            }
        });

        // Notify modal
        document.getElementById('notify-close').addEventListener('click', () => this.closeNotifyModal());
        this.notifyModal.addEventListener('click', (e) => {
            if (e.target === this.notifyModal) this.closeNotifyModal();
        });
        document.getElementById('notify-submit').addEventListener('click', () => this.handleNotifySubmit());
        document.getElementById('notify-email').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleNotifySubmit();
            e.target.style.borderColor = '';
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.roninHub = new RoninHub();
});
