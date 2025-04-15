// static/js/chatWidget.js

document.addEventListener('DOMContentLoaded', () => {
    // Ensure the DOM is fully loaded before trying to find elements
    console.log("ChatWidget.js: DOM fully loaded.");

    // --- DOM Elements ---
    const chatWidget = document.getElementById('ai-chat-widget');
    const chatHeader = document.getElementById('chat-widget-header');
    const chatContent = document.getElementById('chat-widget-content');
    const chatToggleBtn = document.getElementById('chat-widget-toggle');
    const chatAnalyzeBtn = document.getElementById('analyze-button-chat');
    const chatLoading = document.getElementById('analysis-loading-chat');
    const chatError = document.getElementById('analysis-error-chat');
    const chatResultContainer = document.getElementById('analysis-result-container-chat');
    const chatResultEl = document.getElementById('analysis-result-chat');
    const chatInfoText = document.getElementById('chat-info-text');
    const chatReadAloudBtn = document.getElementById('read-aloud-button-chat');
    const chatStopReadingBtn = document.getElementById('stop-reading-button-chat');
    const chatAudioPlayer = document.getElementById('analysis-audio-player-chat');
    const chatAutoplayCheckbox = document.getElementById('autoplay-audio-checkbox');

    // --- State ---
    let isChatMinimized = false;
    let currentWorkDataForChat = null; // Holds data of the work currently shown in modal
    let currentAudioBlobUrl = null;
    let isAnalyzing = false; // Prevent multiple simultaneous requests

    // --- Initialization ---
    function initializeChatWidget() {
        console.log("Initializing Chat Widget...");

        // Basic check if essential elements exist
        const essentialElements = [chatWidget, chatHeader, chatAnalyzeBtn, chatAudioPlayer, chatAutoplayCheckbox, chatInfoText, chatLoading, chatError, chatResultContainer, chatResultEl, chatReadAloudBtn, chatStopReadingBtn];
        if (essentialElements.some(el => !el)) {
            console.error("Chat Widget essential elements not found! Aborting initialization.");
            if(chatWidget) chatWidget.style.display = 'none'; // Hide if broken
            return;
        }

        // Add Event Listeners
        chatHeader.addEventListener('click', toggleChatWidgetMinimize);
        chatAnalyzeBtn.addEventListener('click', handleChatAnalyzeClick);
        chatReadAloudBtn.addEventListener('click', playChatAnalysisAudio);
        chatStopReadingBtn.addEventListener('click', stopChatAnalysisAudio);

        // Audio player listeners (crucial for button state management)
        setupChatAudioPlayerListeners();

        // Initially disable analyze button and clear state
        chatAnalyzeBtn.disabled = true;
        resetChatAnalysisState(false); // Reset UI without showing loading

        // Make the widget visible if it wasn't hidden via CSS initially
        // If you added a .hidden class in HTML, remove it here:
        chatWidget.classList.remove('hidden');
        console.log("Chat Widget Initialized and Visible.");
    }

    // --- Chat Widget Visibility Toggle ---
    function toggleChatWidgetMinimize() {
        if (!chatWidget || !chatToggleBtn) return;
        isChatMinimized = !isChatMinimized;
        chatWidget.classList.toggle('minimized', isChatMinimized); // Add/remove 'minimized' class
        // Update toggle button icon (Lucide Icons: Chevrons Up/Down)
        const iconSpan = chatToggleBtn.querySelector('.lucide');
        if (iconSpan) {
            iconSpan.innerHTML = isChatMinimized ? '&#xea7a;' : '&#xea76;'; // Toggle icon based on state
        }
        chatToggleBtn.setAttribute('aria-label', isChatMinimized ? '展開聊天室' : '最小化聊天室');
        console.log(`Chat widget ${isChatMinimized ? 'minimized' : 'expanded'}.`);
    }

    // --- Storing/Clearing Current Work Data (Called Globally) ---
    window.setWorkDataForChat = (workData) => {
        console.log("ChatWidget: Setting work data for ID:", workData?.id);
        currentWorkDataForChat = workData; // Store the work data object
        if (chatAnalyzeBtn) {
            // Enable button only if data is present AND not currently analyzing
            chatAnalyzeBtn.disabled = !workData || isAnalyzing;
        }
        if (chatInfoText) {
             // Update info text and ensure no error styling
             chatInfoText.textContent = workData
                 ? `分析 "${escapeHTML(workData.author)}" 的作品`
                 : '請先點開一個學生的作品，然後點擊下方按鈕進行分析。';
             chatInfoText.classList.remove('text-red-600');
        }
         // Reset previous analysis state when a new work is selected
         resetChatAnalysisState();
         // Optional: Ensure widget is expanded when new data is set
         if(isChatMinimized) toggleChatWidgetMinimize();
         // Optional: Scroll chat content to top to see info text/button
         if(chatContent) chatContent.scrollTop = 0;
    };

    window.clearWorkDataForChat = () => {
         console.log("ChatWidget: Clearing work data");
         currentWorkDataForChat = null; // Clear stored data
         if (chatAnalyzeBtn) {
             chatAnalyzeBtn.disabled = true; // Disable analyze button
         }
         if (chatInfoText) {
              // Reset info text
              chatInfoText.textContent = '請先點開一個學生的作品，然後點擊下方按鈕進行分析。';
         }
          resetChatAnalysisState(); // Clear analysis results/audio
         // Optional: Minimize or hide widget when modal closes
         // if(!isChatMinimized) toggleChatWidgetMinimize();
     };


    // --- Analysis Logic ---
    async function handleChatAnalyzeClick() {
        // Prevent concurrent analysis requests
        if (isAnalyzing) {
            console.warn("Analysis already in progress. Please wait.");
            return;
        }
        // Ensure work data is available
        if (!currentWorkDataForChat || !chatAnalyzeBtn) {
            console.error("No work data selected for analysis.");
            displayError("錯誤: 請先在主畫面點開一個作品。");
            if (chatInfoText) chatInfoText.classList.add('text-red-600'); // Highlight info text
            return;
        }

        // Ensure Base64 image data is present (expected to be set by gallery.js)
        if (!currentWorkDataForChat.scorecardBase64 || !currentWorkDataForChat.comicBase64) {
             console.error("Base64 image data is missing from currentWorkDataForChat.");
             displayError("錯誤: 缺少圖片資料，無法分析。請嘗試重新點開作品。");
             return; // Cannot proceed without image data
        }

        console.log(`[Chat AI] Requesting analysis for work ID: ${currentWorkDataForChat.id}`);
        isAnalyzing = true; // Set flag
        resetChatAnalysisState(true); // Reset UI and show loading indicator

        const requestData = {
            scorecard_base64: currentWorkDataForChat.scorecardBase64,
            comic_base64: currentWorkDataForChat.comicBase64,
            author: currentWorkDataForChat.author,
            habits: currentWorkDataForChat.currentHabits,
            reflection: currentWorkDataForChat.reflection,
            generate_audio: true // Always request audio (backend handles generation)
        };

        try {
            const response = await fetch('/analyze', { // Hit the revised backend endpoint
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json' // We expect JSON back now
                },
                body: JSON.stringify(requestData)
            });

            // Check response status first
            if (!response.ok) {
                 let errorMsg = `伺服器錯誤 (${response.status})`;
                 try {
                     // Try to parse specific error from JSON response body
                     const errData = await response.json();
                     errorMsg = `分析失敗: ${errData.error || response.statusText || errorMsg}`;
                 } catch (parseErr) {
                     errorMsg = `分析失敗: ${response.statusText || errorMsg}`; // Fallback to status text
                 }
                 throw new Error(errorMsg); // Throw error to be caught below
            }

             // --- Process Successful JSON Response ---
             const result = await response.json();
             console.log("[Chat AI] Received JSON response:", result);

             if (result.success && result.analysis) {
                renderAnalysisResult(result.analysis); // Display the analysis text

                // Handle Audio Data (if present)
                if (result.audio_data_base64) {
                     console.log("[Chat AI] Received Base64 audio data.");
                     try {
                        // Convert Base64 to Blob
                        const audioBlob = base64ToBlob(result.audio_data_base64, 'audio/mpeg');
                        if (!audioBlob || audioBlob.size < 100) { // Check if blob creation failed or is tiny
                             throw new Error("無法處理收到的語音資料 (Blob 無效或過小)。");
                        }

                        // Revoke previous Blob URL if exists to free memory
                        if (currentAudioBlobUrl) {
                            URL.revokeObjectURL(currentAudioBlobUrl);
                            console.log("[Chat Audio] Revoked previous Blob URL.");
                        }

                        // Create new Blob URL and set player source
                        currentAudioBlobUrl = URL.createObjectURL(audioBlob);
                        chatAudioPlayer.src = currentAudioBlobUrl;
                        chatReadAloudBtn.disabled = false; // Enable play button
                        console.log("[Chat AI] Audio ready:", currentAudioBlobUrl.slice(5, 30) + "...");

                        // Check checkbox and attempt to autoplay if checked
                        if (chatAutoplayCheckbox && chatAutoplayCheckbox.checked) {
                            console.log("[Chat AI] Autoplay checkbox is checked, attempting to play...");
                            // Use a small delay to allow the player src to be fully processed
                            setTimeout(playChatAnalysisAudio, 100); // 100ms delay
                        } else {
                             console.log("[Chat AI] Autoplay checkbox not checked.");
                             // Ensure buttons are in correct initial state (Play enabled, Stop hidden)
                             chatReadAloudBtn.disabled = false;
                             chatStopReadingBtn.classList.add('hidden');
                        }
                     } catch(audioError) {
                         console.error("Error processing Base64 audio:", audioError);
                         displayError("處理語音資料時出錯: " + audioError.message);
                         disableAudioControls(); // Disable audio controls on error
                     }

                } else if (result.audio_error) {
                     // Handle case where backend analysis succeeded but TTS failed
                     console.warn("[Chat AI] Audio generation failed on backend:", result.audio_error);
                     displayError(result.audio_error, 'warning'); // Show warning, not critical error
                     disableAudioControls();
                } else {
                     // Analysis succeeded, but no audio data (e.g., generate_audio was false)
                     console.log("[Chat AI] Analysis complete, no audio data returned.");
                     disableAudioControls();
                }

             } else {
                 // JSON response indicated failure (result.success was false)
                 throw new Error(result.error || '分析請求回傳失敗狀態，請稍後再試。');
             }

        } catch (error) {
            console.error("[Chat AI] Fetch/Analysis error:", error);
            displayError(`錯誤: ${error.message}`); // Display error message to user
            resetChatAnalysisState(false); // Hide loading, keep result hidden
            disableAudioControls(); // Ensure audio is off on error

        } finally {
            isAnalyzing = false; // Reset flag allowing new requests
            // Ensure loading indicator is hidden
            if (chatLoading) chatLoading.classList.add('hidden');
            // Ensure analyze button state is correct after completion/error
            if (chatAnalyzeBtn) {
                chatAnalyzeBtn.disabled = !currentWorkDataForChat; // Re-enable only if work data exists
                chatAnalyzeBtn.innerHTML = '<span class="lucide">&#xea7d;</span> 分析當前作品'; // Reset button
            }
        }
    }

    // --- Helper to Display Errors ---
    function displayError(message, type = 'error') {
        if (!chatError) return;
        chatError.textContent = message;
        chatError.classList.remove('hidden');
        // Clear previous type classes
        chatError.classList.remove('text-red-600', 'bg-red-50', 'border-red-200', 'text-yellow-600', 'bg-yellow-50', 'border-yellow-200');

        if (type === 'warning') {
             chatError.classList.add('text-yellow-600', 'bg-yellow-50', 'border-yellow-200');
        } else { // Default to error
             chatError.classList.add('text-red-600', 'bg-red-50', 'border-red-200');
        }
         // Hide loading and result containers when error occurs
        if (chatLoading) chatLoading.classList.add('hidden');
        if (chatResultContainer) chatResultContainer.classList.add('hidden');
    }


    // --- Helper to Render Markdown ---
    function renderAnalysisResult(markdownText) {
        if (!chatResultEl || !chatResultContainer) {
            console.error("Chat result elements not found for rendering.");
            return;
        }
        try {
            // Ensure marked.js is loaded
            if (typeof window.marked?.parse === 'function') {
                 console.log("[Markdown] Using marked.parse()...");
                 // Configure marked (optional)
                 // marked.setOptions({ breaks: true, gfm: true });
                 const dirtyHtml = window.marked.parse(markdownText);
                 // *** SECURITY NOTE: Consider DOMPurify in production ***
                 // const cleanHtml = DOMPurify.sanitize(dirtyHtml);
                 // chatResultEl.innerHTML = cleanHtml;
                 chatResultEl.innerHTML = dirtyHtml; // Use raw marked output for now
            } else {
                console.warn("Marked library not loaded correctly, displaying raw text.");
                chatResultEl.textContent = markdownText; // Fallback to plain text
            }
            // Show the result container and hide error/loading
            chatResultContainer.classList.remove('hidden');
            chatError.classList.add('hidden'); // Hide any previous errors
            chatLoading.classList.add('hidden');

            // Scroll results area to top
            chatResultEl.scrollTop = 0;

        } catch (e) {
            console.error("Error rendering Markdown:", e);
             chatResultEl.textContent = markdownText; // Fallback on render error
             displayError("渲染分析結果時出錯。");
             chatResultContainer.classList.add('hidden'); // Hide potentially broken container
             chatLoading.classList.add('hidden');
        }
    }

    // --- Audio Playback Logic ---
    function playChatAnalysisAudio() {
        if (!currentAudioBlobUrl || !chatAudioPlayer || !chatReadAloudBtn) {
             console.warn("Cannot play audio: No Blob URL or required elements.");
             return;
        }
        console.log("[Chat Audio] Attempting to play:", currentAudioBlobUrl.slice(5,35) + "...");
        if (chatAudioPlayer.src !== currentAudioBlobUrl) {
             chatAudioPlayer.src = currentAudioBlobUrl;
             chatAudioPlayer.load(); // Reload player with new source
             console.log("[Chat Audio] Player src set and loaded.");
        }

        // Attempt to play, handle potential errors (like needing user interaction)
        const playPromise = chatAudioPlayer.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log("[Chat Audio] Playback started successfully.");
                // Button states managed by 'play' event listener
            }).catch(error => {
                console.error("[Chat Audio] Playback failed:", error);
                // Common issue: Autoplay restrictions require user interaction first.
                displayError(`無法自動播放語音: ${error.name}. 請點擊朗讀按鈕。`);
                // Ensure buttons reflect the failed state
                chatReadAloudBtn.disabled = false; // Allow manual play
                chatStopReadingBtn.classList.add('hidden');
                // Do not disable all controls here, just indicate the play failure
            });
        }
    }


    function stopChatAnalysisAudio() {
        if (chatAudioPlayer && !chatAudioPlayer.paused) {
            chatAudioPlayer.pause();
            chatAudioPlayer.currentTime = 0; // Reset position
            console.log("[Chat Audio] Playback stopped via button.");
        }
        // Button states will be updated by the 'pause' event listener
    }

    function setupChatAudioPlayerListeners() {
        if (!chatAudioPlayer || !chatReadAloudBtn || !chatStopReadingBtn) {
             console.error("Cannot setup audio listeners: Elements missing.");
             return;
        }
        console.log("Setting up chat audio player listeners...");

        chatAudioPlayer.addEventListener('play', () => {
            console.log("[Chat Audio] Event: play");
            if(chatReadAloudBtn) chatReadAloudBtn.disabled = true; // Disable play while playing
            if(chatStopReadingBtn) chatStopReadingBtn.classList.remove('hidden'); // Show stop
        });

        chatAudioPlayer.addEventListener('pause', () => { // Catches pause() AND natural end
            console.log("[Chat Audio] Event: pause/ended");
            // Enable play button only if there's valid audio loaded
            if(chatReadAloudBtn) chatReadAloudBtn.disabled = !currentAudioBlobUrl;
            if(chatStopReadingBtn) chatStopReadingBtn.classList.add('hidden'); // Hide stop
        });

        // 'ended' event implicitly triggers 'pause', so handling pause is usually sufficient.
        // If specific 'ended' logic is needed (like analytics), add it here:
        // chatAudioPlayer.addEventListener('ended', () => { console.log("[Chat Audio] Event: ended"); });

        chatAudioPlayer.addEventListener('error', (e) => {
            console.error("[Chat Audio] Player error event:", e);
            const error = chatAudioPlayer.error;
            const errorDetail = error ? ` (Code: ${error.code}, Message: ${error.message})` : '';
            displayError("播放器發生錯誤。" + errorDetail);
            disableAudioControls(); // Disable buttons, clear src on error
        });
        console.log("Chat audio player listeners ready.");
    }

     function disableAudioControls() {
         if (chatReadAloudBtn) chatReadAloudBtn.disabled = true;
         if (chatStopReadingBtn) chatStopReadingBtn.classList.add('hidden');
         if (chatAudioPlayer) {
             if (!chatAudioPlayer.paused) chatAudioPlayer.pause(); // Stop playback
             chatAudioPlayer.removeAttribute('src'); // Remove source URL
             chatAudioPlayer.load(); // Reset internal state
         }
         // Revoke Blob URL to free memory
         if (currentAudioBlobUrl) {
            URL.revokeObjectURL(currentAudioBlobUrl);
            currentAudioBlobUrl = null;
            console.log("[Chat Audio] Blob URL revoked and controls disabled.");
        } else {
             console.log("[Chat Audio] Controls disabled (no active Blob URL).");
        }
     }

     // --- Reset Analysis Section UI ---
     function resetChatAnalysisState(showLoading = false) {
         console.log(`[Chat State] Resetting analysis state (showLoading: ${showLoading})`);
         if (chatLoading) chatLoading.classList.toggle('hidden', !showLoading);
         if (chatError) chatError.classList.add('hidden'); // Always hide error message on reset
         if (chatResultContainer) chatResultContainer.classList.add('hidden'); // Hide results
         if (chatResultEl) chatResultEl.innerHTML = ''; // Clear previous results

         // Handle analyze button state
         if (chatAnalyzeBtn) {
             if (showLoading) {
                 chatAnalyzeBtn.disabled = true;
                 // Update button text/icon for loading state
                 chatAnalyzeBtn.innerHTML = '<span class="spinner" style="width: 1em; height: 1em; border-width: 2px; display: inline-block; margin-right: 5px;"></span> 分析中...';
             } else {
                 // Reset button to default state
                 chatAnalyzeBtn.innerHTML = '<span class="lucide">&#xea7d;</span> 分析當前作品';
                 // Enable button only if work data exists AND not currently analyzing
                 chatAnalyzeBtn.disabled = !currentWorkDataForChat || isAnalyzing;
             }
         }

         // Reset audio state completely
         stopChatAnalysisAudio(); // Ensure player stopped if it was playing
         disableAudioControls(); // Revoke URL, disable buttons, clear src
     }

     // --- Utility: Convert Base64 Data URL to Blob ---
     function base64ToBlob(base64, contentType = '', sliceSize = 512) {
        try {
            // Ensure input is a string
            if (typeof base64 !== 'string') {
                 throw new Error("Input must be a base64 string.");
            }
            // Remove the prefix (e.g., "data:audio/mpeg;base64,") if it exists
            const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
            // Validate base64 characters (more robustly)
            const validBase64Chars = /^[A-Za-z0-9+/]*=?=?$/; // Allows padding
            if (!validBase64Chars.test(base64Data.replace(/\s/g, ''))) {
                 throw new Error("Invalid Base64 character detected.");
            }
            // Check padding validity (length must be multiple of 4)
            if (base64Data.length % 4 !== 0) {
                 console.warn("Base64 string length is not a multiple of 4 (potentially incorrect padding).")
                 // Attempt to decode anyway, atob might handle some cases
            }

            const byteCharacters = atob(base64Data); // Decode Base64
            const byteArrays = [];

            for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
                const slice = byteCharacters.slice(offset, offset + sliceSize);
                const byteNumbers = new Array(slice.length);
                for (let i = 0; i < slice.length; i++) {
                    byteNumbers[i] = slice.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                byteArrays.push(byteArray);
            }

            return new Blob(byteArrays, { type: contentType });
        } catch (e) {
             // Catch decoding errors (e.g., invalid characters)
             console.error("Error in base64ToBlob:", e);
             // Return null or throw, depending on how caller handles errors
             // throw new Error("Failed to convert Base64 to Blob: " + e.message);
             return null; // Indicate failure
        }
    }

     // --- Utility: Escape HTML (needed for info text) ---
     function escapeHTML(str) {
        if (str === null || typeof str === 'undefined') return '';
        if (typeof str !== 'string') str = String(str);
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return str.replace(/[&<>"']/g, (m) => map[m]);
    }


    // --- Run Initialization after DOM is ready ---
    initializeChatWidget();

}); // End of DOMContentLoaded listener