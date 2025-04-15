// static/js/gallery.js

// --- Constants ---
const MAX_DESC_LENGTH_HABITS = 500;
const MAX_DESC_LENGTH_REFLECTION = 1000;
const MAX_AUTHOR_LENGTH = 50;

// --- DOM Element References ---
// Assumed assigned globally by main.js

// --- State ---
var currentWorksData = [];
var currentWorkIdInModal = null;
var currentAudioUrl = null;

// --- Modal Functions ---
function openWorkModal(workId) {
    const workData = currentWorksData.find(w => w?.id === workId);
    if (!workData || !modalElement) { console.error("Modal open failed:", workId); alert("無法顯示。"); return; }
    console.log("Opening modal for work:", workData.id);
    currentWorkIdInModal = workId; currentAudioUrl = null;

    if (modalAuthor) modalAuthor.textContent = escapeHTML(workData.author || '匿名');
    if (modalCurrentHabits) modalCurrentHabits.textContent = escapeHTML(workData.currentHabits || '(未提供)');
    if (modalReflection) modalReflection.textContent = escapeHTML(workData.reflection || '(未提供)');
    const setImage = (el, url, alt) => { if(el){ el.src=escapeHTML(url||''); el.alt=escapeHTML(alt||''); el.dataset.originalSrc=escapeHTML(url||''); if(typeof handleImageError==='function'){el.onerror=function(){handleImageError(this,alt+'載入失敗');}} el.classList.add('modal-image--clickable'); } };
    setImage(modalScorecardImage, workData.scorecardImageUrl, '習慣計分卡');
    setImage(modalComicImage, workData.comicImageUrl, '六格漫畫');

    if (analysisLoading) analysisLoading.classList.add('hidden');
    if (analysisError) analysisError.classList.add('hidden');
    if (analysisResultContainer) analysisResultContainer.classList.add('hidden');
    if (analysisResultElement) analysisResultElement.innerHTML = '';
    if (analyzeButton) { analyzeButton.disabled = false; analyzeButton.textContent = '點擊分析'; }
    if (readAloudButton) readAloudButton.disabled = true;
    if (stopReadingButton) stopReadingButton.classList.add('hidden');
    if (analysisAudioPlayer) { analysisAudioPlayer.pause(); analysisAudioPlayer.removeAttribute('src'); analysisAudioPlayer.load(); }

    modalElement.style.display = "block"; document.body.style.overflow = 'hidden';
}

function closeWorkModal() {
     if (modalElement) { modalElement.style.display = "none"; document.body.style.overflow = ''; currentWorkIdInModal = null; currentAudioUrl = null; if (analysisAudioPlayer && !analysisAudioPlayer.paused) stopAnalysisAudio(); }
}

// --- Lightbox Functions ---
function openLightbox(imageUrl, caption = '放大圖片') {
    if (!lightboxElement || !lightboxImg || !lightboxCaption) return;
    if (!imageUrl || typeof imageUrl !== 'string') { console.warn("Invalid URL for lightbox:", imageUrl); lightboxImg.src=''; lightboxCaption.textContent='圖片無法顯示'; lightboxElement.style.display="flex"; return; }
    lightboxImg.src = escapeHTML(imageUrl); lightboxCaption.textContent = escapeHTML(caption);
    lightboxElement.style.display = "flex";
}

function closeLightbox() {
    if (lightboxElement) { lightboxElement.style.display = "none"; lightboxImg.src = ""; lightboxCaption.textContent = ""; }
}

// --- Gallery Loading ---
async function loadAndRenderWorks() {
    if (!workGalleryElement) { console.error("Gallery element missing."); return; }
    console.log("Fetching works...");
    workGalleryElement.innerHTML = `<p id="gallery-placeholder" class="tc t-g-500 csp p-6">載入中...</p>`;
    try {
        const r = await fetch('/works'); if (!r.ok) throw new Error(`Server error (${r.status})`);
        const w = await r.json(); currentWorksData = w; workGalleryElement.innerHTML = '';
        if (!Array.isArray(w)) throw new Error("Invalid format"); if (w.length===0) { workGalleryElement.innerHTML = `<p id="gallery-placeholder" class="tc t-g-500 csp p-6">尚無分享!</p>`; return; }
        w.forEach(wk => {
             if (!wk?.id || !wk?.scorecardImageUrl || !wk?.author) { console.warn("Skipping invalid work data:", wk); return; }
             const card = document.createElement('div'); card.className = 'work-card fade-in'; card.setAttribute('role', 'button'); card.tabIndex=0; card.dataset.workId=wk.id;
             const a=escapeHTML(wk.author || '匿名'); const pRaw = wk.currentHabits || ''; const p=escapeHTML(pRaw.length > 80 ? pRaw.substring(0,80) + '...' : pRaw); const iU=escapeHTML(wk.scorecardImageUrl);
             card.innerHTML = `<img src="${iU}" alt="預覽-${a}" loading="lazy"><h5>${a}</h5><p class="description-preview">${p}</p>`;
             const img=card.querySelector('img'); if (img&&typeof handleImageError==='function') img.onerror=function(){handleImageError(this,`預覽圖載入失敗`);};
             card.addEventListener('click',()=>openWorkModal(wk.id)); card.addEventListener('keydown',(e)=>{if(e.key==='Enter'||e.key===' ') {e.preventDefault(); openWorkModal(wk.id);}});
             workGalleryElement.appendChild(card);
        });
    } catch (e) { console.error("Load works failed:",e); if (workGalleryElement) workGalleryElement.innerHTML=`<p id="gallery-placeholder" class="tc t-r-600 csp p-6">載入錯誤</p>`; slideshowImageUrls=[]; if(typeof initializeSlideshow==='function')initializeSlideshow(); }
}


