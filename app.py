# LHTL/app.py

import os
import json
import uuid
import tempfile
import io
import base64 # Needed for encoding audio data
import shutil
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, abort, Response # Added Response
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI
from PIL import Image, UnidentifiedImageError

# --- 設定 ---
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_FOLDER = BASE_DIR / 'uploads'
# AUDIO_CACHE_FOLDER no longer needed
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
DATA_FILE = BASE_DIR / 'works_data.json'
MAX_UPLOAD_SIZE_MB = 16 # Max upload size in Megabytes

# --- 初始化 Flask App & AI Client ---
app = Flask(__name__, static_folder='static', static_url_path='/static')
CORS(app) # Allow all origins for simplicity, restrict in production
app.config['MAX_CONTENT_LENGTH'] = MAX_UPLOAD_SIZE_MB * 1024 * 1024 # Set max request size

load_dotenv()
API_KEY = os.getenv("OPENAI_API_KEY")
ai_client = None
if API_KEY:
    try:
        ai_client = OpenAI(api_key=API_KEY)
        print("INFO: OpenAI Client Configured.")
    except Exception as e:
        print(f"ERROR: OpenAI Client Config Failed: {e}")
else:
    print("WARNING: OPENAI_API_KEY not found in .env file. AI features will be disabled.")


# --- 輔助函數 ---
def allowed_file(filename):
    """Checks if the filename has an allowed extension."""
    return filename and '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_works_data():
    """Loads work data from the JSON file."""
    if not DATA_FILE.exists():
        print(f"INFO: Data file {DATA_FILE} not found, returning empty list.")
        return []
    try:
        # Ensure file is not empty before loading
        if DATA_FILE.stat().st_size == 0:
            print(f"WARNING: {DATA_FILE} is empty. Returning empty list.")
            # Optionally create an empty list file here if desired
            # with open(DATA_FILE, 'w', encoding='utf-8') as f: json.dump([], f)
            return []
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        # Basic validation: ensure it's a list
        if not isinstance(data, list):
             print(f"ERROR: Data in {DATA_FILE} is not a list. Returning empty list.")
             # Consider backing up the corrupted file
             return []
        return data
    except json.JSONDecodeError as e:
        print(f"ERROR loading {DATA_FILE}: JSON Decode Error - {e}. Returning empty list.", flush=True)
        return []
    except Exception as e:
        print(f"ERROR loading {DATA_FILE}: {e}", flush=True)
        return []

def save_works_data(data):
    """Saves work data to the JSON file atomically."""
    temp_filepath_obj = None # Use Path object
    try:
        # Use tempfile in the same directory for atomic replace
        # This creates the file securely and returns a file descriptor and path string
        fd, temp_filepath_str = tempfile.mkstemp(suffix='.tmp', prefix=DATA_FILE.name + '.', dir=BASE_DIR)
        temp_filepath_obj = Path(temp_filepath_str) # Convert to Path object

        # Write data to the temporary file using the file descriptor
        with os.fdopen(fd, 'w', encoding='utf-8') as temp_f:
            json.dump(data, temp_f, ensure_ascii=False, indent=4) # Use indent for readability

        # Replace the original file atomically using shutil.move
        # This is generally safer than os.replace across different systems/filesystems
        shutil.move(str(temp_filepath_obj), DATA_FILE)
        print(f"INFO: Data saved successfully to {DATA_FILE}")
        return True
    except Exception as e:
        print(f"ERROR saving {DATA_FILE}: {e}", flush=True)
        # Clean up temp file if it exists and replacement failed
        if temp_filepath_obj and temp_filepath_obj.exists():
            try:
                temp_filepath_obj.unlink(missing_ok=True)
                print(f"INFO: Cleaned up temporary file {temp_filepath_obj}")
            except OSError as unlink_err:
                 print(f"ERROR: Could not remove temporary file {temp_filepath_obj}: {unlink_err}")
        return False
    finally:
         # Ensure temp_filepath is cleaned up if it still exists for some unexpected reason
        if temp_filepath_obj and temp_filepath_obj.exists():
            try:
                temp_filepath_obj.unlink(missing_ok=True)
            except OSError:
                pass # Ignore errors during final cleanup attempt

