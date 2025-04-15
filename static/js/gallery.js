// static/js/gallery.js

// --- Constants ---
const MAX_DESC_LENGTH_HABITS = 500;
const MAX_DESC_LENGTH_REFLECTION = 1000;
const MAX_AUTHOR_LENGTH = 50;

// --- DOM Element References (Assigned in main.js) ---
// Make sure these are assigned correctly in main.js
// let workGalleryElement, uploadForm, modalElement, lightboxElement;
// let authorNameInput, scorecardImageInput, comicImageInput, currentHabitsInput, reflectionInput, uploadStatusElement;
// let modalCloseButton, modalAuthor, modalCurrentHabits, modalReflection, modalScorecardImage, modalComicImage;
// let lightboxImg, lightboxCaption, lightboxCloseButton;

// --- State ---
var currentWorksData = []; // Holds the master list of work data from server
var currentWorkIdInModal = null;

// --- Modal Functions ---
async function openWorkModal(workId) {
    const workData = currentWorksData.find(w => w?.id === workId);
    if (!workData || !modalElement) {
        console.error("Modal open failed: Work data or modal element not found for ID", workId);
        alert("無法顯示作品詳細資訊。");
        return;
    }

    console.log("Opening modal for work:", workData.id);
    currentWorkIdInModal = workId; // Track which work is open

    // Populate modal text content using helper for safety
    const setText = (el, text, fallback = '(未提供)') => {
        if (el) {
            el.textContent = escapeHTML(text || fallback);
        } else {
            console.warn(`Modal text element not found for setting: ${text}`);
        }
    };
    setText(modalAuthor, workData.author, '匿名');
    setText(modalCurrentHabits, workData.currentHabits);
    setText(modalReflection, workData.reflection);


    // Set images and handle potential errors
    const setImage = (el, url, alt) => {
        if(el){
            const safeUrl = escapeHTML(url || ''); // Sanitize URL just in case
            const safeAlt = escapeHTML(alt || '圖片');
            el.src = safeUrl; // Set source
            el.alt = safeAlt;
            el.dataset.originalSrc = safeUrl; // Store clean URL for lightbox
            el.classList.remove('modal-image--clickable'); // Assume not clickable until loaded

            // Error handling for image loading
            el.onerror = function() {
                console.error(`Failed to load modal image: ${el.src}`);
                el.alt = `${safeAlt} 載入失敗`;
                 // Use utility if available globally
                 if(typeof handleImageError === 'function') {
                     handleImageError(el, `${safeAlt} 載入失敗`); // Use placeholder from utils.js
                 } else {
                     // Simple visual fallback if utils.js isn't loaded/working
                     el.style.border = '2px dashed red';
                     el.style.minHeight = '50px'; // Give it some size
                 }
            };
            // Success handling
            el.onload = function() {
                 el.onerror = null; // Remove error handler once loaded
                 el.style.border = ''; // Remove error style if applied
                 el.classList.add('modal-image--clickable'); // Make clickable on success
            };
        } else {
             console.warn(`Modal image element not found for "${alt}".`);
        }
    };
    setImage(modalScorecardImage, workData.scorecardImageUrl, '習慣計分卡');
    setImage(modalComicImage, workData.comicImageUrl, '六格漫畫');

    // --- PRE-FETCH/ENCODE IMAGES for Chat Widget ---
    // Only attempt if the URLs seem valid
    if (workData.scorecardImageUrl && workData.comicImageUrl) {
        try {
            // Fetch only if Base64 data isn't already attached (e.g., from previous opening)
            if (!workData.scorecardBase64 || !workData.comicBase64) {
                console.log("Pre-fetching/encoding images for chat widget...");
                // Use utility function (ensure it's defined below or globally)
                const [scBase64, cmBase64] = await Promise.all([
                    fetchImageAsBase64(workData.scorecardImageUrl),
                    fetchImageAsBase64(workData.comicImageUrl)
                ]);
                // Store ONLY if fetch/encode succeeded
                if (scBase64) workData.scorecardBase64 = scBase64;
                if (cmBase64) workData.comicBase64 = cmBase64;

                if (!scBase64 || !cmBase64) {
                    console.warn("Failed to pre-fetch/encode one or both images for chat. Analysis might fail.");
                } else {
                    console.log("Images pre-fetched and encoded successfully.");
                }
            } else {
                console.log("Using previously fetched Base64 image data for chat.");
            }
        } catch(e) {
            console.error("Error during image pre-fetching/encoding for chat:", e);
            // Ensure potentially partial data is cleared
            delete workData.scorecardBase64;
            delete workData.comicBase64;
        }
    } else {
        console.warn("Missing image URLs in workData, cannot pre-fetch for chat.", workData);
    }
    // --- End Pre-fetch ---

    // --- Inform the Chat Widget ---
    if (typeof window.setWorkDataForChat === 'function') {
        // Pass the potentially updated workData (with base64)
        window.setWorkDataForChat(workData);
    } else {
        console.warn("setWorkDataForChat function (from chatWidget.js) not found.");
    }
    // --- End Inform ---

    // Display the modal and prevent background scroll
    if (modalElement) {
         modalElement.style.display = "block";
         document.body.style.overflow = 'hidden';
    }
}


