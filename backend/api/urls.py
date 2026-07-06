from .views import FoodDetectionView, ChatBotView, ShoppingListView, ShoppingItemUpdateView, UserRegistrationView, BulkShoppingItemView, UserProfileUpdateView, VideoSearchView, DetectionHistoryView, DetectionHistoryDeleteView
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
urlpatterns = [
    path('register/', UserRegistrationView.as_view(), name='register'),
    path('login/', TokenObtainPairView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('detect/', FoodDetectionView.as_view(), name='food-detection'),
    path('history/', DetectionHistoryView.as_view(), name='detection-history'),
    path('delete-history/<pk>/', DetectionHistoryDeleteView.as_view(), name='detection-history-delete'),
    path('chat/', ChatBotView.as_view(), name='chatbot'),
    path('profile/update/', UserProfileUpdateView.as_view(), name='profile_update'),
    path('videos/search/', VideoSearchView.as_view(), name='video_search'),
    path('shopping/', ShoppingListView.as_view(), name='shopping-list'),
    path('shopping/bulk/', BulkShoppingItemView.as_view(), name='shopping-bulk'),
    path('shopping/<int:pk>/', ShoppingItemUpdateView.as_view(), name='shopping-item-update'),
]
