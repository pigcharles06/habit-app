// static/js/main.js
// This script initializes the application and binds event listeners.

// --- DOM Element References ---
// Declare variables for elements needed across modules or for event binding.
// Core Layout
let workGalleryElement = null;
let uploadForm = null;
let modalElement = null;
let heroSlideshowElement = null;
let lightboxElement = null;

// Form Inputs (for gallery.js)
let authorNameInput = null;
let scorecardImageInput = null;
let comicImageInput = null;
let currentHabitsInput = null;
let reflectionInput = null;
let uploadStatusElement = null;

// Modal Content (for gallery.js)
let modalCloseButton = null;
let modalAuthor = null;
let modalCurrentHabits = null;
let modalReflection = null;
let modalScorecardImage = null;
let modalComicImage = null;

// AI Analysis Section (for gallery.js)
let analyzeButton = null;
let analysisLoading = null;
let analysisError = null;
let analysisResultContainer = null;
let analysisResultElement = null;
let readAloudButton = null;
let stopReadingButton = null;
let analysisAudioPlayer = null; // The <audio> element

// Lightbox Content (for gallery.js)
let lightboxImg = null;
let lightboxCaption = null;
let lightboxCloseButton = null;

// UI Elements (for ui.js)
let mobileMenuButtonElement = null;
let mobileMenuElement = null;
let interactiveCatContainerElement = null;
let interactiveCatImgElement = null;
let particlesJsElement = null;


