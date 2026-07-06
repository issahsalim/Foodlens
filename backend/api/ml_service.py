import os
import google.generativeai as genai
from PIL import Image
import io
import requests
import hashlib
import base64
from transformers import pipeline
from .models import DetectionHistory
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- GEMINI ORCHESTRATOR ---
GEMINI_KEYS = [
    os.getenv("GEMINI_API_KEY"),
    os.getenv("GEMINI_API_KEY_1"),
    os.getenv("GEMINI_API_KEY_2")
]

# Filter out None values
GEMINI_KEYS = [k for k in GEMINI_KEYS if k]

RAPIDAPI_KEYS = [
    os.getenv("RAPIDAPI_KEY"),
    os.getenv("RAPIDAPI_KEY_1"),
    os.getenv("RAPIDAPI_KEY_2")
]
RAPIDAPI_KEYS = [k.strip() for k in RAPIDAPI_KEYS if k]

class GeminiOrchestrator:
    def __init__(self, api_keys, rapidapi_keys=None):
        self.api_keys = api_keys
        self.rapidapi_keys = rapidapi_keys or []
        self.rapidapi_host = "gemini-ai-all-models.p.rapidapi.com"
        # VERIFIED MODELS for this environment:
        self.stable_models = [
            'models/gemini-flash-latest',
            'models/gemini-2.0-flash-001',
            'models/gemini-pro-latest',
            'models/gemini-1.5-flash',
            'models/gemini-1.5-pro'
        ]

    def call_with_failover_v2(self, operation_func, fallback_prompt=None, fallback_image=None):
        """
        Maximum Stability failover: Only uses verified models and rotates keys.
        Falls back to RapidAPI rotation if all direct keys fail.
        """
        last_error = "No attempt made"
        
        print(f"\n🤖 [AI ORCHESTRATOR] Starting request with {len(self.api_keys)} Google Keys...")

        # 1. Try Direct Google API Keys
        for i, key in enumerate(self.api_keys):
            try:
                print(f"🔑 [Google Key {i+1}] ACTIVE")
                genai.configure(api_key=key)
                
                for model_name in self.stable_models:
                    try:
                        result = operation_func(model_name)
                        print(f"✅ [Google Key {i+1}] SUCCESS using {model_name}")
                        return result
                    except Exception as model_e:
                        err_msg = str(model_e).lower()
                        print(f"⚠️ [Google Key {i+1}] FAILED with {model_name}: {err_msg[:50]}...")
                        
                        if "429" in err_msg: # Rate limit
                            print(f"🚫 [Google Key {i+1}] RATE LIMITED. Rotating key...")
                            break # Try next key
                        
                        if "404" in err_msg or "400" in err_msg:
                            continue # Try next model
                        
                        last_error = err_msg
            except Exception as key_e:
                print(f"❌ [Google Key {i+1}] CRITICAL ERROR: {key_e}")
                continue

        # --- 2. RAPIDAPI FALLBACK POOL ---
        if self.rapidapi_keys and fallback_prompt:
            print(f"\n🆘 [FALLBACK] All Google Keys exhausted. Trying {len(self.rapidapi_keys)} RapidAPI Keys...")
            for i, r_key in enumerate(self.rapidapi_keys):
                try:
                    print(f"🔑 [RapidAPI Key {i+1}] ACTIVE (Fallback)")
                    result = self.call_rapidapi(fallback_prompt, fallback_image, r_key)
                    print(f"✅ [RapidAPI Key {i+1}] SUCCESS (Fallback Mode)")
                    return result
                except Exception as rapid_e:
                    print(f"⚠️ [RapidAPI Key {i+1}] FAILED: {str(rapid_e)[:100]}")
                    last_error = f"{last_error} | RapidAPI Key {i+1}: {str(rapid_e)}"
                    continue

        print("💀 [AI ORCHESTRATOR] ALL KEYS FAILED.")
        raise Exception(f"AI Service Error: {last_error}")

    def call_rapidapi(self, prompt, image_bytes=None, api_key=None):
        """Direct REST call to Gemini via RapidAPI wrapper with specific key."""
        url = f"https://{self.rapidapi_host}/gemini-1.5-flash:generateContent"
        headers = {
            "x-rapidapi-key": api_key,
            "x-rapidapi-host": self.rapidapi_host,
            "Content-Type": "application/json"
        }
        
        parts = [{"text": prompt}]
        if image_bytes:
            encoded_image = base64.b64encode(image_bytes).decode('utf-8')
            parts.append({
                "inlineData": {
                    "mimeType": "image/jpeg",
                    "data": encoded_image
                }
            })
        
        payload = {
            "contents": [{"parts": parts}]
        }
        
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        res_json = response.json()
        
        try:
            return res_json['candidates'][0]['content']['parts'][0]['text']
        except (KeyError, IndexError):
            raise Exception(f"RapidAPI Structure Error for Key: {res_json}")

    def call_with_failover(self, method_name, args, fallback_prompt=None):
        def simple_op(model_name):
            model = genai.GenerativeModel(model_name)
            method = getattr(model, method_name)
            response = method(*args) if isinstance(args, list) else method(args)
            return response.text
        
        return self.call_with_failover_v2(simple_op, fallback_prompt=fallback_prompt)

