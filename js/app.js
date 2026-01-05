/**
 * Ronin Ventures - Project Hub
 * Main application controller
 */

class RoninHub {
    constructor() {
        this.projects = [];
        this.currentFilter = 'all';
        this.modal = document.getElementById('project-modal');
        this.init();
    }

    async init() {
        await this.loadProjects();
        this.renderFeaturedProjects();
        this.renderAllProjects();
        this.bindEvents();
        this.updateProjectCount();
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
        if (this.currentFilter === 'all') {
            return this.projects;
        }
        if (this.currentFilter === 'featured') {
            return this.getFeaturedProjects();
        }
        return this.projects.filter(p => p.category === this.currentFilter);
    }

    renderFeaturedProjects() {
        const container = document.getElementById('featured-projects');
        const featured = this.getFeaturedProjects();
        
        if (featured.length === 0) {
            document.getElementById('featured-grid').style.display = 'none';
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
                    <div class="empty-state-icon">◇</div>
                    <p>No projects found in this category</p>
                </div>
            `;
            return;
        }

        container.innerHTML = projects.map(project => this.createProjectCard(project)).join('');
        this.updateProjectCount();
    }

    createFeaturedCard(project) {
        const statusClass = project.status === 'beta' ? 'beta' : 
                           project.status === 'archived' ? 'archived' : '';
        
        return `
            <article class="featured-card" data-project-id="${project.id}">
                <div class="featured-card-image">
                    <img src="${project.thumbnail}" alt="${project.title}" loading="lazy">
                    <span class="featured-badge">Featured</span>
                </div>
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
            <article class="project-card" data-project-id="${project.id}">
                <div class="project-card-image">
                    <img src="${project.thumbnail}" alt="${project.title}" loading="lazy">
                </div>
                <div class="project-card-content">
                    <span class="project-card-category">${project.categoryLabel}</span>
                    <h3 class="project-card-title">${project.title}</h3>
                    <p class="project-card-description">${project.shortDescription}</p>
                </div>
            </article>
        `;
    }

    openModal(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        // Populate modal content
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

        // Launch button - use externalUrl if set, otherwise use path
        const launchBtn = document.getElementById('modal-launch');
        const launchUrl = project.externalUrl || project.path;
        launchBtn.href = launchUrl;
        // Open in new tab for all experiences
        launchBtn.target = '_blank';
        launchBtn.rel = 'noopener noreferrer';
        
        // Update button text based on type
        const isExternal = !!project.externalUrl;
        launchBtn.innerHTML = isExternal 
            ? '<span class="btn-icon">↗</span> Open Site'
            : '<span class="btn-icon">▶</span> Launch Experience';
        
        // Source button
        const sourceBtn = document.getElementById('modal-source');
        if (project.sourceUrl) {
            sourceBtn.href = project.sourceUrl;
            sourceBtn.style.display = 'inline-flex';
        } else {
            sourceBtn.style.display = 'none';
        }

        // Show modal
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update active nav button
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        // Toggle featured section visibility
        const featuredSection = document.getElementById('featured-grid');
        if (filter === 'all' || filter === 'featured') {
            featuredSection.style.display = 'block';
        } else {
            featuredSection.style.display = 'none';
        }

        this.renderAllProjects();
    }

    updateProjectCount() {
        const count = this.getFilteredProjects().length;
        document.getElementById('project-count').textContent = 
            `${count} project${count !== 1 ? 's' : ''}`;
    }

    bindEvents() {
        // Filter buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setFilter(btn.dataset.filter);
            });
        });

        // Project cards (open modal)
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.featured-card, .project-card');
            if (card) {
                this.openModal(card.dataset.projectId);
            }
        });

        // Close modal
        document.getElementById('modal-close').addEventListener('click', () => {
            this.closeModal();
        });

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.closeModal();
            }
        });
    }
}

// Initialize the hub when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.roninHub = new RoninHub();
});