function closeWorkModal() {
     if (modalElement && modalElement.style.display !== 'none') {
          modalElement.style.display = "none"; // Hide modal
          document.body.style.overflow = ''; // Restore background scrolling
          currentWorkIdInModal = null; // Clear tracked ID

          // --- Inform the Chat Widget to clear its state ---
          if (typeof window.clearWorkDataForChat === 'function') {
               window.clearWorkDataForChat();
          } else {
               console.warn("clearWorkDataForChat function (from chatWidget.js) not found.");
          }
          console.log("Modal closed.");
     }
}

// --- Lightbox Functions ---
function openLightbox(imageUrl, caption = '放大圖片') {
    // Ensure elements are present
    if (!lightboxElement || !lightboxImg || !lightboxCaption) {
        console.warn("Lightbox elements missing, cannot open lightbox.");
        return;
    }
    // Validate URL
    if (!imageUrl || typeof imageUrl !== 'string') {
        console.warn("Invalid or missing URL for lightbox:", imageUrl);
        lightboxImg.src = ''; // Clear previous image
        lightboxCaption.textContent = '圖片無法載入'; // Show error in caption
        lightboxElement.style.display = "flex"; // Show lightbox with error message
        return;
    }
    // Set content and display
    lightboxImg.src = escapeHTML(imageUrl); // Use sanitized URL
    lightboxCaption.textContent = escapeHTML(caption);
    lightboxElement.style.display = "flex";
    console.log("Lightbox opened for:", imageUrl);
}

function closeLightbox() {
    if (lightboxElement && lightboxElement.style.display !== 'none') {
        lightboxElement.style.display = "none"; // Hide lightbox
        // Clear content to prevent flash of old image on next open
        if (lightboxImg) lightboxImg.src = "";
        if (lightboxCaption) lightboxCaption.textContent = "";
        console.log("Lightbox closed.");
    }
}

