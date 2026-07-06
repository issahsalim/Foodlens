from django.db import models
from django.contrib.auth.models import User

class ShoppingItem(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shopping_items')
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, blank=True, null=True)
    is_bought = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({'Bought' if self.is_bought else 'Pending'})"

    class Meta:
        ordering = ['-created_at']

class DetectionHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='detections')
    food_name = models.CharField(max_length=255)
    image = models.ImageField(upload_to='detections/', null=True, blank=True)
    ingredients = models.JSONField(default=list)
    steps = models.JSONField(default=list)
    nutrition = models.JSONField(default=dict)
    confidence = models.FloatField(default=0.0)
    image_hash = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.food_name}"

class VideoSearchCache(models.Model):
    query = models.CharField(max_length=255, unique=True, db_index=True)
    results = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.query
