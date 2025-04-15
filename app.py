# LHTL/app.py

import os
import json
import uuid
import tempfile
import io
import base64
import shutil
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI
from PIL import Image, UnidentifiedImageError

# --- 設定 ---
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_FOLDER = BASE_DIR / 'uploads'
AUDIO_CACHE_FOLDER = BASE_DIR / 'audio_cache'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
DATA_FILE = BASE_DIR / 'works_data.json'

# --- 初始化 Flask App & AI Client ---
app = Flask(__name__, static_folder='static', static_url_path='/static')
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

load_dotenv()
API_KEY = os.getenv("OPENAI_API_KEY")
ai_client = None
if API_KEY:
    try: ai_client = OpenAI(api_key=API_KEY); print("INFO: OpenAI Client Configured.")
    except Exception as e: print(f"ERROR: OpenAI Client Config Failed: {e}")
else: print("WARNING: OPENAI_API_KEY not found in .env")


# --- 輔助函數 ---
def allowed_file(filename):
    return filename and '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_works_data():
    if not DATA_FILE.exists(): return []
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f: content = f.read(); f.seek(0); data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception as e: print(f"ERROR loading {DATA_FILE}: {e}", flush=True); return []

def save_works_data(data):
    temp_filepath = None
    try:
        with tempfile.NamedTemporaryFile('w', encoding='utf-8', delete=False, dir=BASE_DIR, suffix='.tmp', prefix=DATA_FILE.name + '.') as temp_f: json.dump(data, temp_f, ensure_ascii=False, indent=4); temp_filepath = Path(temp_f.name)
        os.replace(temp_filepath, DATA_FILE); return True
    except Exception as e:
        print(f"ERROR saving {DATA_FILE}: {e}", flush=True)
        if temp_filepath and temp_filepath.exists():
            try: temp_filepath.unlink(missing_ok=True)
            except OSError: pass
        return False

def encode_image_to_base64(image_path: Path) -> str | None:
    if not image_path.is_file(): print(f"ERROR: encode_image: File not found: {image_path}"); return None
    try:
        mime_type = None
        with Image.open(image_path) as img: img.verify(); img_format = img.format
        with open(image_path, "rb") as f: binary_data = f.read()
        if not binary_data: raise ValueError("Read 0 bytes")
        base64_string = base64.b64encode(binary_data).decode('utf-8')
        if not base64_string: raise ValueError("Empty base64 string")
        ext = image_path.suffix.lower().strip('.')
        mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp"}
        mime_type = mime_map.get(img_format.lower() if img_format else ext, "image/jpeg")
        print(f"DEBUG: Encoded {image_path.name} (MIME: {mime_type}). Base64 length: {len(base64_string)}")
        return f"data:{mime_type};base64,{base64_string}"
    except Exception as e: print(f"ERROR: encode_image {image_path.name}: {e}"); return None

# --- App Startup Initialization ---
def initialize_directories_and_files():
    folders = [UPLOAD_FOLDER, AUDIO_CACHE_FOLDER]
    for folder in folders:
        try: folder.mkdir(parents=True, exist_ok=True); print(f"INFO: Folder '{folder}' ready.")
        except OSError as e: print(f"ERROR: Cannot create folder '{folder}': {e}")
    try:
        if not DATA_FILE.exists() or DATA_FILE.stat().st_size == 0:
             with open(DATA_FILE, 'w', encoding='utf-8') as f: f.write('[]'); print(f"INFO: Initialized {DATA_FILE}")
        else: load_works_data()
    except Exception as e: print(f"ERROR: Data file init failed: {e}")

initialize_directories_and_files()

# --- API Endpoints ---