// --- Gallery Loading ---
async function loadAndRenderWorks() {
    if (!workGalleryElement) {
        console.error("Gallery element (#work-gallery) missing. Cannot render works.");
        return;
    }
    console.log("Fetching works...");
    workGalleryElement.innerHTML = `<p id="gallery-placeholder" class="tc t-g-500 csp p-6 col-span-full">正在載入作品...</p>`; // Use col-span-full for grid layout

    try {
        const response = await fetch('/works');
        if (!response.ok) {
            throw new Error(`伺服器錯誤 (${response.status}): ${response.statusText}`);
        }
        const works = await response.json();

        if (!Array.isArray(works)) {
            throw new Error("從伺服器收到的資料格式不正確 (非陣列)。");
        }

        currentWorksData = works; // Store fetched data
        workGalleryElement.innerHTML = ''; // Clear loading message

        if (works.length === 0) {
            workGalleryElement.innerHTML = `<p id="gallery-placeholder" class="tc t-g-500 csp p-6 col-span-full">目前尚無分享，快來分享你的成果吧！</p>`;
            console.log("No works found to display.");
            // Ensure slideshow is also updated if it depends on this data
            if (typeof initializeSlideshow === 'function') initializeSlideshow();
            return;
        }

        console.log(`Rendering ${works.length} works...`);
        let renderedCount = 0;
        works.forEach(work => {
             // Validate individual work object more thoroughly
             if (!work || typeof work !== 'object' || !work.id || !work.scorecardImageUrl || !work.author || !work.currentHabits || !work.reflection || !work.comicImageUrl) {
                 console.warn("Skipping work with invalid or incomplete data:", work);
                 return; // Skip this work
             }

             const card = document.createElement('div');
             card.className = 'work-card fade-in';
             card.setAttribute('role', 'button');
             card.tabIndex = 0;
             card.dataset.workId = work.id;

             // Sanitize content before displaying
             const author = escapeHTML(work.author);
             const habitsRaw = work.currentHabits;
             const habitsPreview = escapeHTML(habitsRaw.length > 80 ? habitsRaw.substring(0, 80) + '...' : habitsRaw);
             const imageUrl = escapeHTML(work.scorecardImageUrl); // Preview image URL

             // Use template literals for cleaner HTML structure
             // Added padding within the card content area
             card.innerHTML = `
                 <img src="${imageUrl}" alt="預覽 - ${author}" loading="lazy" style="background-color: #eee;" onerror="this.onerror=null; this.src='/static/placeholder.png'; this.alt='預覽圖載入失敗'; console.warn('Failed to load preview: ${imageUrl}')">
                 <div class="p-4 flex-grow flex flex-col">
                      <h5 class="text-base font-semibold text-gray-800 mb-1 truncate" title="${author}">${author}</h5>
                      <p class="description-preview text-sm text-gray-600" title="${escapeHTML(habitsRaw)}">${habitsPreview || '(無習慣描述)'}</p>
                 </div>
             `;
             // Add error handling directly to img tag for simplicity here

             // Add event listeners
             card.addEventListener('click', () => openWorkModal(work.id));
             card.addEventListener('keydown', (event) => {
                 if (event.key === 'Enter' || event.key === ' ') {
                     event.preventDefault();
                     openWorkModal(work.id);
                 }
             });

             workGalleryElement.appendChild(card);
             renderedCount++;
        });
        console.log(`Successfully rendered ${renderedCount} out of ${works.length} works.`);

        // Update slideshow after rendering gallery
        if (typeof initializeSlideshow === 'function') initializeSlideshow();

    } catch (error) {
        console.error("載入或渲染作品時發生錯誤:", error);
        if (workGalleryElement) {
            workGalleryElement.innerHTML = `<p id="gallery-placeholder" class="tc t-r-600 csp p-6 col-span-full">載入作品時遇到問題，請稍後再試。 (${escapeHTML(error.message)})</p>`;
        }
        currentWorksData = []; // Clear data on error
        if (typeof initializeSlideshow === 'function') initializeSlideshow(); // Update slideshow with empty data
    }
}