// --- Form Handling ---
async function handleWorkUpload(event) {
    event.preventDefault(); const els = [authorNameInput, scorecardImageInput, comicImageInput, currentHabitsInput, reflectionInput, uploadForm, uploadStatusElement]; if (els.some(el => !el)) { alert("頁面錯誤"); return false; }
    const author = authorNameInput.value.trim(); const sFile=scorecardImageInput.files?.[0]; const cFile=comicImageInput.files?.[0]; const habits=currentHabitsInput.value.trim(); const reflect=reflectionInput.value.trim(); const btn = uploadForm.querySelector('button[type="submit"]');
    uploadStatusElement.textContent=''; uploadStatusElement.className='mt-4 tc ts min-h-[1.25em]'; let err='';
    if (!author) err='姓名未填'; else if (author.length>MAX_AUTHOR_LENGTH) err='姓名過長'; else if (!sFile) err='未選計分卡'; else if (!cFile) err='未選漫畫'; else if (!habits) err='習慣描述未填'; else if (habits.length>MAX_DESC_LENGTH_HABITS) err='習慣描述過長'; else if (!reflect) err='反思未填'; else if (reflect.length>MAX_DESC_LENGTH_REFLECTION) err='反思過長';
    if (!err) { const aT=['image/png','image/jpeg','image/jpg','image/gif']; const mS=16*1024*1024; if(sFile&&!aT.includes(sFile.type))err='計分卡格式不符';else if(sFile&&sFile.size>mS)err='計分卡過大';else if(cFile&&!aT.includes(cFile.type))err='漫畫格式不符';else if(cFile&&cFile.size>mS)err='漫畫過大'; }
    if (err) { uploadStatusElement.textContent=err+'!'; uploadStatusElement.classList.add('text-red-600'); return false; }
    const fd = new FormData(); fd.append('author-name',author); fd.append('scorecard-image',sFile); fd.append('comic-image',cFile); fd.append('current-habits',habits); fd.append('reflection',reflect);
    if(btn){btn.disabled=true;btn.textContent='分享中...';} uploadStatusElement.textContent='分享中...'; uploadStatusElement.className='mt-4 tc ts min-h-[1.25em] text-blue-600';
    try { const r=await fetch('/upload',{method:'POST',body:fd}); const res=await r.json();
        if (r.ok && res.success) { uploadStatusElement.textContent='成功！'; uploadStatusElement.classList.replace('text-blue-600','text-green-600'); if(uploadForm)uploadForm.reset(); setTimeout(()=>{if(uploadStatusElement?.classList.contains('text-green-600')){uploadStatusElement.textContent='';uploadStatusElement.className='mt-4 tc ts min-h-[1.25em]';}}, 5000); return true; }
        else { const eT=escapeHTML(res.error||'未知錯誤'); uploadStatusElement.textContent=`失敗:${eT}`; uploadStatusElement.classList.replace('text-blue-600','text-red-600'); return false; }
    } catch(e){ uploadStatusElement.textContent='網路錯誤'; uploadStatusElement.className='mt-4 tc ts min-h-[1.25em] text-red-600'; return false; }
    finally { if(btn){btn.disabled=false;btn.textContent='確認分享';} }
}

