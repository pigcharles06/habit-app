// static/js/ui.js

// --- Constants ---
const catImageUrls = [ '/static/Box.png', '/static/Box2.png', '/static/Box3.png' ]; // Ensure paths are correct relative to static root
const catNormalSpeed = 500; // ms
const catFastSpeed = 150;   // ms
const SLIDESHOW_INTERVAL_MS = 5000; // 5 seconds

// --- State Variables ---
let catImageIndex = 0;
let catAnimationIntervalId = null;
let isCatFast = false;
let catFastTimeoutId = null;
let slideshowTimeoutId = null;
let currentSlideIndex = 0;
let slideshowImageUrls = []; // Populated by initializeSlideshow using gallery data

// --- DOM Element References (assigned in main.js) ---
// These are expected to be assigned by main.js after DOMContentLoaded
// Example: mobileMenuElement, mobileMenuButtonElement, interactiveCatContainerElement,
// interactiveCatImgElement, particlesJsElement, heroSlideshowElement

// --- Mobile Menu ---
function toggleMobileMenu() {
    if (!mobileMenuElement || !mobileMenuButtonElement) {
        console.error("Mobile menu elements not found for toggle.");
        return;
    }
    const isHidden = mobileMenuElement.classList.toggle('hidden');
    // Update ARIA attributes and button icon
    mobileMenuButtonElement.setAttribute('aria-expanded', String(!isHidden));
    mobileMenuButtonElement.textContent = isHidden ? '\ue9af' : '\uea13'; // Lucide Menu / X icon
    mobileMenuButtonElement.setAttribute('aria-label', isHidden ? '開啟選單' : '關閉選單');
}

// --- Interactive Cat ---
function stopCatAnimation() {
    if (catAnimationIntervalId) clearInterval(catAnimationIntervalId);
    if (catFastTimeoutId) clearTimeout(catFastTimeoutId);
    catAnimationIntervalId = null;
    catFastTimeoutId = null;
    isCatFast = false;
    // console.log("Cat animation stopped.");
}

function startCatAnimation(speed) {
    stopCatAnimation(); // Ensure no previous animation is running
    if (!interactiveCatImgElement || catImageUrls.length === 0) {
        console.warn("Cannot start cat animation: Image element or URLs missing.");
        return;
    }
    // console.log(`Starting cat animation with speed ${speed}ms`);
    catAnimationIntervalId = setInterval(() => {
        if (!document.body.contains(interactiveCatImgElement)) { // Check if element is still in DOM
            stopCatAnimation();
            return;
        }
        catImageIndex = (catImageIndex + 1) % catImageUrls.length;
        interactiveCatImgElement.src = catImageUrls[catImageIndex];
    }, speed);
}

function handleCatClick() {
    if (!interactiveCatContainerElement || !interactiveCatImgElement) {
         console.warn("Cannot handle cat click: Elements missing.");
        return;
    }
    if (isCatFast) return; // Prevent multiple fast animations overlapping

    isCatFast = true;
    startCatAnimation(catFastSpeed); // Speed up

    // Set timeout to return to normal speed
    catFastTimeoutId = setTimeout(() => {
        isCatFast = false;
        // Check if element still exists before reverting speed
        if (document.body.contains(interactiveCatImgElement)) {
            startCatAnimation(catNormalSpeed);
        } else {
            stopCatAnimation(); // Stop if element was removed
        }
    }, 2000); // Duration of fast animation
}

// --- Particles.js ---
function initParticles() {
    if (typeof particlesJS === 'undefined') {
        console.error('particles.js library not loaded.');
        if (particlesJsElement) particlesJsElement.style.backgroundColor = '#eee'; // Simple fallback bg
        return;
    }
    if (!particlesJsElement) {
         console.error("Particles.js container element (#particles-js) missing.");
         return;
    }
     console.log("Initializing Particles.js...");
     try {
         particlesJS("particles-js", { /* Your Particles.js config object here */
           "particles": { "number": { "value": 60, "density": { "enable": true, "value_area": 800 } }, "color": { "value": "#aaa" }, "shape": { "type": "circle" }, "opacity": { "value": 0.4, "random": true }, "size": { "value": 2, "random": true }, "line_linked": { "enable": true, "distance": 150, "color": "#bbb", "opacity": 0.3, "width": 1 }, "move": { "enable": true, "speed": 2, "direction": "none", "random": false, "straight": false, "out_mode": "out", "bounce": false } }, "interactivity": { "detect_on": "canvas", "events": { "onhover": { "enable": true, "mode": "repulse" }, "onclick": { "enable": false, "mode": "push" }, "resize": true }, "modes": { "repulse": { "distance": 100, "duration": 0.4 } } }, "retina_detect": true
         });
     } catch (e) {
         console.error("Error initializing particles.js:", e);
     }
}

// --- Hero Slideshow ---
function clearSlideshow() {
    if (slideshowTimeoutId) clearTimeout(slideshowTimeoutId);
    slideshowTimeoutId = null;
    if (heroSlideshowElement) heroSlideshowElement.innerHTML = ''; // Clear slides
    currentSlideIndex = 0;
    // console.log("Slideshow cleared.");
}