def encode_image_to_base64(image_path: Path) -> str | None:
    """Encodes an image file to a base64 Data URL."""
    if not image_path.is_file():
        print(f"ERROR: encode_image: File not found: {image_path}")
        return None
    try:
        # Determine MIME type reliably using Pillow format if available
        mime_type = None
        try:
             with Image.open(image_path) as img:
                 img.verify()  # Verify image integrity without loading full data
                 img_format = img.format # Get format ('JPEG', 'PNG', etc.)
                 if img_format:
                      mime_map = {"JPEG": "image/jpeg", "PNG": "image/png", "GIF": "image/gif", "WEBP": "image/webp"}
                      mime_type = mime_map.get(img_format.upper())
        except UnidentifiedImageError:
             print(f"WARN: encode_image: Pillow couldn't identify {image_path.name}. Falling back to extension.")
        except Exception as pillow_err:
             print(f"WARN: encode_image: Pillow error verifying {image_path.name}: {pillow_err}. Falling back to extension.")


        # Fallback to file extension if Pillow format is unavailable or failed
        if not mime_type:
             ext = image_path.suffix.lower().strip('.')
             mime_map_ext = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp"}
             mime_type = mime_map_ext.get(ext)
             if not mime_type:
                  print(f"ERROR: encode_image: Unknown file extension '{ext}' for {image_path.name}. Cannot determine MIME type.")
                  return None # Cannot proceed without MIME type

        # Read binary data and encode
        with open(image_path, "rb") as f:
            binary_data = f.read()
        if not binary_data:
            raise ValueError("Read 0 bytes from image file.")

        base64_string = base64.b64encode(binary_data).decode('utf-8')
        if not base64_string:
            raise ValueError("Generated empty base64 string.")

        print(f"DEBUG: Encoded {image_path.name} (MIME: {mime_type}). Base64 length: {len(base64_string)}")
        return f"data:{mime_type};base64,{base64_string}"

    except FileNotFoundError: # Should be caught by is_file() earlier, but good practice
         print(f"ERROR: encode_image: File disappeared before reading: {image_path}")
         return None
    except Exception as e:
        print(f"ERROR: encode_image failed for {image_path.name}: {e}")
        return None


# --- App Startup Initialization ---
def initialize_directories_and_files():
    """Creates necessary directories and initializes the data file."""
    folders = [UPLOAD_FOLDER] # Only need upload folder
    for folder in folders:
        try:
            folder.mkdir(parents=True, exist_ok=True)
            print(f"INFO: Directory '{folder}' is ready.")
        except OSError as e:
            print(f"CRITICAL ERROR: Cannot create directory '{folder}': {e}. Uploads will fail.")
            # Consider exiting if uploads are critical: exit(1)

    # Initialize data file
    try:
        if not DATA_FILE.exists():
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                f.write('[]') # Write empty JSON list
            print(f"INFO: Initialized empty data file: {DATA_FILE}")
        else:
            # Attempt to load data on startup to validate format
            initial_data = load_works_data()
            print(f"INFO: Data file {DATA_FILE} exists, loaded {len(initial_data)} records.")
    except Exception as e:
        print(f"ERROR: Data file check/initialization failed: {e}")

initialize_directories_and_files()

# --- Error Handlers ---
@app.errorhandler(404)
def not_found_error(error):
    # Log the error or path if needed
    # print(f"DEBUG: 404 Not Found for path: {request.path}")
    return jsonify({"success": False, "error": "資源不存在 (Not Found)"}), 404

@app.errorhandler(405)
def method_not_allowed_error(error):
    return jsonify({"success": False, "error": "方法不被允許 (Method Not Allowed)"}), 405

@app.errorhandler(500)
def internal_error(error):
    # Log the actual error trace here for debugging
    print(f"CRITICAL: Internal Server Error: {error}", flush=True)
    # Potentially log traceback: import traceback; traceback.print_exc()
    return jsonify({"success": False, "error": "伺服器內部錯誤 (Internal Server Error)"}), 500

@app.errorhandler(413)
def payload_too_large_error(error):
    return jsonify({"success": False, "error": f"檔案或請求過大 (上限 {MAX_UPLOAD_SIZE_MB} MB)"}), 413


# --- API Endpoints ---