# Initialize the global orchestrator
orchestrator = GeminiOrchestrator(GEMINI_KEYS, rapidapi_keys=RAPIDAPI_KEYS)

HF_TOKEN = os.getenv("HF_TOKEN")
HF_API_URL = "https://api-inference.huggingface.co/models/aspis/swin-finetuned-food101"

def calculate_image_hash(image_bytes):
    """Generates a unique SHA256 fingerprint for an image."""
    return hashlib.sha256(image_bytes).hexdigest()

def check_image_cache(image_bytes):
    """Checks if this exact image has been processed before."""
    img_hash = calculate_image_hash(image_bytes)
    # Look for the most recent detection with this hash
    cached = DetectionHistory.objects.filter(image_hash=img_hash).first()
    
    if cached:
        print(f"🎯 [CACHE HIT] Found existing detection for hash: {img_hash[:10]}...")
        return {
            "food_name": cached.food_name,
            "confidence": cached.confidence,
            "ingredients": cached.ingredients,
            "steps": cached.steps,
            "nutrition": cached.nutrition,
            "cached": True
        }
    return None

# --- LOCAL MODEL LOADER ---
_food_classifier = None

def get_classifier():
    """Lazy-loads the local model only when needed."""
    global _food_classifier
    if _food_classifier is None:
        print("📥 Loading local food classification model (first time might take a minute)...")
        # This will download ~400MB on the first run
        _food_classifier = pipeline("image-classification", model="aspis/swin-finetuned-food101")
    return _food_classifier

def detect_food_local(image_bytes):
    """Identifies food using a local transformer model."""
    try:
        classifier = get_classifier()
        # Convert bytes to PIL Image for the pipeline
        image = Image.open(io.BytesIO(image_bytes))
        
        results = classifier(image)
        if results:
            top_result = results[0]
            food_name = top_result['label'].replace("_", " ")
            return food_name, top_result['score']
            
    except Exception as e:
        print(f"Local Model Error: {e}")
    return None, 0

def detect_food(image_bytes):
    # 1. Check if we've seen this exact image before (Database Cache)
    cached_result = check_image_cache(image_bytes)
    if cached_result:
        return cached_result['food_name'], cached_result['confidence']

    # 2. Try the Local Model first (Privacy & Speed)
    food_name, confidence = detect_food_local(image_bytes)
    
    if food_name and confidence > 0.80:
        print(f"✅ [Local AI] SUCCESS: '{food_name}' ({confidence:.2f})")
        return food_name, confidence
    
    # 3. Fallback to Gemini only if local model is unsure
    print(f"🚀 [Gemini Vision] FALLBACK: Low local confidence ({confidence:.2f})")
    return detect_food_gemini(image_bytes)