// --- Form Handling ---
async function handleWorkUpload(event) {
    event.preventDefault();

    const requiredElements = [authorNameInput, scorecardImageInput, comicImageInput, currentHabitsInput, reflectionInput, uploadForm, uploadStatusElement];
    if (requiredElements.some(el => !el)) {
        console.error("Upload form elements missing!");
        alert("頁面載入錯誤，無法處理上傳。請重新整理頁面。");
        return false;
    }

    const author = authorNameInput.value.trim();
    const scorecardFile = scorecardImageInput.files?.[0];
    const comicFile = comicImageInput.files?.[0];
    const habits = currentHabitsInput.value.trim();
    const reflection = reflectionInput.value.trim();
    const submitButton = uploadForm.querySelector('button[type="submit"]');

    // --- Input Validation ---
    let errors = [];
    // Field presence and length checks
    if (!author) errors.push('姓名/暱稱未填寫');
    else if (author.length > MAX_AUTHOR_LENGTH) errors.push(`姓名/暱稱過長 (最多 ${MAX_AUTHOR_LENGTH} 字)`);
    if (!habits) errors.push('目前習慣描述未填寫');
    else if (habits.length > MAX_DESC_LENGTH_HABITS) errors.push(`習慣描述過長 (最多 ${MAX_DESC_LENGTH_HABITS} 字)`);
    if (!reflection) errors.push('反思與展望未填寫');
    else if (reflection.length > MAX_DESC_LENGTH_REFLECTION) errors.push(`反思過長 (最多 ${MAX_DESC_LENGTH_REFLECTION} 字)`);

    // File presence checks
    if (!scorecardFile) errors.push('未選擇習慣計分卡圖片');
    if (!comicFile) errors.push('未選擇六格漫畫圖片');

    // File type and size validation (only if file exists)
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    const maxSize = 16 * 1024 * 1024; // 16MB (match backend)
    if (scorecardFile) {
        if (!allowedTypes.includes(scorecardFile.type)) errors.push('計分卡圖片格式不符 (僅限 JPG, PNG, GIF)');
        if (scorecardFile.size > maxSize) errors.push(`計分卡圖片過大 (上限 ${maxSize / 1024 / 1024}MB)`);
    }
    if (comicFile) {
        if (!allowedTypes.includes(comicFile.type)) errors.push('漫畫圖片格式不符 (僅限 JPG, PNG, GIF)');
        if (comicFile.size > maxSize) errors.push(`漫畫圖片過大 (上限 ${maxSize / 1024 / 1024}MB)`);
    }

    // Display validation errors
    uploadStatusElement.textContent = '';
    uploadStatusElement.className = 'mt-4 text-center text-sm min-h-[1.25em]'; // Reset classes
    if (errors.length > 0) {
        // Display errors clearly
        uploadStatusElement.innerHTML = errors.map(e => `<div class="mb-1">${escapeHTML(e)}!</div>`).join('');
        uploadStatusElement.classList.add('text-red-600');
        if(submitButton) submitButton.disabled = false; // Re-enable button
        return false; // Stop form submission
    }

    // --- Prepare FormData ---
    const formData = new FormData();
    formData.append('author-name', author);
    formData.append('scorecard-image', scorecardFile);
    formData.append('comic-image', comicFile);
    formData.append('current-habits', habits);
    formData.append('reflection', reflection);

    // --- Submit ---
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = '分享中...'; // Provide feedback
    }
    uploadStatusElement.textContent = '正在分享您的作品...';
    uploadStatusElement.classList.add('text-blue-600');

    try {
        const response = await fetch('/upload', { method: 'POST', body: formData });
        // Check for non-JSON responses (e.g., server errors returning HTML)
        if (!response.headers.get('content-type')?.includes('application/json')) {
             throw new Error(`伺服器未回傳有效的 JSON 資料 (狀態: ${response.status})`);
        }
        const result = await response.json();

        if (response.ok && result.success) {
            uploadStatusElement.textContent = '分享成功！';
            uploadStatusElement.classList.replace('text-blue-600', 'text-green-600');
            if (uploadForm) uploadForm.reset(); // Clear form on success
            setTimeout(() => {
                if (uploadStatusElement?.classList.contains('text-green-600')) {
                     uploadStatusElement.textContent = ''; // Clear success message after delay
                     uploadStatusElement.className = 'mt-4 text-center text-sm min-h-[1.25em]';
                }
            }, 5000);
            return true; // Indicate success for main.js

        } else {
            // Handle server-side errors reported in JSON
            const errorText = escapeHTML(result.error || '發生未知錯誤');
            uploadStatusElement.textContent = `分享失敗: ${errorText}`;
            uploadStatusElement.classList.replace('text-blue-600', 'text-red-600');
            return false;
        }
    } catch (error) {
        console.error("Upload fetch error:", error);
        uploadStatusElement.textContent = `上傳失敗：${error.message || '無法連接伺服器'}`;
        uploadStatusElement.className = 'mt-4 text-center text-sm min-h-[1.25em] text-red-600';
        return false;
    } finally {
        // Always re-enable the submit button
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = '確認分享';
        }
    }
}

// --- Utility: Fetch Image and Convert to Base64 ---
// Essential for pre-fetching in openWorkModal for the chat widget
async function fetchImageAsBase64(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') {
        console.warn("fetchImageAsBase64: Invalid imageUrl provided:", imageUrl);
        return null;
    }
    console.log(`Workspaceing image as Base64: ${imageUrl}`); // Log which image is being fetched
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status} fetching image: ${response.url}`);
        }
        const blob = await response.blob();
        // Optional: Check blob type more strictly if needed
        if (!blob.type.startsWith('image/')) {
             console.warn(`Workspaceed resource is not an image type: ${blob.type} for URL: ${imageUrl}`);
             // Decide whether to proceed or return null
             // return null; // Stricter approach
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                // result contains the Data URL (e.g., data:image/png;base64,...)
                // Basic check if result looks like a data URL
                if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
                     resolve(reader.result);
                } else {
                     console.error("FileReader did not return a valid Data URL:", reader.result);
                     reject(new Error("Failed to read blob as valid Data URL."));
                }
            };
            reader.onerror = (error) => {
                 console.error("FileReader error:", error);
                 reject(new Error("Error reading fetched image blob."));
            };
            reader.readAsDataURL(blob); // Start reading the blob
        });
    } catch (error) {
        console.error(`Error fetching or converting image ${imageUrl} to Base64:`, error);
        return null; // Indicate failure
    }
}

// --- Utility: Escape HTML ---
// Ensure this utility is available
function escapeHTML(str) {
    if (str === null || typeof str === 'undefined') return '';
    if (typeof str !== 'string') str = String(str);
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return str.replace(/[&<>"']/g, (m) => map[m]);
}