@app.route('/upload', methods=['POST'])
def upload_work():
    """Handles the upload of new work data and images."""
    if request.method != 'POST': abort(405) # Should be caught by error handler, but good practice

    # Check Content-Length header early if possible (though Flask handles MAX_CONTENT_LENGTH)
    # content_length = request.content_length
    # if content_length and content_length > app.config['MAX_CONTENT_LENGTH']:
    #     abort(413) # Payload Too Large

    # Validate form fields
    required_fields = ['author-name', 'current-habits', 'reflection']
    form_data = request.form
    missing_fields = [f for f in required_fields if not form_data.get(f,'').strip()]
    if missing_fields:
        return jsonify({"success": False, "error": f"缺少欄位: {', '.join(missing_fields)}"}), 400

    # Validate file uploads
    required_files = ['scorecard-image', 'comic-image']
    file_data = request.files
    missing_files = [f for f in required_files if f not in file_data or not file_data[f].filename]
    if missing_files:
        return jsonify({"success": False, "error": f"缺少檔案: {', '.join(missing_files)}"}), 400

    scorecard_file = file_data['scorecard-image']
    comic_file = file_data['comic-image']

    # Validate file extensions
    if not allowed_file(scorecard_file.filename) or not allowed_file(comic_file.filename):
        return jsonify({"success": False, "error": "檔案格式不符 (僅接受 PNG, JPG, GIF)"}), 400

    # --- Basic Image Validation (using Pillow) ---
    try:
        # Verify both images without loading fully into memory
        with Image.open(scorecard_file) as img: img.verify()
        scorecard_file.seek(0) # Reset file pointer after verify
        with Image.open(comic_file) as img: img.verify()
        comic_file.seek(0) # Reset file pointer after verify
        print("INFO: Uploaded image files verified successfully.")
    except UnidentifiedImageError:
        print(f"ERROR: Upload validation failed - Unidentified image format.")
        return jsonify({"success": False, "error": "無法辨識的圖片檔案格式或檔案已損壞。"}), 400
    except Exception as img_err:
         # Log other Pillow errors but potentially allow upload (e.g., metadata errors)
         print(f"WARNING: Image verification encountered an issue: {img_err}")
    # --- End Image Validation ---

    saved_files_info = {} # To track saved files for potential cleanup on error
    try:
        # Save scorecard image
        s_ext = scorecard_file.filename.rsplit('.', 1)[1].lower()
        s_unique_id = uuid.uuid4()
        s_filename = f"{s_unique_id}_scorecard.{s_ext}"
        s_filepath = UPLOAD_FOLDER / s_filename
        scorecard_file.save(s_filepath)
        saved_files_info['scorecard'] = {'filename': s_filename, 'filepath': s_filepath}
        print(f"INFO: Saved scorecard image: {s_filename}")

        # Save comic image
        c_ext = comic_file.filename.rsplit('.', 1)[1].lower()
        c_unique_id = uuid.uuid4() # Generate separate UUID if needed
        c_filename = f"{c_unique_id}_comic.{c_ext}"
        c_filepath = UPLOAD_FOLDER / c_filename
        comic_file.save(c_filepath)
        saved_files_info['comic'] = {'filename': c_filename, 'filepath': c_filepath}
        print(f"INFO: Saved comic image: {c_filename}")

        # Load existing data, append new entry
        works_data = load_works_data()
        new_work_id = str(uuid.uuid4())
        new_work_entry = {
            "id": new_work_id,
            "author": form_data.get('author-name','').strip(),
            "currentHabits": form_data.get('current-habits','').strip(),
            "reflection": form_data.get('reflection','').strip(),
            "scorecardFilename": s_filename,
            "comicFilename": c_filename
            # Consider adding timestamp: "timestamp": datetime.now().isoformat() (import datetime)
        }
        works_data.append(new_work_entry)

        # Save updated data back to file
        if not save_works_data(works_data):
            raise IOError("儲存作品資料檔時發生錯誤。") # More specific error

        # Success response
        return jsonify({
            "success": True,
            "message": "分享成功！",
            "work_id": new_work_id
        }), 201

    except Exception as e:
        print(f"ERROR: Upload processing failed: {e}", flush=True)
        # Clean up any files that were saved before the error occurred
        for key in saved_files_info:
             filepath = saved_files_info[key].get('filepath')
             if filepath and filepath.exists():
                try:
                    filepath.unlink(missing_ok=True)
                    print(f"INFO: Cleaned up partially saved file: {filepath.name}")
                except OSError as del_err:
                    print(f"WARN: Could not delete partially saved file on error: {filepath.name} - {del_err}")

        # Determine appropriate error message and status code
        error_message = "伺服器處理上傳時發生錯誤。"
        status_code = 500
        if isinstance(e, IOError): # Specific error saving data file
            error_message = str(e)
        # Consider checking for file system errors (e.g., disk full) if possible

        return jsonify({"success": False, "error": error_message}), status_code


