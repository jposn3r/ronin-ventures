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
        const badge = project.comingSoon 
            ? '<span class="coming-soon-badge">Coming Soon</span>'
            : '<span class="featured-badge">Featured</span>';
        
        return `
            <article class="featured-card" data-project-id="${project.id}">
                <div class="featured-card-image">
                    <img src="${project.thumbnail}" alt="${project.title}" loading="lazy">
                    ${badge}
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

        // Launch button - handle coming soon vs available
        const launchBtn = document.getElementById('modal-launch');
        this.currentProject = project;
        
        if (project.comingSoon) {
            // Coming soon - show notify button
            launchBtn.href = '#';
            launchBtn.target = '';
            launchBtn.rel = '';
            launchBtn.className = 'btn-coming-soon';
            launchBtn.innerHTML = '<span class="btn-icon">◇</span> Coming Soon';
        } else {
            // Available - show launch button
            const launchUrl = project.externalUrl || project.path;
            launchBtn.href = launchUrl;
            launchBtn.target = '_blank';
            launchBtn.rel = 'noopener noreferrer';
            launchBtn.className = 'btn-launch';
            
            const isExternal = !!project.externalUrl;
            launchBtn.innerHTML = isExternal 
                ? '<span class="btn-icon">↗</span> Open Site'
                : '<span class="btn-icon">▶</span> Launch Experience';
        }

        // Stats - use project stats or generate placeholder data
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

        // Show modal
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    openNotifyModal() {
        this.notifyModal.classList.add('active');
        // Reset form state
        document.getElementById('notify-email').value = '';
        const form = document.querySelector('.notify-form');
        const success = document.querySelector('.notify-success');
        if (success) {
            success.remove();
        }
        form.style.display = 'flex';
    }

    closeNotifyModal() {
        this.notifyModal.classList.remove('active');
    }

    handleNotifySubmit() {
        const email = document.getElementById('notify-email').value;
        if (!email || !email.includes('@')) {
            document.getElementById('notify-email').style.borderColor = '#f43f5e';
            return;
        }
        
        // Show success message (this is just a stub)
        const form = document.querySelector('.notify-form');
        form.style.display = 'none';
        
        const successDiv = document.createElement('div');
        successDiv.className = 'notify-success';
        successDiv.innerHTML = `<p>Thanks! You'd be notified when <strong>${this.currentProject?.title || 'this project'}</strong> launches.</p>`;
        form.parentNode.insertBefore(successDiv, form);
        
        // Close after delay
        setTimeout(() => {
            this.closeNotifyModal();
        }, 2500);
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
            if (e.key === 'Escape' && this.notifyModal.classList.contains('active')) {
                this.closeNotifyModal();
            }
        });

        // Coming Soon button (opens notify modal)
        document.addEventListener('click', (e) => {
            const launchBtn = e.target.closest('#modal-launch');
            if (launchBtn && launchBtn.classList.contains('btn-coming-soon')) {
                e.preventDefault();
                this.openNotifyModal();
            }
        });

        // Notify modal events
        document.getElementById('notify-close').addEventListener('click', () => {
            this.closeNotifyModal();
        });

        this.notifyModal.addEventListener('click', (e) => {
            if (e.target === this.notifyModal) {
                this.closeNotifyModal();
            }
        });

        document.getElementById('notify-submit').addEventListener('click', () => {
            this.handleNotifySubmit();
        });

        document.getElementById('notify-email').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleNotifySubmit();
            }
            // Reset border color on typing
            e.target.style.borderColor = '';
        });
    }
}

// Initialize the hub when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.roninHub = new RoninHub();
});