@app.route('/upload', methods=['POST'])
def upload_work(): # No changes
    if request.method != 'POST': abort(405)
    required_fields = ['author-name', 'current-habits', 'reflection']; form_data = request.form; missing_fields = [f for f in required_fields if not form_data.get(f,'').strip()]
    if missing_fields: return jsonify({"success": False, "error": f"缺少: {', '.join(missing_fields)}"}), 400
    required_files = ['scorecard-image', 'comic-image']; file_data = request.files; missing_files = [f for f in required_files if f not in file_data or not file_data[f].filename]
    if missing_files: return jsonify({"success": False, "error": f"缺少檔案: {', '.join(missing_files)}"}), 400
    s_file = file_data['scorecard-image']; c_file = file_data['comic-image']
    if not allowed_file(s_file.filename) or not allowed_file(c_file.filename): return jsonify({"success": False, "error": "檔案格式不符"}), 400
    saved = {}
    try:
        s_ext=s_file.filename.rsplit('.',1)[1].lower(); s_fname=f"{uuid.uuid4()}_scorecard.{s_ext}"; s_path=UPLOAD_FOLDER/s_fname; s_file.save(s_path); saved['scorecard']={'filename':s_fname,'filepath':s_path}; print(f"INFO: Saved {s_fname}")
        c_ext=c_file.filename.rsplit('.',1)[1].lower(); c_fname=f"{uuid.uuid4()}_comic.{c_ext}"; c_path=UPLOAD_FOLDER/c_fname; c_file.save(c_path); saved['comic']={'filename':c_fname,'filepath':c_path}; print(f"INFO: Saved {c_fname}")
        works=load_works_data(); new_work={"id": str(uuid.uuid4()),"author":form_data.get('author-name','').strip(),"currentHabits":form_data.get('current-habits','').strip(),"reflection":form_data.get('reflection','').strip(),"scorecardFilename":s_fname,"comicFilename":c_fname}; works.append(new_work)
        if not save_works_data(works): raise IOError("Save failed")
        return jsonify({"success": True, "message": "分享成功!", "work_id": new_work["id"]}), 201
    except Exception as e:
        print(f"ERROR: Upload failed: {e}", flush=True)
        for key in saved:
             if saved[key]['filepath'].exists():
                try: saved[key]['filepath'].unlink(missing_ok=True)
                except OSError: pass
        return jsonify({"success": False, "error": "伺服器錯誤"}), 500

@app.route('/works', methods=['GET'])
def get_works(): # No changes
    works_data = load_works_data(); urls = []
    keys = ["id","author","currentHabits","reflection","scorecardFilename","comicFilename"]
    for w in works_data:
        if isinstance(w, dict) and all(k in w for k in keys): urls.append({"id":w["id"],"author":w["author"],"currentHabits":w["currentHabits"],"reflection":w["reflection"],"scorecardImageUrl":f"/uploads/{w['scorecardFilename']}","comicImageUrl":f"/uploads/{w['comicFilename']}"})
        else: print(f"WARN: Skipped invalid work: {w}", flush=True)
    return jsonify(urls)

@app.route('/uploads/<path:filename>')
def uploaded_file(filename): # No changes
    safe_path = UPLOAD_FOLDER.joinpath(filename).resolve()
    if not str(safe_path).startswith(str(UPLOAD_FOLDER.resolve())): abort(404)
    try: return send_from_directory(UPLOAD_FOLDER, filename)
    except FileNotFoundError: abort(404)

@app.route('/audio_cache/<path:filename>')
def serve_audio_file(filename): # No changes
    safe_path = AUDIO_CACHE_FOLDER.joinpath(filename).resolve()
    if not str(safe_path).startswith(str(AUDIO_CACHE_FOLDER.resolve())): abort(404)
    try: return send_from_directory(AUDIO_CACHE_FOLDER, filename, mimetype='audio/mpeg')
    except FileNotFoundError: abort(404)