@app.route('/works', methods=['GET'])
def get_works():
    """Retrieves the list of works with image URLs."""
    works_data = load_works_data()
    processed_works = []
    required_keys = ["id", "author", "currentHabits", "reflection", "scorecardFilename", "comicFilename"]

    for work_entry in works_data:
        # Validate each entry
        if isinstance(work_entry, dict) and all(key in work_entry for key in required_keys):
            # Ensure filenames are present and non-empty strings
            s_filename = work_entry.get("scorecardFilename")
            c_filename = work_entry.get("comicFilename")
            if s_filename and isinstance(s_filename, str) and c_filename and isinstance(c_filename, str):
                 processed_works.append({
                    "id": work_entry["id"],
                    "author": work_entry["author"],
                    "currentHabits": work_entry["currentHabits"],
                    "reflection": work_entry["reflection"],
                    "scorecardImageUrl": f"/uploads/{s_filename}", # Construct URL
                    "comicImageUrl": f"/uploads/{c_filename}"     # Construct URL
                })
            else:
                 print(f"WARN: Skipped work entry due to missing or invalid filenames: ID {work_entry.get('id', 'N/A')}", flush=True)
        else:
            print(f"WARN: Skipped invalid or incomplete work data structure: {work_entry}", flush=True)

    # Return the processed list, even if empty
    return jsonify(processed_works)


@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    """Securely serves files from the UPLOAD_FOLDER."""
    try:
        # Secure path resolution
        # normalize joins paths and resolves '..' etc. safely within root
        # resolve makes it absolute, ensuring it's under UPLOAD_FOLDER
        upload_dir = UPLOAD_FOLDER.resolve()
        safe_path = upload_dir.joinpath(filename).resolve()

        # Check if the resolved path is still within the upload directory and is a file
        if not safe_path.is_file() or not str(safe_path).startswith(str(upload_dir)):
            print(f"WARN: Denied access to non-existent or escaped path: {filename} (Resolved: {safe_path})")
            abort(404)

        # Use Flask's send_from_directory for proper headers (cache control, etc.)
        # print(f"DEBUG: Serving file: {filename} from {UPLOAD_FOLDER}")
        return send_from_directory(UPLOAD_FOLDER, filename) # filename relative to UPLOAD_FOLDER

    except FileNotFoundError: # Should be caught by is_file(), but as fallback
        print(f"WARN: File not found in uploads directory (send_from_directory): {filename}")
        abort(404)
    except Exception as e:
        print(f"ERROR: Unexpected error serving uploaded file {filename}: {e}")
        abort(500) # Internal Server Error