// --- AI Analysis and Audio Playback Functions ---
async function handleAnalyzeClick() {
    if (!currentWorkIdInModal) { console.error("No work ID selected."); return; }
    const ui = [analyzeButton, analysisLoading, analysisError, analysisResultContainer, analysisResultElement, readAloudButton, stopReadingButton, analysisAudioPlayer];
    if (ui.some(el => !el)) { console.error("AI UI elements missing."); return; }

    analyzeButton.disabled = true; analyzeButton.textContent = '分析中...';
    analysisLoading.classList.remove('hidden'); analysisError.classList.add('hidden');
    analysisResultContainer.classList.add('hidden'); analysisResultElement.innerHTML = '';
    readAloudButton.disabled = true; stopReadingButton.classList.add('hidden');
    currentAudioUrl = null; stopAnalysisAudio();

    try {
        console.log(`[AI] Requesting analysis for work ID: ${currentWorkIdInModal}`);
        const response = await fetch(`/analyze/${currentWorkIdInModal}`, { method: 'POST' });
        const result = await response.json();

        if (response.ok && result.success && result.analysis) {
            // ** Markdown Rendering Debugging & Correction **
            console.log('[AI] Received analysis text:', result.analysis.substring(0, 100) + '...');
            // Check window.marked AND window.marked.parse
            console.log('[Markdown] Checking window.marked:', typeof window.marked);
            console.log('[Markdown] Checking window.marked.parse:', typeof window.marked?.parse); // Use optional chaining for safety

            // ** CORRECTED CHECK **
            if (typeof window.marked?.parse === 'function') { // Check if the 'parse' method exists and is a function
                try {
                    console.log('[Markdown] Attempting marked.parse()...');
                    const htmlOutput = window.marked.parse(result.analysis); // Call the parse method
                    console.log('[Markdown] HTML output (start):', htmlOutput.substring(0, 200) + '...');
                    analysisResultElement.innerHTML = htmlOutput;
                    console.log('[Markdown] Successfully set innerHTML.');
                } catch (parseError) {
                    console.error("[Markdown] Error during marked.parse():", parseError);
                    analysisResultElement.textContent = result.analysis; // Fallback
                    analysisError.textContent = "Markdown 渲染出錯。";
                    analysisError.classList.remove('hidden');
                }
            } else {
                console.error("[Markdown] window.marked.parse function not found! Check marked.js loading in index.html.");
                analysisResultElement.textContent = result.analysis; // Fallback
                analysisError.textContent = "Markdown 渲染功能異常。";
                analysisError.classList.remove('hidden');
            }
            // ************************

            analysisResultContainer.classList.remove('hidden');

            // Handle audio
            if (result.audioUrl && typeof result.audioUrl === 'string') {
                currentAudioUrl = result.audioUrl; readAloudButton.disabled = false; console.log("[AI] Audio URL:", currentAudioUrl);
                if (analysisAudioPlayer.preload !== 'none') analysisAudioPlayer.src = currentAudioUrl;
            } else { console.warn("[AI] No valid audio URL received."); readAloudButton.disabled = true; }

        } else {
            const errorText = escapeHTML(result.error || '分析請求失敗'); analysisError.textContent = `分析錯誤：${errorText}`; analysisError.classList.remove('hidden'); console.error("[AI] Analysis request failed:", result);
        }
    } catch (error) {
        analysisError.textContent = '與 AI 服務連線失敗。'; analysisError.classList.remove('hidden'); console.error("[AI] Fetch error:", error);
    } finally {
        analyzeButton.disabled = false; analyzeButton.textContent = '重新分析'; analysisLoading.classList.add('hidden');
    }
}

function playAnalysisAudio() {
    if (!currentAudioUrl || !analysisAudioPlayer) return;
    console.log("[Audio] Playing:", currentAudioUrl);
    const fullUrl = (currentAudioUrl.startsWith('/')) ? window.location.origin + currentAudioUrl : currentAudioUrl;
    if (analysisAudioPlayer.src !== fullUrl) { analysisAudioPlayer.src = currentAudioUrl; analysisAudioPlayer.load(); }
    analysisAudioPlayer.play().catch(e => { console.error("Audio play error:", e); alert(`播放錯誤`); if(readAloudButton) readAloudButton.disabled=true; if(stopReadingButton) stopReadingButton.classList.add('hidden'); currentAudioUrl=null; });
}

function stopAnalysisAudio() {
    if (analysisAudioPlayer && !analysisAudioPlayer.paused) { analysisAudioPlayer.pause(); analysisAudioPlayer.currentTime = 0; }
    if (readAloudButton) readAloudButton.disabled = !currentAudioUrl;
    if (stopReadingButton) stopReadingButton.classList.add('hidden');
}

function setupAudioPlayerListeners() {
    if (!analysisAudioPlayer || !readAloudButton || !stopReadingButton) return;
    console.log("Setting up audio listeners...");
    analysisAudioPlayer.addEventListener('play', () => { console.log("[Audio] Event: play"); if(readAloudButton) readAloudButton.disabled = true; if(stopReadingButton) stopReadingButton.classList.remove('hidden'); });
    analysisAudioPlayer.addEventListener('pause', () => { console.log("[Audio] Event: pause/ended"); if(readAloudButton) readAloudButton.disabled = !currentAudioUrl; if(stopReadingButton) stopReadingButton.classList.add('hidden'); });
    analysisAudioPlayer.addEventListener('ended', () => { console.log("[Audio] Event: ended"); analysisAudioPlayer.currentTime = 0; });
    analysisAudioPlayer.addEventListener('error', (e) => { console.error("[Audio] Event: error", e); alert("播放錯誤"); if(readAloudButton) readAloudButton.disabled = true; if(stopReadingButton) stopReadingButton.classList.add('hidden'); currentAudioUrl = null; });
}