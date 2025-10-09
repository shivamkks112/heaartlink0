// HeartLink PWA Installation and Registration Script

class HeartLinkPWA {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.init();
  }

  init() {
    this.registerServiceWorker();
    this.setupInstallPrompt();
    this.trackPWAEvents();
  }

  // Register Service Worker
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('HeartLink SW registered:', registration);
            
            // Check for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  this.showUpdateAvailable();
                }
              });
            });
          })
          .catch((error) => {
            console.log('HeartLink SW registration failed:', error);
          });
      });
    }
  }

  // Setup PWA Install Prompt
  setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('HeartLink PWA install prompt available');
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });

    // Check if already installed
    window.addEventListener('appinstalled', () => {
      console.log('HeartLink PWA installed');
      this.isInstalled = true;
      this.hideInstallButton();
      this.trackInstallation();
    });
  }

  // Show Install Button
  showInstallButton() {
    // Create install button if it doesn't exist
    if (!document.querySelector('.heartlink-install-btn')) {
      const installBtn = document.createElement('button');
      installBtn.className = 'heartlink-install-btn';
      installBtn.innerHTML = `
        <span>📱 Install HeartLink App</span>
      `;
      installBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #EC4899, #F97316);
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 25px;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(236, 72, 153, 0.3);
        z-index: 1000;
        font-size: 14px;
        transition: all 0.3s ease;
      `;
      
      installBtn.addEventListener('click', () => this.installPWA());
      installBtn.addEventListener('mouseover', () => {
        installBtn.style.transform = 'scale(1.05)';
      });
      installBtn.addEventListener('mouseout', () => {
        installBtn.style.transform = 'scale(1)';
      });
      
      document.body.appendChild(installBtn);
      
      // Auto-hide after 10 seconds
      setTimeout(() => {
        if (installBtn && !this.isInstalled) {
          installBtn.style.opacity = '0.7';
        }
      }, 10000);
    }
  }

  // Install PWA
  async installPWA() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      console.log('HeartLink PWA install outcome:', outcome);
      
      if (outcome === 'accepted') {
        this.trackInstallation();
      }
      
      this.deferredPrompt = null;
      this.hideInstallButton();
    }
  }

  // Hide Install Button
  hideInstallButton() {
    const installBtn = document.querySelector('.heartlink-install-btn');
    if (installBtn) {
      installBtn.remove();
    }
  }

  // Show Update Available
  showUpdateAvailable() {
    if (confirm('HeartLink has been updated! Refresh to get the latest features?')) {
      window.location.reload();
    }
  }

  // Track PWA Events
  trackPWAEvents() {
    // Track when PWA is opened
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      console.log('HeartLink opened as PWA');
      this.isInstalled = true;
    }

    // Track PWA performance
    if ('performance' in window) {
      window.addEventListener('load', () => {
        const perfData = performance.getEntriesByType('navigation')[0];
        console.log('HeartLink PWA load time:', perfData.loadEventEnd - perfData.fetchStart, 'ms');
      });
    }
  }

  // Track Installation Analytics
  trackInstallation() {
    console.log('HeartLink PWA installation tracked');
    // Add your analytics code here
    // Example: gtag('event', 'pwa_install', { app_name: 'HeartLink' });
  }

  // Check if PWA is installed
  static isPWAInstalled() {
    return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  }

  // Show PWA benefits modal
  showPWABenefits() {
    const modal = document.createElement('div');
    modal.className = 'heartlink-pwa-modal';
    modal.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
      ">
        <div style="
          background: white;
          padding: 30px;
          border-radius: 15px;
          max-width: 400px;
          text-align: center;
          margin: 20px;
        ">
          <h3 style="color: #EC4899; margin-bottom: 20px;">Install HeartLink App</h3>
          <p style="margin-bottom: 20px; color: #666;">
            🚀 Faster loading<br>
            📱 Native app experience<br>
            🔔 Push notifications<br>
            📵 Works offline
          </p>
          <button onclick="heartLinkPWA.installPWA(); this.parentElement.parentElement.remove();" 
                  style="
                    background: linear-gradient(135deg, #EC4899, #F97316);
                    color: white;
                    border: none;
                    padding: 12px 30px;
                    border-radius: 25px;
                    font-weight: bold;
                    margin-right: 10px;
                    cursor: pointer;
                  ">
            Install Now
          </button>
          <button onclick="this.parentElement.parentElement.remove();" 
                  style="
                    background: #f0f0f0;
                    border: none;
                    padding: 12px 20px;
                    border-radius: 25px;
                    cursor: pointer;
                  ">
            Maybe Later
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }
}

// Initialize HeartLink PWA
const heartLinkPWA = new HeartLinkPWA();

// Export for global use
window.heartLinkPWA = heartLinkPWA;