@app.route('/analyze', methods=['POST'])
def analyze_current_work_revised():
    """
    Performs AI analysis on data provided in the request body (images + text).
    Optionally generates TTS audio and includes it Base64 encoded in the JSON response.
    """
    print(f"DEBUG: Received revised analysis request at /analyze.")
    if not ai_client:
        print("ERROR: AI client not configured. Cannot perform analysis.")
        return jsonify({"success": False, "error": "AI 服務目前無法使用。"}), 503 # Service Unavailable

    # Ensure request is JSON
    if not request.is_json:
         return jsonify({"success": False, "error": "請求格式錯誤 (需要 JSON)。"}), 415 # Unsupported Media Type

    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "請求資料缺失或格式錯誤。"}), 400

    # --- Extract and Validate Input Data ---
    scorecard_base64 = data.get('scorecard_base64')
    comic_base64 = data.get('comic_base64')
    author = data.get('author', '學生').strip()
    habits = data.get('habits', '').strip()
    reflection = data.get('reflection', '').strip()
    generate_audio = data.get('generate_audio', True) # Default to true

    if not scorecard_base64 or not comic_base64:
        return jsonify({"success": False, "error": "圖片 Base64 資料缺失。"}), 400

    # Basic Base64 Data URL validation
    if not scorecard_base64.startswith('data:image/') or not comic_base64.startswith('data:image/'):
        print(f"WARN: Invalid Base64 prefix received. Scorecard starts: {scorecard_base64[:30]}, Comic starts: {comic_base64[:30]}")
        return jsonify({"success": False, "error": "圖片資料格式錯誤 (非 Base64 Data URL)。"}), 400

    # --- Prepare Prompts ---
    # Refined prompts for better analysis focus
    system_prompt = "你是一位友善、專業、有洞察力的學習助教。請務必使用**繁體中文**進行回覆。你的目標是根據學生提供的文字和圖片，進行全面分析，並給予具體、鼓勵性的回饋。請使用 Markdown 格式。"

    user_prompt_text = f"""
請分析以下來自「{author}」同學的習慣養成紀錄：

一、學生自述：

* **目前的習慣描述：**
    ```
    {habits if habits else "(學生未提供文字描述)"}
    ```
* **反思與展望：**
    ```
    {reflection if reflection else "(學生未提供文字反思)"}
    ```

二、學生作品圖片：

* 下方已提供學生的「習慣計分卡」圖片。
* 下方已提供學生的「六格漫畫」圖片。

三、你的分析任務：
對習慣計分卡與六格漫畫做出簡潔有力的描述與評價
簡潔有力的總結學生在習慣養成上的亮點和可能遇到的困難。
基於以上所有資訊，提出 1-2 個 簡潔並且具體、可操作、且具鼓勵性的建議，幫助學生持續改進。建議應同時考慮文字和圖片內容。
保持正面、支持的語氣。

**請以簡潔有力、清晰的 Markdown 格式呈現你的分析報告。**
"""

    analysis_result_text = None
    response_data = {"success": False} # Prepare response dict

    # --- Call OpenAI Chat API (with Vision) ---
    try:
        # Choose appropriate model (gpt-4o is generally good for vision and cost)
        model_to_use = "gpt-4.1-mini-2025-04-14"
        print(f"DEBUG: Sending Chat request to OpenAI model: {model_to_use}...")

        messages_payload = [
             {"role": "system", "content": system_prompt},
             {"role": "user", "content": [
                 {"type": "text", "text": user_prompt_text},
                 # Use "auto" detail for balancing cost/quality, or "high" if detail is crucial
                 {"type": "image_url", "image_url": {"url": scorecard_base64, "detail": "auto"}},
                 {"type": "image_url", "image_url": {"url": comic_base64, "detail": "auto"}}
             ]}
        ]

        # Make the API call
        chat_response = ai_client.chat.completions.create(
            model=model_to_use,
            messages=messages_payload,
            max_tokens=1500, # Increased slightly for potentially detailed analysis
            temperature=0.6 # Slightly lower temperature for more focused analysis
            )

        # Validate response structure
        if not chat_response.choices or not chat_response.choices[0].message or not chat_response.choices[0].message.content:
             # Log the raw response if possible for debugging
             print(f"ERROR: Invalid chat response structure. Response: {chat_response}")
             raise Exception("從 AI 收到的回應結構無效。")

        analysis_result_text = chat_response.choices[0].message.content.strip()

        # Basic check for meaningful content (e.g., more than a few words)
        if not analysis_result_text or len(analysis_result_text) < 10:
             print(f"WARN: OpenAI returned very short or empty analysis content: '{analysis_result_text}'")
             # Treat as success but maybe indicate potential issue? Or raise error?
             # For now, let it pass but log it.
             # raise Exception("AI 回傳的分析內容過短或空白。") # Option to make it an error

        response_data["success"] = True
        response_data["analysis"] = analysis_result_text
        print(f"DEBUG: Received analysis text (length: {len(analysis_result_text)}).")

    except Exception as e:
        print(f"ERROR: OpenAI Chat API call failed: {e}", flush=True)
        # Provide more context if it's an APIError from OpenAI client
        error_message = "AI 文字分析時發生錯誤。"
        if hasattr(e, 'status_code'): # Check if it looks like an API error
             error_message += f" (狀態碼: {e.status_code})"
        # Consider logging e for detailed traceback
        response_data["error"] = error_message
        return jsonify(response_data), 500 # Return error JSON

    # --- Generate Audio IF analysis succeeded AND requested ---
    if response_data["success"] and generate_audio:
        try:
            # Choose TTS model and voice
            tts_model = "tts-1" # or tts-1-hd
            tts_voice = "alloy" # alloy, echo, fable, onyx, nova, shimmer

            print(f"DEBUG: Sending TTS request (model: {tts_model}, voice: {tts_voice})...")
            tts_response = ai_client.audio.speech.create(
                model=tts_model,
                voice=tts_voice,
                input=analysis_result_text, # Use the generated analysis text
                response_format="mp3" # Common format, good balance
            )
            # Read the audio content directly into memory (more efficient than streaming to file)
            audio_bytes = tts_response.content # .content holds the raw bytes
            if not audio_bytes:
                raise ValueError("TTS API returned empty audio content.")

            # Encode audio bytes as Base64 string for JSON transport
            audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
            response_data["audio_data_base64"] = audio_base64 # Add to JSON response
            print(f"DEBUG: Included Base64 audio in response (MP3 bytes: {len(audio_bytes)}, Base64 length: {len(audio_base64)}).")

        except Exception as e:
            print(f"ERROR: OpenAI TTS API call failed: {e}", flush=True)
            # Don't fail the whole request if only TTS fails. Add error info to the response.
            response_data["audio_error"] = "語音合成失敗，但文字分析已完成。"
            # Do not add the audio_data_base64 key if TTS failed

    # --- Return the final JSON response ---
    # Structure: { success: true/false, analysis: "...", [audio_data_base64: "..."], [audio_error: "..."], [error: "..."] }
    print(f"DEBUG: Returning analysis response. Keys: {list(response_data.keys())}")
    return jsonify(response_data)


