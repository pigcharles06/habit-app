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

// Modal Content (for gallery.js) - No AI elements here anymore
let modalCloseButton = null;
let modalAuthor = null;
let modalCurrentHabits = null;
let modalReflection = null;
let modalScorecardImage = null;
let modalComicImage = null;

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

// Chat Widget Elements (only main container needed for modal click logic)
let chatWidget = null;


// --- Main Initialization Logic ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded. Initializing application...");

    // --- Assign DOM Elements ---
    // Helper function remains the same
    const getElement = (id, isCritical = false) => {
        const el = document.getElementById(id);
        if (!el && isCritical) {
            console.error(`CRITICAL Error: Element with ID '${id}' not found! Application might break.`);
        } else if (!el) {
            console.warn(`Element with ID '${id}' not found.`);
        }
        return el;
    };

    // Assign Core elements
    workGalleryElement = getElement('work-gallery', true);
    uploadForm = getElement('upload-form', true);
    modalElement = getElement('work-modal', true);
    heroSlideshowElement = getElement('hero-slideshow', true);
    lightboxElement = getElement('image-lightbox', true);

    // Assign Form elements
    authorNameInput = getElement('author-name');
    scorecardImageInput = getElement('scorecard-image');
    comicImageInput = getElement('comic-image');
    currentHabitsInput = getElement('current-habits');
    reflectionInput = getElement('reflection');
    uploadStatusElement = getElement('upload-status');

    // Assign Modal Content elements (check modalElement exists)
    if (modalElement) {
         modalCloseButton = modalElement.querySelector('.modal-close');
         if (!modalCloseButton) console.warn("Modal close button (.modal-close) not found inside modal.");
    }
    modalAuthor = getElement('modal-author');
    modalCurrentHabits = getElement('modal-current-habits');
    modalReflection = getElement('modal-reflection');
    modalScorecardImage = getElement('modal-scorecard-image');
    modalComicImage = getElement('modal-comic-image');

    // Assign Lightbox elements (check lightboxElement exists)
    if (lightboxElement) {
        lightboxCloseButton = lightboxElement.querySelector('.lightbox-close');
         if (!lightboxCloseButton) console.warn("Lightbox close button (.lightbox-close) not found inside lightbox.");
    }
    lightboxImg = getElement('lightbox-img');
    lightboxCaption = getElement('lightbox-caption');


    // Assign UI elements
    mobileMenuButtonElement = getElement('mobile-menu-button');
    mobileMenuElement = getElement('mobile-menu');
    interactiveCatContainerElement = getElement('interactive-cat-container');
    interactiveCatImgElement = getElement('interactive-cat-img');
    particlesJsElement = getElement('particles-js');

    // Assign Chat Widget Element (Crucial for the modal background click logic)
    chatWidget = getElement('ai-chat-widget', true); // Make this critical, if it's missing the modal logic breaks


    // --- Initialize Page Components (Async) ---
    async function initializePage() {
        console.log("main.js: Initializing page components...");

        // 1. Initialize non-data-dependent UI
        if (typeof initParticles === 'function' && particlesJsElement) initParticles();
        else if (!particlesJsElement) console.warn("Skipping Particles init: Element missing.");
        else console.error("initParticles function (ui.js) not found.");

        if (typeof startCatAnimation === 'function' && interactiveCatImgElement) startCatAnimation(catNormalSpeed);
        else if (!interactiveCatImgElement) console.warn("Skipping Cat init: Element missing.");
        else console.error("startCatAnimation function (ui.js) not found.");

        if (typeof startKeepAliveTimer === 'function') startKeepAliveTimer();
        else console.error("startKeepAliveTimer function (keep-alive.js) not found.");

        // 2. Load Gallery Data & dependent components
        if (typeof loadAndRenderWorks === 'function') {
             try {
                 console.log("Loading gallery data...");
                 await loadAndRenderWorks(); // Wait for gallery data to load and render
                 console.log("Gallery data loaded.");

                 // Initialize Slideshow after gallery data is ready
                 if (typeof initializeSlideshow === 'function' && heroSlideshowElement) {
                    console.log("Initializing slideshow...");
                    initializeSlideshow(); // ui.js needs currentWorksData (global in gallery.js)
                 } else {
                    if (!heroSlideshowElement) console.warn("Skipping Slideshow init: Element missing.");
                    else console.error("initializeSlideshow function (ui.js) not found.");
                 }

             } catch(galleryError) {
                 console.error("Error during gallery loading:", galleryError);
                 // Still try to init slideshow to show potential placeholder
                 if (typeof initializeSlideshow === 'function' && heroSlideshowElement) initializeSlideshow();
             }
         } else {
             console.error("loadAndRenderWorks function (gallery.js) not found. Gallery and Slideshow cannot load.");
             if (typeof initializeSlideshow === 'function' && heroSlideshowElement) initializeSlideshow(); // Try anyway
         }

         // 3. Chat Widget Initialization (Handled by chatWidget.js's own DOMContentLoaded listener)
         // No explicit call needed here assuming chatWidget.js is self-initializing.

         // 4. Global Image Error Handling (utils.js)
         if (typeof handleImageError === 'function') {
             console.log("Global image error handler (handleImageError from utils.js) available.");
         } else {
              console.warn("handleImageError function (from utils.js) not found. Image errors might not be handled visually.");
         }

        console.log("main.js: Page initialization sequence complete.");
    }

    // Start the initialization process
    initializePage().catch(err => {
        console.error("CRITICAL Error during page initialization:", err);
        const body = document.querySelector('body');
        // Display a simple error message to the user
        if (body) body.insertAdjacentHTML('afterbegin', '<div style="position:fixed; top:0; left:0; width:100%; padding: 10px; background-color: red; color: white; text-align: center; z-index: 9999;">頁面初始化失敗，部分功能可能無法使用，請嘗試重新整理。</div>');
    });


    // --- Bind Event Listeners ---
    console.log("main.js: Binding event listeners...");

    // Upload Form Listener
    if (uploadForm && typeof handleWorkUpload === 'function') {
        uploadForm.addEventListener('submit', async (event) => {
            const uploadSuccess = await handleWorkUpload(event); // Let gallery handle logic & UI updates
            if (uploadSuccess === true) {
                 console.log("Upload successful, reloading gallery and slideshow...");
                 await loadAndRenderWorks(); // Reload data
                 if (typeof initializeSlideshow === 'function') initializeSlideshow(); // Refresh slideshow
            } else {
                 console.log("Upload handled by gallery.js, but was not successful or no explicit success.");
            }
        });
        console.log("Listener bound: Upload form submit.");
    } else {
        if (!uploadForm) console.error("Upload form element not found, cannot bind submit listener.");
        else console.error("handleWorkUpload function (gallery.js) not found, cannot bind submit listener.");
    }

    // Mobile Menu Listener
    if (mobileMenuButtonElement && typeof toggleMobileMenu === 'function') {
        mobileMenuButtonElement.addEventListener('click', toggleMobileMenu);
        console.log("Listener bound: Mobile menu toggle.");
    } else {
         if(!mobileMenuButtonElement) console.warn("Mobile menu button not found.");
         if(typeof toggleMobileMenu !== 'function') console.warn("toggleMobileMenu function (ui.js) not found.");
    }

    // Interactive Cat Listener
    if (interactiveCatContainerElement && typeof handleCatClick === 'function') {
        interactiveCatContainerElement.addEventListener('click', handleCatClick);
        console.log("Listener bound: Interactive cat click.");
    } else {
         if(!interactiveCatContainerElement) console.warn("Cat container not found.");
         if(typeof handleCatClick !== 'function') console.warn("handleCatClick function (ui.js) not found.");
    }

    // Smooth Scrolling Listener
    if (typeof handleSmoothScroll === 'function') {
        document.body.addEventListener('click', (event) => {
            const anchor = event.target.closest('a[href^="#"]'); // Find closest anchor link
            if (anchor) handleSmoothScroll(event); // Delegate if found
        });
        console.log("Listener bound: Smooth scroll (delegated).");
    } else console.warn("handleSmoothScroll function (ui.js) not found.");


    // --- Modal Close Mechanisms (with MODIFIED Background Click) ---
    if (modalElement && typeof closeWorkModal === 'function' && chatWidget) { // Ensure chatWidget exists for the logic
        // 1. Close Button
        if (modalCloseButton) {
             modalCloseButton.addEventListener('click', closeWorkModal);
        } else {
             console.warn("Modal close button not found, click listener not added.");
        }

        // 2. Background Click (Close ONLY if click is on background AND NOT inside chat widget)
        modalElement.addEventListener('click', (e) => {
            // Check if the direct target of the click is the modal background itself
            if (e.target === modalElement) {
                 // Now, check if this click event originated from within the chat widget element
                 if (chatWidget.contains(e.target)) {
                     // Click was on the background, but the target is inside the chat widget
                     // This scenario is unlikely if chat widget is properly positioned, but handles edge cases
                     console.log("Modal background click detected, but target is inside chat widget. Modal remains open.");
                 } else {
                     // Click was directly on the modal background and outside the chat widget
                     console.log("Modal background click detected outside chat widget. Closing modal.");
                     closeWorkModal();
                 }
            }
            // If e.target is modal-content or anything inside modal-content, do nothing here
        });

        // 3. Escape Key
        window.addEventListener('keydown', (e) => {
             if (e.key === 'Escape' && modalElement.style.display === 'block') {
                 closeWorkModal();
             }
        });
        console.log("Listeners bound: Modal close mechanisms (modified background click).");
    } else {
         if(!modalElement) console.warn("Modal element not found.");
         if(typeof closeWorkModal !== 'function') console.warn("closeWorkModal function (gallery.js) not found.");
         if(!chatWidget) console.warn("Chat widget element not found (needed for modal click logic).");
         console.warn("Modal close listeners not fully bound.");
    }


    // Lightbox Close Mechanisms Listener
    if (lightboxElement && typeof closeLightbox === 'function') {
         if (lightboxCloseButton) {
              lightboxCloseButton.addEventListener('click', closeLightbox);
         } else {
             console.warn("Lightbox close button not found, click listener not added.");
         }
         lightboxElement.addEventListener('click', (e) => {
              if (e.target === lightboxElement) closeLightbox(); // Close on background click
         });
         window.addEventListener('keydown', (e) => {
              if (e.key === 'Escape' && lightboxElement.style.display === 'flex') closeLightbox(); // Close on Esc
         });
         console.log("Listeners bound: Lightbox close mechanisms.");
    } else {
         if(!lightboxElement) console.warn("Lightbox element not found.");
         if(typeof closeLightbox !== 'function') console.warn("closeLightbox function (gallery.js) not found.");
    }

    // Modal Image Click for Lightbox Listener
    if (modalElement && typeof openLightbox === 'function') {
        // Use event delegation on the modal content
        modalElement.addEventListener('click', (event) => {
            const img = event.target.closest('img.modal-image--clickable'); // Find nearest clickable image parent
            if (img?.dataset?.originalSrc) { // Ensure image and data attribute exist
                openLightbox(img.dataset.originalSrc, img.alt); // Open lightbox
            }
        });
        console.log("Listener bound: Modal image click for lightbox (delegated).");
    } else {
         if(!modalElement) console.warn("Modal element not found for lightbox delegation.");
         if(typeof openLightbox !== 'function') console.warn("openLightbox function (gallery.js) not found.");
    }

    console.log("main.js: All essential event listeners bound.");

}); // End of DOMContentLoaded listener