@app.route('/analyze/<string:work_id>', methods=['POST'])
def analyze_work(work_id):
    """進行 AI 分析並生成 TTS 音檔 (POST) - ** Reverted to Base64 ** """
    print(f"DEBUG: Received analysis+TTS request for work ID: {work_id}")
    if not ai_client: return jsonify({"success": False, "error": "AI 服務未配置。"}), 503

    works_data=load_works_data(); work_data=next((w for w in works_data if w.get('id')==work_id), None)
    if not work_data: return jsonify({"success": False, "error": "找不到作品資料。"}), 404

    s_fname=work_data.get('scorecardFilename'); c_fname=work_data.get('comicFilename')
    if not s_fname or not c_fname: return jsonify({"success": False, "error": "圖片檔名缺失。"}), 400
    s_path = UPLOAD_FOLDER / s_fname; c_path = UPLOAD_FOLDER / c_fname
    if not s_path.is_file() or not c_path.is_file(): return jsonify({"success": False, "error": "找不到圖片檔案。"}), 404

    # --- Encode images using Base64 ---
    print(f"DEBUG: Encoding images for work ID {work_id} using Base64...")
    scorecard_base64 = encode_image_to_base64(s_path)
    comic_base64 = encode_image_to_base64(c_path)
    if not scorecard_base64: return jsonify({"success": False, "error": "處理計分卡圖片失敗。"}), 500
    if not comic_base64: return jsonify({"success": False, "error": "處理漫畫圖片失敗。"}), 500
    # ---------------------------------

    author=work_data.get('author','學生'); habits=work_data.get('currentHabits',''); reflection=work_data.get('reflection','')
    system_prompt = "你是一位友善且有洞察力的學習助教。請務必使用**繁體中文**回覆。"
    user_prompt_text = f"""
    來自 {author} 的習慣養成紀錄：
    習慣描述： {habits}
    反思展望： {reflection}
    這是學生的「習慣計分卡」和「六格漫畫」圖片。請仔細觀察這兩張圖片的內容，並結合上述文字進行分析。

    分析這位學生的習慣養成情況，包含：
    1.  對文字的內容。
    2.  根據你看到的圖片內容，觀察到的亮點或挑戰（例如：計分卡的內容與流程、漫畫描繪的事件或情緒）。
    3.  提出具體、鼓勵性的建議與分析。
    語氣保持正面支持，使用 Markdown 格式。
    """

    analysis_result_text = None; audio_file_url = None; generated_audio_filepath = None

    try:
        print(f"DEBUG: Sending Chat request to OpenAI GPT-4o (with Base64 Data URLs)...")
        # Use Base64 Data URLs
        messages_payload = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": [
                {"type": "text", "text": user_prompt_text},
                {"type": "image_url", "image_url": {"url": scorecard_base64}}, # Use Base64
                {"type": "image_url", "image_url": {"url": comic_base64}}     # Use Base64
            ]}
        ]
        # Debug print structure
        print(f"DEBUG: OpenAI Request Payload (messages):")
        print(f"  [0] Role: {messages_payload[0]['role']}")
        print(f"  [1] Role: {messages_payload[1]['role']}, Content:")
        print(f"      Type: text, Text: {messages_payload[1]['content'][0]['text'][:150]}...")
        print(f"      Type: image_url, URL starts with: {messages_payload[1]['content'][1]['image_url']['url'][:100]}...")
        print(f"      Type: image_url, URL starts with: {messages_payload[1]['content'][2]['image_url']['url'][:100]}...")

        chat_response = ai_client.chat.completions.create(model="gpt-4.1", messages=messages_payload, max_tokens=1000)

        if not chat_response.choices or not chat_response.choices[0].message or not chat_response.choices[0].message.content:
             raise Exception(f"Invalid chat response: {chat_response}")
        analysis_result_text = chat_response.choices[0].message.content.strip(); print(f"DEBUG: Received analysis text.")
    except Exception as e:
        print(f"ERROR: OpenAI Chat API failed: {e}", flush=True)
        if hasattr(e, 'status_code'): print(f"       Status Code: {e.status_code}")
        if hasattr(e, 'response') and hasattr(e.response, 'text'): print(f"       Response Body: {e.response.text[:500]}")
        return jsonify({"success": False, "error": "AI 文字分析錯誤。"}), 500

    # --- Call OpenAI TTS API ---
    if analysis_result_text:
        try:
            print(f"DEBUG: Sending TTS request (tts-1, alloy)...")
            audio_filename = f"{uuid.uuid4()}.mp3"; generated_audio_filepath = AUDIO_CACHE_FOLDER / audio_filename
            tts_response = ai_client.audio.speech.create(model="tts-1", voice="alloy", input=analysis_result_text, response_format="mp3")
            tts_response.stream_to_file(generated_audio_filepath)

            # ** Explicit check after saving **
            if generated_audio_filepath.is_file() and generated_audio_filepath.stat().st_size > 100:
                audio_file_url = f"/audio_cache/{audio_filename}"; print(f"DEBUG: Saved TTS audio: {audio_filename} (Size: {generated_audio_filepath.stat().st_size} bytes)")
            else:
                print(f"ERROR: TTS file not saved correctly or is empty: {generated_audio_filepath}")
                if generated_audio_filepath and generated_audio_filepath.exists(): generated_audio_filepath.unlink(missing_ok=True)
                audio_file_url = None

        except Exception as e:
            print(f"ERROR: OpenAI TTS API failed: {e}", flush=True)
            if generated_audio_filepath and generated_audio_filepath.exists():
                 try: generated_audio_filepath.unlink(missing_ok=True)
                 except OSError: pass
            audio_file_url = None

    return jsonify({"success": True, "analysis": analysis_result_text or "分析文字失敗。", "audioUrl": audio_file_url})

@app.route('/')
def index():
    try: return send_from_directory(BASE_DIR, 'index.html')
    except FileNotFoundError: abort(404)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)