from django.shortcuts import render
import os
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .ml_service import detect_food, get_recipe_details, get_chat_response, check_image_cache, calculate_image_hash
from .models import ShoppingItem, DetectionHistory, VideoSearchCache
from .serializers import ShoppingItemSerializer
from django.contrib.auth.models import User
from rest_framework.permissions import AllowAny, IsAuthenticated
import requests

class UserRegistrationView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        email = request.data.get('email')
        
        if not username or not password:
            return Response({"error": "Username and password required"}, status=status.HTTP_400_BAD_REQUEST)
            
        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)
            
        user = User.objects.create_user(username=username, password=password, email=email)
        return Response({"message": "User created successfully"}, status=status.HTTP_201_CREATED)

class FoodDetectionView(APIView):
    def post(self, request):
        if 'image' not in request.FILES:
            return Response({"error": "No image provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            image_file = request.FILES['image']
            image_bytes = image_file.read()
            
            # --- CACHE CHECK ---
            cached_result = check_image_cache(image_bytes)
            if cached_result:
                return Response(cached_result, status=status.HTTP_200_OK)
            # -------------------

            # 1. Detect Food
            food_name, confidence = detect_food(image_bytes)
            
            # 2. Get Recipe and Ingredients
            recipe_data = get_recipe_details(food_name)
            
            # Save to Database if user is authenticated
            image_url = ""
            if request.user.is_authenticated:
                # Need to seek(0) because read() was called
                image_file.seek(0)
                history = DetectionHistory.objects.create(
                    user=request.user,
                    food_name=food_name,
                    image=image_file,
                    ingredients=recipe_data.get("ingredients", []),
                    steps=recipe_data.get("steps", []),
                    nutrition=recipe_data.get("nutrition", {}),
                    confidence=confidence,
                    image_hash=calculate_image_hash(image_bytes) # Save the fingerprint
                )
                if history.image:
                    image_url = request.build_absolute_uri(history.image.url)

            return Response({
                "food_name": food_name,
                "confidence": confidence,
                "ingredients": recipe_data.get("ingredients", []),
                "steps": recipe_data.get("steps", []),
                "nutrition": recipe_data.get("nutrition", {}),
                "image_uri": image_url,
                "cached": False
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DetectionHistoryView(APIView):
    def get(self, request):
        history = DetectionHistory.objects.filter(user=request.user)
        data = []
        for item in history:
            data.append({
                "id": item.id,
                "food_name": item.food_name,
                "confidence": item.confidence,
                "ingredients": item.ingredients,
                "steps": item.steps,
                "nutrition": item.nutrition,
                "image_uri": request.build_absolute_uri(item.image.url) if item.image else "",
                "created_at": item.created_at
            })
        return Response(data, status=status.HTTP_200_OK)


class DetectionHistoryDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        print(f"DEBUG: DELETE request received for ID: {pk} by user: {request.user}")
        try:
            # Ensure pk is an integer
            item_id = int(pk)
            item = DetectionHistory.objects.get(pk=item_id, user=request.user)
            item.delete()
            print(f"DEBUG: Successfully deleted history item {item_id}")
            return Response(status=status.HTTP_204_NO_CONTENT)
        except (ValueError, TypeError):
            print(f"DEBUG: Invalid ID format: {pk}")
            return Response({"error": "Invalid ID format."}, status=status.HTTP_400_BAD_REQUEST)
        except DetectionHistory.DoesNotExist:
            print(f"DEBUG: History item {pk} not found for user {request.user}")
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"DEBUG: Error deleting history: {str(e)}")
            return Response({"error": "Internal server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
class ChatBotView(APIView):
    def post(self, request):
        query = request.data.get('query')
        context_food = request.data.get('context_food') # Extract the dish name
        
        if not query:
            return Response({"error": "No query provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Pass both the query and the dish context
            response_text = get_chat_response(query, request.user, context_food=context_food)
            return Response({"response": response_text}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


from django.contrib.auth import update_session_auth_hash

class UserProfileUpdateView(APIView):
    permission_classes = [IsAuthenticated]
    
    def patch(self, request):
        user = request.user
        username = request.data.get('username')
        email = request.data.get('email')
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        
        if username:
            if User.objects.filter(username=username).exclude(id=user.id).exists():
                return Response({"error": "Username already taken"}, status=status.HTTP_400_BAD_REQUEST)
            user.username = username
        if email:
            user.email = email
            
        if new_password:
            if not old_password:
                return Response({"error": "Current password required"}, status=status.HTTP_400_BAD_REQUEST)
            if not user.check_password(old_password):
                return Response({"error": "Incorrect current password"}, status=status.HTTP_400_BAD_REQUEST)
            user.set_password(new_password)
            update_session_auth_hash(request, user)
            
        user.save()
        return Response({
            "message": "Profile updated",
            "username": user.username,
            "email": user.email
        }, status=status.HTTP_200_OK)




def format_views(count):
    try:
        count = int(count)
        if count >= 1000000:
            return f"{count/1000000:.1f}M"
        if count >= 1000:
            return f"{count/1000:.1f}K"
        return str(count)
    except:
        return "0"

class VideoSearchView(APIView):
    def get(self, request):
        query = request.query_params.get('q', 'cooking recipe')
        
        # --- CACHE CHECK ---
        # Normalize the query for better cache hits (lowercase, stripped)
        normalized_query = query.strip().lower()
        try:
            cached_search = VideoSearchCache.objects.filter(query=normalized_query).first()
            if cached_search and cached_search.results:
                print(f" [VIDEO CACHE HIT] Returning saved videos for '{normalized_query}'...")
                return Response(cached_search.results)
        except Exception as e:
            print(f"⚠️ Cache check failed: {e}")
            
        # Collect all RapidAPI keys for rotation
        rapidapi_keys = [
            os.getenv("RAPIDAPI_KEY"),
            os.getenv("RAPIDAPI_KEY_1"),
            os.getenv("RAPIDAPI_KEY_2")
        ]
        rapidapi_keys = [k.strip() for k in rapidapi_keys if k]
        
        # Fallback to Google YouTube API if needed
        google_api_key = os.getenv("YOUTUBE_API_KEY")
        
        # Hosts to try (including the one requested by user)
        rapidapi_hosts = [
            "youtube-data8.p.rapidapi.com",
            "youtube-v31.p.rapidapi.com"
        ]
        
        last_error = "None"
        
        print(f"\n🎬 [VIDEO SEARCH] Starting search for '{query}'...")
        
        # --- RAPIDAPI KEY & HOST ROTATION LOOP ---
        for host in rapidapi_hosts:
            for i, api_key in enumerate(rapidapi_keys):
                headers = {
                    'x-rapidapi-key': api_key,
                    'x-rapidapi-host': host
                }
                
                try:
                    # 1. Search videos using RapidAPI
                    search_url = f"https://{host}/search/" if host == "youtube-data8.p.rapidapi.com" else f"https://{host}/search"
                    
                    # Add hl and gl parameters as requested by user
                    search_params = {"q": f"{query} recipe tutorial", "hl": "en", "gl": "US"}
                    if host == "youtube-v31.p.rapidapi.com":
                        search_params["part"] = "snippet,id"
                        search_params["maxResults"] = "5"
                    
                    print(f"🔑 [RapidAPI Video] Trying Host: {host} | Key: {i+1}")
                    search_response = requests.get(search_url, headers=headers, params=search_params, timeout=10)
                    
                    if search_response.status_code == 429:
                        print(f"🚫 [RapidAPI] RATE LIMITED (429) for host {host}. Trying next key...")
                        continue
                    
                    if search_response.status_code != 200:
                        print(f"⚠️ [RapidAPI] HTTP ERROR: {search_response.status_code} for host {host}")
                        continue
                        
                    search_data = search_response.json()
                    videos = []
                    
                    # Check for different data structures based on the host
                    items = []
                    if 'contents' in search_data:
                        items = search_data['contents']  # youtube-data8 structure
                    elif 'items' in search_data:
                        items = search_data['items']  # youtube-v31 structure
                    elif 'data' in search_data:
                        items = search_data['data']   # old alternative structure
                    
                    if not items:
                        print(f"❓ [RapidAPI] Success but returned 0 results for host {host}.")
                        continue # Try next host/key instead of failing
                    
                    for item in items[:5]:
                        if 'video' in item:
                            # youtube-data8 structure
                            video_info = item.get('video', {})
                            video_id = video_info.get('videoId')
                            title = video_info.get('title', 'No Title')
                            author_info = video_info.get('author', {})
                            author = author_info.get('title', 'Unknown Chef')
                            stats = video_info.get('stats', {})
                            view_count = stats.get('views', "0")
                            thumbnails = video_info.get('thumbnails', [])
                        elif 'id' in item and isinstance(item['id'], dict):
                            # youtube-v31 structure
                            video_id = item['id'].get('videoId')
                            snippet = item.get('snippet', {})
                            title = snippet.get('title', 'No Title')
                            author = snippet.get('channelTitle', 'Unknown Chef')
                            view_count = "0"
                            thumbnails = snippet.get('thumbnails', {})
                        else:
                            # Old generic structure
                            video_id = item.get('videoId')
                            title = item.get('title', 'No Title')
                            author = item.get('channelTitle', 'Unknown Chef')
                            view_count = "0"
                            thumbnails = item.get('thumbnails', [])

                        if not video_id:
                            continue
                        
                        # 2. Fetch statistics for view count if not available
                        if str(view_count) == "0":
                            try:
                                if host == "youtube-data8.p.rapidapi.com":
                                    details_url = f"https://{host}/video/details/"
                                    details_response = requests.get(details_url, headers=headers, params={"id": video_id}, timeout=10)
                                    if details_response.status_code == 200:
                                        details_data = details_response.json()
                                        if 'stats' in details_data:
                                            view_count = details_data['stats'].get('views', "0")
                                elif host == "youtube-v31.p.rapidapi.com":
                                    details_url = f"https://{host}/videos"
                                    details_response = requests.get(details_url, headers=headers, params={"part": "statistics", "id": video_id}, timeout=10)
                                    if details_response.status_code == 200:
                                        details_data = details_response.json()
                                        if 'items' in details_data and len(details_data['items']) > 0:
                                            view_count = details_data['items'][0].get('statistics', {}).get('viewCount', "0")
                            except Exception as e:
                                print(f"Error fetching stats for {video_id}: {e}")
                        
                        # Thumbnail Logic
                        thumb_url = ""
                        if isinstance(thumbnails, list) and len(thumbnails) > 0:
                            high_thumb = next((t['url'] for t in thumbnails if t.get('id') == 'high' or t.get('height', 0) > 300), None)
                            medium_thumb = next((t['url'] for t in thumbnails if t.get('id') == 'medium' or t.get('height', 0) > 100), None)
                            thumb_url = high_thumb or medium_thumb or thumbnails[0].get('url', "")
                        elif isinstance(thumbnails, dict):
                            thumb_url = thumbnails.get('high', {}).get('url') or thumbnails.get('medium', {}).get('url') or thumbnails.get('default', {}).get('url') or ""
                        
                        videos.append({
                            "id": video_id,
                            "title": title,
                            "author": author,
                            "thumbnail": thumb_url,
                            "views": f"{format_views(view_count)} views"
                        })
                    
                    if videos:
                        print(f"✅ [RapidAPI] SUCCESS: Found {len(videos)} videos.")
                        
                        # --- SAVE TO CACHE ---
                        try:
                            VideoSearchCache.objects.update_or_create(
                                query=normalized_query,
                                defaults={'results': videos}
                            )
                            print(f"💾 [VIDEO CACHE] Saved {len(videos)} videos for '{normalized_query}'")
                        except Exception as e:
                            print(f"⚠️ Failed to save to cache: {e}")
                            
                        return Response(videos)
                    
                except Exception as e:
                    print(f"❌ [RapidAPI] ERROR with host {host}: {str(e)}")
                    last_error = str(e)
                    continue # Try next key/host

        # --- GOOGLE API FALLBACK ---
        if google_api_key and google_api_key.strip():
            print("🔄 [VIDEO SEARCH] Falling back to official Google YouTube API...")
            try:
                search_url = "https://www.googleapis.com/youtube/v3/search"
                search_params = {
                    "part": "snippet",
                    "q": f"{query} recipe tutorial",
                    "type": "video",
                    "maxResults": 5,
                    "key": google_api_key.strip()
                }
                response = requests.get(search_url, params=search_params, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    videos = []
                    
                    for item in data.get("items", []):
                        video_id = item["id"]["videoId"]
                        snippet = item["snippet"]
                        
                        # Fetch view count
                        view_count = "0"
                        stats_url = "https://www.googleapis.com/youtube/v3/videos"
                        stats_params = {"part": "statistics", "id": video_id, "key": google_api_key.strip()}
                        stats_response = requests.get(stats_url, params=stats_params, timeout=10)
                        if stats_response.status_code == 200:
                            stats_data = stats_response.json()
                            if stats_data.get("items"):
                                view_count = stats_data["items"][0]["statistics"].get("viewCount", "0")
                                
                        videos.append({
                            "id": video_id,
                            "title": snippet["title"],
                            "author": snippet["channelTitle"],
                            "thumbnail": snippet["thumbnails"]["high"]["url"] if "high" in snippet["thumbnails"] else snippet["thumbnails"]["default"]["url"],
                            "views": f"{format_views(view_count)} views"
                        })
                    
                    if videos:
                        print(f"✅ [Google API] SUCCESS: Found {len(videos)} videos.")
                        
                        # --- SAVE TO CACHE ---
                        try:
                            VideoSearchCache.objects.update_or_create(
                                query=normalized_query,
                                defaults={'results': videos}
                            )
                            print(f"💾 [VIDEO CACHE] Saved {len(videos)} videos for '{normalized_query}'")
                        except Exception as e:
                            print(f"⚠️ Failed to save to cache: {e}")
                            
                        return Response(videos)
            except Exception as e:
                print(f"❌ [Google API] ERROR: {str(e)}")
                last_error = f"Google API also failed: {str(e)}"

        print("💀 [VIDEO SEARCH] ALL APIs FAILED.")
        return Response({"error": f"All video search APIs failed. Last error: {last_error}"}, status=500)


class ShoppingListView(APIView):
    def get(self, request):
        items = ShoppingItem.objects.filter(user=request.user)
        serializer = ShoppingItemSerializer(items, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = ShoppingItemSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request):
        item_id = request.query_params.get('id')
        if item_id:
            try:
                item = ShoppingItem.objects.get(id=item_id, user=request.user)
                item.delete()
                return Response(status=status.HTTP_204_NO_CONTENT)
            except ShoppingItem.DoesNotExist:
                return Response({"error": "Item not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)
        
        ShoppingItem.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BulkShoppingItemView(APIView):
    def post(self, request):
        ingredients = request.data.get('ingredients', [])
        if not ingredients:
            return Response({"error": "No ingredients provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        items_to_create = [
            ShoppingItem(user=request.user, name=name) 
            for name in ingredients
        ]
        ShoppingItem.objects.bulk_create(items_to_create)
        
        return Response({"message": f"Successfully added {len(ingredients)} items to your list"}, status=status.HTTP_201_CREATED)

class ShoppingItemUpdateView(APIView):
    def patch(self, request, pk):
        try:
            item = ShoppingItem.objects.get(pk=pk)
            serializer = ShoppingItemSerializer(item, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except ShoppingItem.DoesNotExist:
            return Response({"error": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

