/**
 * Ronin Ventures - Back to Hub Component
 * Include this script in any project to add a consistent navigation back to the hub.
 * 
 * Usage: Add this to your project's HTML:
 * <script src="/components/back-to-hub.js"></script>
 */

(function() {
    'use strict';

    // Configuration
    const config = {
        hubUrl: '/',
        label: 'RV Dev',
        position: 'top-left', // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
        showOnMobile: true,
        fadeInDelay: 500
    };

    // Styles (injected to avoid external CSS dependency)
    const styles = `
        .ronin-back-btn {
            --ronin-bg: rgba(7, 8, 12, 0.85);
            --ronin-border: rgba(255, 255, 255, 0.1);
            --ronin-accent: #00d4aa;
            --ronin-text: #8b919a;
            
            position: fixed;
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
            font-size: 12px;
            padding: 8px 14px;
            background: var(--ronin-bg);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid var(--ronin-border);
            border-radius: 4px;
            color: var(--ronin-text);
            text-decoration: none;
            z-index: 99999;
            opacity: 0;
            transform: translateY(-10px);
            transition: all 0.25s ease;
        }
        
        .ronin-back-btn.visible {
            opacity: 1;
            transform: translateY(0);
        }
        
        .ronin-back-btn:hover {
            background: rgba(7, 8, 12, 0.95);
            border-color: var(--ronin-accent);
            color: var(--ronin-accent);
        }
        
        .ronin-back-btn:hover .ronin-back-icon {
            transform: translateX(-2px);
        }
        
        .ronin-back-icon {
            font-size: 14px;
            transition: transform 0.2s ease;
        }
        
        .ronin-back-btn.top-left { top: 16px; left: 16px; }
        .ronin-back-btn.top-right { top: 16px; right: 16px; }
        .ronin-back-btn.bottom-left { bottom: 16px; left: 16px; }
        .ronin-back-btn.bottom-right { bottom: 16px; right: 16px; }
        
        @media (max-width: 600px) {
            .ronin-back-btn.hide-mobile {
                display: none;
            }
            .ronin-back-btn {
                padding: 6px 10px;
                font-size: 11px;
            }
        }
    `;

    function init() {
        // Inject styles
        const styleElement = document.createElement('style');
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);

        // Create button
        const button = document.createElement('a');
        button.href = config.hubUrl;
        button.className = `ronin-back-btn ${config.position}`;
        if (!config.showOnMobile) {
            button.classList.add('hide-mobile');
        }
        
        button.innerHTML = `
            <span class="ronin-back-icon">←</span>
            <span class="ronin-back-label">${config.label}</span>
        `;

        document.body.appendChild(button);

        // Fade in after delay
        setTimeout(() => {
            button.classList.add('visible');
        }, config.fadeInDelay);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