def detect_food_gemini(image_bytes):
    try:
        image_part = {"mime_type": "image/jpeg", "data": image_bytes}
        prompt = "Identify the food in this image. Return ONLY the name of the dish. No extra text."
        
        def call_vision(model_name):
            model = genai.GenerativeModel(model_name)
            response = model.generate_content([prompt, image_part])
            return response.text

        response_text = orchestrator.call_with_failover_v2(call_vision, fallback_prompt=prompt, fallback_image=image_bytes)
        return response_text.strip(), 0.99
    except Exception as e:
        print(f"Vision detection failed: {e}")
        return "Unknown Dish", 0.0

def get_recipe_details(food_name):
    prompt = f"""
    You are a professional chef and nutritionist. Provide a recipe and nutritional facts for '{food_name}'.
    You MUST return ONLY a valid JSON object with exactly this structure:
    {{
        "ingredients": ["item 1", "item 2"],
        "steps": ["step 1", "step 2"],
        "nutrition": {{
            "calories": "450 kcal",
            "carbs": "50g",
            "protein": "20g",
            "allergen": "Low",
            "region": "Global"
        }}
    }}
    """
    
    def fetch_recipe(model_name):
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(prompt)
        return response.text

    try:
        response_text = orchestrator.call_with_failover_v2(fetch_recipe, fallback_prompt=prompt)
        import json
        # Clean up markdown code blocks if the AI includes them
        cleaned_text = response_text.strip().replace('```json', '').replace('```', '')
        data = json.loads(cleaned_text)
        return {
            "ingredients": data.get("ingredients", []),
            "steps": data.get("steps", []),
            "nutrition": data.get("nutrition", {})
        }
    except Exception as e:
        print(f"Recipe generation failed: {e}")
        return {
            "ingredients": ["Unable to load ingredients"],
            "steps": ["Chef Salima is temporarily unavailable. Please try again later."],
            "nutrition": { "calories": "-", "carbs": "-", "protein": "-", "allergen": "-", "region": "-" }
        }

def get_shopping_tools(user):
    from .models import ShoppingItem
    
    def list_my_groceries():
        items = ShoppingItem.objects.filter(user=user)
        return "Your list: " + ", ".join([item.name for item in items]) if items.exists() else "List is empty."

    def add_to_my_list(item_name: str):
        ShoppingItem.objects.create(user=user, name=item_name)
        return f"Added {item_name}."

    def remove_from_my_list(item_name: str):
        ShoppingItem.objects.filter(user=user, name__icontains=item_name).delete()
        return f"Removed {item_name}."

    return [list_my_groceries, add_to_my_list, remove_from_my_list]
def get_chat_response(user_query, user, context_food=None, history=[]):
    # Enforce strict food persona
    persona_rules = """
    You are Chef Salima, a world-class culinary expert and nutritionist.
    1. ONLY answer questions related to food, cooking, recipes, ingredients, substitutions, or nutrition.
    2. If a user asks something unrelated (like grammar, math, politics, or general trivia), politely reply: "I am Chef Salima, your culinary assistant. I can only help you with food-related questions. What's on the menu today?"
    3. Use the provided CONTEXT dish to answer questions about 'ingredients' or 'preparation' specifically for that dish.
    """
    context_str = f"\nCONTEXT: The user has currently scanned or is looking at '{context_food}'." if context_food else ""
    system_instruction = f"{persona_rules}\nUser Name: {user.username}.{context_str}\nProvide helpful, professional, and concise answers."
    
    tools = get_shopping_tools(user)
    
    def call_ai(model_name):
        # FIX: Now using the rotated model_name from the orchestrator
        model = genai.GenerativeModel(model_name=model_name, tools=tools, system_instruction=system_instruction)
        chat = model.start_chat(enable_automatic_function_calling=True)
        response = chat.send_message(user_query)
        return response.text

    try:
        # Fallback prompt for chat includes the system instruction
        full_chat_prompt = f"{system_instruction}\n\nUser: {user_query}"
        return orchestrator.call_with_failover_v2(call_ai, fallback_prompt=full_chat_prompt)
    except Exception as e:
        print(f"Chat failed: {e}")
        return "I'm temporarily over capacity. Let's talk in a moment!"