@app.route('/')
def index():
    """Serves the main index.html file."""
    try:
        index_path = BASE_DIR / 'index.html'
        if not index_path.is_file():
             print("CRITICAL ERROR: index.html not found in application directory.")
             # Provide a minimal fallback or clear error
             return "<h1>錯誤: 找不到主頁面檔案 (index.html)。</h1>", 404
        # Use send_from_directory for proper content type and caching headers
        return send_from_directory(BASE_DIR, 'index.html')
    except Exception as e:
        print(f"ERROR: Failed to serve index.html: {e}")
        abort(500) # Internal Server Error


if __name__ == '__main__':
    # Determine if running in production based on environment variable
    # Production WSGI servers (like Gunicorn) usually set this or similar vars
    is_production = os.environ.get('FLASK_ENV') == 'production' or \
                    os.environ.get('SERVER_SOFTWARE', '').startswith('gunicorn')

    # Get port from environment or default
    port = int(os.environ.get('PORT', 5000))

    if is_production:
         print(f"INFO: Detected production environment. (Flask debug mode OFF)")
         # In production, Gunicorn/Waitress should be used externally to run the app.
         # This block might not even be reached if run via gunicorn app:app
         # If running directly (e.g., python app.py) in prod (not recommended),
         # ensure debug=False.
         # Example using Waitress if installed:
         # try:
         #     from waitress import serve
         #     print(f"INFO: Starting Waitress server on port {port}...")
         #     serve(app, host='0.0.0.0', port=port)
         # except ImportError:
         #     print("WARN: Waitress not installed. Falling back to Flask dev server (NOT recommended for production).")
         #     app.run(debug=False, host='0.0.0.0', port=port)
         print("INFO: Production environment detected. Please use a WSGI server like Gunicorn or Waitress to run this application.")
         print("INFO: Example: gunicorn --bind 0.0.0.0:{port} app:app")
         # Running Flask dev server in production is insecure and inefficient
         # Forcing debug off if this block is somehow reached
         app.run(debug=False, host='0.0.0.0', port=port)

    else:
         print(f"INFO: Starting Flask development server on http://0.0.0.0:{port} (Debug Mode ON)")
         app.run(debug=True, host='0.0.0.0', port=port)