function populateSlideshow() {
    clearSlideshow(); // Start fresh

    if (!heroSlideshowElement) {
        console.error("Cannot populate slideshow: #hero-slideshow missing.");
        return;
    }
    const placeholder = document.getElementById('slideshow-placeholder');

    if (!slideshowImageUrls || slideshowImageUrls.length === 0) {
        console.warn("No images for slideshow.");
        if (placeholder) { // Show placeholder if no images
            if (!heroSlideshowElement.contains(placeholder)) heroSlideshowElement.appendChild(placeholder);
            placeholder.textContent = "暫無分享圖片";
            placeholder.style.display = 'flex';
        } else { // Fallback if placeholder also missing
             heroSlideshowElement.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:grey;">暫無分享圖片</div>';
        }
        return;
    }

    // Hide placeholder if we have images
    if (placeholder) placeholder.style.display = 'none';

    console.log(`Populating slideshow with ${slideshowImageUrls.length} images.`);
    slideshowImageUrls.forEach((imageUrl, index) => {
        if (!imageUrl || typeof imageUrl !== 'string') return; // Skip invalid entries

        const slideDiv = document.createElement('div');
        slideDiv.className = 'slide';
        if (index === 0) slideDiv.classList.add('active'); // First slide is active

        const img = document.createElement('img');
        const safeImageUrl = typeof escapeHTML === 'function' ? escapeHTML(imageUrl) : imageUrl; // Use util if available
        img.src = safeImageUrl;
        img.alt = `習慣養成分享 ${index + 1}`;
        img.loading = (index === 0) ? 'eager' : 'lazy'; // Load first image immediately
        // Use util error handler if available
        img.onerror = function() { if(typeof handleImageError === 'function') handleImageError(this, '輪播圖片載入失敗'); };

        slideDiv.appendChild(img);
        heroSlideshowElement.appendChild(slideDiv);
    });

    // Start timer only if more than one slide was added
    const actualSlides = heroSlideshowElement.querySelectorAll('.slide').length;
    if (actualSlides > 1) {
        startSlideshowTimer();
    }
}

function startSlideshowTimer() {
     if (slideshowTimeoutId) clearTimeout(slideshowTimeoutId);
     // Double-check if needed
     const slides = heroSlideshowElement ? heroSlideshowElement.querySelectorAll('.slide') : [];
     if (!slides || slides.length <= 1) {
         // console.log("Slideshow timer not started (<=1 slide).");
         return;
     }
     slideshowTimeoutId = setTimeout(nextSlide, SLIDESHOW_INTERVAL_MS);
     // console.log(`Slideshow timer started (${SLIDESHOW_INTERVAL_MS}ms).`);
}

function nextSlide() {
    if (!heroSlideshowElement) { stopSlideshow(); return; } // Stop if element gone
    const slides = heroSlideshowElement.querySelectorAll('.slide');
    if (slides.length <= 1) { stopSlideshow(); return; } // Stop if not enough slides

    // Validate index before use
    if (currentSlideIndex < 0 || currentSlideIndex >= slides.length) currentSlideIndex = 0;

    slides[currentSlideIndex].classList.remove('active'); // Hide current
    currentSlideIndex = (currentSlideIndex + 1) % slides.length; // Move to next
    slides[currentSlideIndex].classList.add('active'); // Show next

    startSlideshowTimer(); // Restart timer
}

function stopSlideshow() { // Helper to clear timer
    if (slideshowTimeoutId) clearTimeout(slideshowTimeoutId);
    slideshowTimeoutId = null;
    console.log("Slideshow timer stopped.");
}


function initializeSlideshow() {
    // This function now primarily relies on `currentWorksData` from `gallery.js`
    if (!heroSlideshowElement) {
         console.error("Cannot initialize slideshow: #hero-slideshow missing.");
        return;
    }

    // Check if gallery data is ready (set globally by gallery.js)
    if (typeof currentWorksData === 'undefined' || !Array.isArray(currentWorksData)) {
        console.warn("Slideshow init deferred: gallery data (currentWorksData) not ready.");
        // Retry mechanism (could be improved with promises/events)
        setTimeout(initializeSlideshow, 1000); // Check again in 1 sec
        return;
    }

    console.log("Initializing slideshow using gallery data...");
    try {
        // Get scorecard URLs from the first 5 works, filtering for valid strings
        slideshowImageUrls = currentWorksData
                                .slice(0, 5) // Limit to 5 slides
                                .map(work => work?.scorecardImageUrl) // Safely get URL
                                .filter(url => typeof url === 'string' && url.length > 0); // Ensure it's a non-empty string

        populateSlideshow(); // Build the slides
    } catch (error) {
        console.error("Error during slideshow initialization:", error);
        slideshowImageUrls = []; // Clear on error
        populateSlideshow(); // Show placeholder
    }
}

// --- Smooth Scrolling ---
function handleSmoothScroll(e) {
    // Listener is delegated in main.js, find the actual link clicked
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;

    const targetId = link.getAttribute('href');
    // Validate href is a valid ID selector (e.g., "#section-id")
    if (!targetId || targetId.length < 2 || !targetId.startsWith('#')) {
        console.warn(`Invalid href for smooth scroll: "${targetId}"`);
        return; // Allow default behavior for invalid/external links
    }

    const targetElement = document.querySelector(targetId);
    if (targetElement) {
        e.preventDefault(); // Prevent default jump only if target exists
        targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start' // Align to top
        });
        // If menu is open and link is inside it, close menu
        if (mobileMenuElement && !mobileMenuElement.classList.contains('hidden') && mobileMenuElement.contains(link)) {
            toggleMobileMenu();
        }
    } else {
        console.warn(`Smooth scroll target element not found: ${targetId}`);
        // Allow default jump if target doesn't exist on the page? Or do nothing?
        // Currently does nothing if target not found because preventDefault happened.
        // If you want the jump, move preventDefault inside the if(targetElement) block.
    }
}