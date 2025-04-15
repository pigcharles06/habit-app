// static/js/utils.js

/**
 * Handles image loading errors by replacing the source with a placeholder SVG.
 * Provides more specific error context if available.
 * @param {HTMLImageElement} imgElement - The image element that failed to load.
 * @param {string} [errorContext='圖片載入失敗'] - Contextual text for the error.
 */
function handleImageError(imgElement, errorContext = '圖片載入失敗') {
    // Log the error with context
    console.error(`圖片載入失敗 (${errorContext}): ${imgElement?.src || 'N/A'}, Alt: ${imgElement?.alt || 'N/A'}`);

    // Ensure imgElement is valid before proceeding
    if (!imgElement || !(imgElement instanceof HTMLImageElement)) {
        console.error("handleImageError called with invalid element.");
        return;
    }

    // Prevent infinite loop if the placeholder itself fails
    imgElement.onerror = null;

    // Determine size - use a default or specific size for elements like the cat
    const defaultSize = 150; // Default placeholder size
    const isCat = imgElement.id === 'interactive-cat-img';
    const size = isCat ? 80 : (parseInt(imgElement.dataset.placeholderSize) || defaultSize); // Allow custom size via data attribute

    // Create a more informative SVG placeholder
    const placeholderSvg = `
        <svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}' style='background-color: #eee;'>
            <rect width='100%' height='100%' fill='%23ddd'/>
             <g font-family='sans-serif' font-size='${size > 60 ? 14 : 10}px' fill='%23777' text-anchor='middle'>
                <text x='50%' y='45%' dominant-baseline='middle' font-size='${size * 0.2}px'>⚠️</text>
                <text x='50%' y='65%' dominant-baseline='middle' style='font-weight:bold;'>${escapeHTML(errorContext)}</text>
            </g>
        </svg>`;

    // Use data URI to embed the SVG directly
    const svgDataUri = `data:image/svg+xml,${encodeURIComponent(placeholderSvg)}`;

    // Check if the image element still exists in the DOM before updating its src
     if (document.body.contains(imgElement)) {
        imgElement.src = svgDataUri;
     }

    // Update alt text to reflect the error
    imgElement.alt = errorContext;
}

/**
 * Escapes HTML special characters to prevent XSS vulnerabilities.
 * Handles null or non-string inputs gracefully.
 * @param {string | null | undefined} str - The string to escape.
 * @returns {string} The escaped string, or an empty string if input is invalid.
 */
function escapeHTML(str) {
    if (str == null || typeof str !== 'string') {
        return ''; // Return empty string for null, undefined, or non-string types
    }
    // Use a regex to replace potentially harmful characters with HTML entities
    // & must be replaced first
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
}