// --- Main Initialization Logic ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded. Initializing application...");

    // --- Assign DOM Elements ---
    // Helper function to get elements and log warnings if missing
    const getElement = (id, isCritical = false) => {
        const el = document.getElementById(id);
        if (!el && isCritical) {
            console.error(`CRITICAL Error: Element with ID '${id}' not found!`);
        } else if (!el) {
            console.warn(`Element with ID '${id}' not found.`);
        }
        return el;
    };

    // Assign all elements, marking critical ones
    workGalleryElement = getElement('work-gallery', true);
    uploadForm = getElement('upload-form', true);
    modalElement = getElement('work-modal', true);
    heroSlideshowElement = getElement('hero-slideshow', true);
    lightboxElement = getElement('image-lightbox', true);
    analysisAudioPlayer = getElement('analysis-audio-player', true); // Audio player is critical now

    authorNameInput = getElement('author-name');
    scorecardImageInput = getElement('scorecard-image');
    comicImageInput = getElement('comic-image');
    currentHabitsInput = getElement('current-habits');
    reflectionInput = getElement('reflection');
    uploadStatusElement = getElement('upload-status');

    // Query within modal only if modalElement exists
    modalCloseButton = modalElement?.querySelector('.modal-close');
    modalAuthor = getElement('modal-author');
    modalCurrentHabits = getElement('modal-current-habits');
    modalReflection = getElement('modal-reflection');
    modalScorecardImage = getElement('modal-scorecard-image');
    modalComicImage = getElement('modal-comic-image');

    analyzeButton = getElement('analyze-button');
    analysisLoading = getElement('analysis-loading');
    analysisError = getElement('analysis-error');
    analysisResultContainer = getElement('analysis-result-container');
    analysisResultElement = getElement('analysis-result');
    readAloudButton = getElement('read-aloud-button');
    stopReadingButton = getElement('stop-reading-button');

    // Query within lightbox only if lightboxElement exists
    lightboxCloseButton = lightboxElement?.querySelector('.lightbox-close');
    lightboxImg = getElement('lightbox-img');
    lightboxCaption = getElement('lightbox-caption');


    mobileMenuButtonElement = getElement('mobile-menu-button');
    mobileMenuElement = getElement('mobile-menu');
    interactiveCatContainerElement = getElement('interactive-cat-container');
    interactiveCatImgElement = getElement('interactive-cat-img');
    particlesJsElement = getElement('particles-js');


    // --- Initialize Page Components (Async) ---
    // This ensures components are initialized in the correct order, especially data-dependent ones.
    async function initializePage() {
        console.log("main.js: Initializing page components...");

        // 1. Initialize non-data-dependent UI (Particles, Cat, KeepAlive)
        // Check if function exists before calling
        if (typeof initParticles === 'function' && particlesJsElement) initParticles();
        else if (!particlesJsElement) console.warn("Skipping Particles init: Element missing.");
        else console.error("initParticles function not found.");

        if (typeof startCatAnimation === 'function' && interactiveCatImgElement) startCatAnimation(catNormalSpeed);
        else if (!interactiveCatImgElement) console.warn("Skipping Cat init: Element missing.");
        else console.error("startCatAnimation function not found.");

        if (typeof startKeepAliveTimer === 'function') startKeepAliveTimer();
        else console.error("startKeepAliveTimer function not found.");


        // 2. Load Gallery Data (which sets global `currentWorksData`)
        // Check if function exists before calling
        if (typeof loadAndRenderWorks === 'function') {
             try {
                 console.log("Loading gallery data...");
                 await loadAndRenderWorks(); // Wait for gallery data to load and render
                 console.log("Gallery data loaded.");

                 // 3. Initialize Slideshow (which depends on `currentWorksData`)
                 // Check if function exists before calling
                 if (typeof initializeSlideshow === 'function' && heroSlideshowElement) {
                    console.log("Initializing slideshow...");
                    initializeSlideshow();
                 } else if (!heroSlideshowElement) {
                    console.warn("Skipping Slideshow init: Element missing.");
                 } else {
                    console.error("initializeSlideshow function not found.");
                 }

             } catch(galleryError) {
                 console.error("Error during gallery loading:", galleryError);
                 // Slideshow might still try to init with empty data if the function exists
                  if (typeof initializeSlideshow === 'function' && heroSlideshowElement) initializeSlideshow();
             }
         } else {
             console.error("loadAndRenderWorks function not found. Gallery and Slideshow cannot load.");
             // If gallery fails, ensure slideshow shows placeholder
             if (typeof initializeSlideshow === 'function' && heroSlideshowElement) {
                  slideshowImageUrls = []; // Ensure empty data for slideshow
                  initializeSlideshow();
             }
         }

         // 4. Setup Global Image Error Handling (using utils.js)
         // Needs utils.js and handleImageError function
         if (typeof handleImageError === 'function') {
             document.querySelectorAll('img').forEach(img => {
                  // Add handler only if it doesn't have one and isn't the cat
                  if (!img.onerror && img.id !== 'interactive-cat-img') {
                      img.onerror = function() { handleImageError(this, '圖片載入失敗'); };
                  }
             });
             console.log("Global image error handler set up.");
         } else {
              console.warn("handleImageError function (from utils.js) not found. Image errors may not be handled visually.");
         }

        // 5. Setup Audio Player Listeners (using gallery.js)
        // Needs gallery.js and setupAudioPlayerListeners function
        if (typeof setupAudioPlayerListeners === 'function') {
            setupAudioPlayerListeners();
            console.log("Audio player listeners set up.");
        } else {
            console.error("setupAudioPlayerListeners function (from gallery.js) not found. Audio playback UI may not update correctly.");
        }

        console.log("main.js: Page initialization sequence complete.");
    }

    // Start the initialization process
    initializePage().catch(err => {
        console.error("Error during page initialization:", err);
        // Maybe display a general error message to the user
    });


    // --- Bind Event Listeners ---
    // Bind listeners after ensuring the elements exist and potentially after initialization.
    console.log("main.js: Binding event listeners...");

    // Upload Form (Handled by gallery.js -> handleWorkUpload)
    if (uploadForm && typeof handleWorkUpload === 'function') {
        uploadForm.addEventListener('submit', async (event) => {
            const success = await handleWorkUpload(event); // Await gallery handler
            if (success) { // If upload was successful...
                 console.log("Upload successful, reloading gallery and slideshow via main.js coordination...");
                 // Re-load gallery and re-initialize slideshow *after* successful upload
                 await loadAndRenderWorks();
                 if (typeof initializeSlideshow === 'function') initializeSlideshow();
            }
        });
        console.log("Listener bound: Upload form submit (coordinated).");
    } // Warnings handled during element assignment

    // Mobile Menu (Handled by ui.js -> toggleMobileMenu)
    if (mobileMenuButtonElement && typeof toggleMobileMenu === 'function') {
        mobileMenuButtonElement.addEventListener('click', toggleMobileMenu);
        console.log("Listener bound: Mobile menu toggle.");
    } // Warnings handled during element assignment

    // Interactive Cat (Handled by ui.js -> handleCatClick)
    if (interactiveCatContainerElement && typeof handleCatClick === 'function') {
        interactiveCatContainerElement.addEventListener('click', handleCatClick);
        console.log("Listener bound: Interactive cat click.");
    } // Warnings handled during element assignment

    // Smooth Scrolling (Handled by ui.js -> handleSmoothScroll)
    if (typeof handleSmoothScroll === 'function') {
        document.body.addEventListener('click', (event) => {
            const anchor = event.target.closest('a[href^="#"]');
            if (anchor) handleSmoothScroll(event); // Delegate to ui.js function
        });
        console.log("Listener bound: Smooth scroll (delegated).");
    } else console.warn("handleSmoothScroll (from ui.js) not found.");

    // Modal Close Mechanisms (Handled by gallery.js -> closeWorkModal)
    if (modalElement && typeof closeWorkModal === 'function') {
        if (modalCloseButton) modalCloseButton.addEventListener('click', closeWorkModal);
        else console.warn("Modal close button not found inside modal.");
        modalElement.addEventListener('click', (e) => { if (e.target === modalElement) closeWorkModal(); }); // Background click
        window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalElement.style.display === 'block') closeWorkModal(); }); // Escape key
        console.log("Listeners bound: Modal close mechanisms.");
    } // Warnings handled during element assignment

    // AI Analyze Button (Handled by gallery.js -> handleAnalyzeClick)
    if (analyzeButton && typeof handleAnalyzeClick === 'function') {
        analyzeButton.addEventListener('click', handleAnalyzeClick);
        console.log("Listener bound: AI Analyze button.");
    } // Warnings handled during element assignment

    // Read Aloud Button (Handled by gallery.js -> playAnalysisAudio)
    if (readAloudButton && typeof playAnalysisAudio === 'function') {
        readAloudButton.addEventListener('click', playAnalysisAudio);
        console.log("Listener bound: Read Aloud (Play Audio) button.");
    } else console.warn("playAnalysisAudio function (from gallery.js) not found.");

    // Stop Reading Button (Handled by gallery.js -> stopAnalysisAudio)
    if (stopReadingButton && typeof stopAnalysisAudio === 'function') {
        stopReadingButton.addEventListener('click', stopAnalysisAudio);
        console.log("Listener bound: Stop Reading (Stop Audio) button.");
    } else console.warn("stopAnalysisAudio function (from gallery.js) not found.");

    // Lightbox Close Mechanisms (Handled by gallery.js -> closeLightbox)
    if (lightboxElement && typeof closeLightbox === 'function') {
         if (lightboxCloseButton) lightboxCloseButton.addEventListener('click', closeLightbox);
         else console.warn("Lightbox close button not found inside lightbox.");
         lightboxElement.addEventListener('click', (e) => { if (e.target === lightboxElement) closeLightbox(); }); // Background click
         window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lightboxElement.style.display === 'flex') closeLightbox(); }); // Escape key
         console.log("Listeners bound: Lightbox close mechanisms.");
    } // Warnings handled during element assignment

    // Modal Image Click for Lightbox (Event Delegation on Modal)
    // (Handled by gallery.js -> openLightbox)
    if (modalElement && typeof openLightbox === 'function') {
        modalElement.addEventListener('click', (event) => {
            const img = event.target.closest('img.modal-image--clickable');
            if (img?.dataset.originalSrc) {
                openLightbox(img.dataset.originalSrc, img.alt);
            }
        });
        console.log("Listener bound: Modal image click for lightbox (delegated).");
    } // Warnings handled during element assignment


    console.log("main.js: All event listeners bound.");

}); // End of DOMContentLoaded listener