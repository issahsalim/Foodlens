import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { API_BASE_URL } from '../config';

export default function ShoppingListScreen() {
  const [items, setItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const isGuest = await SecureStore.getItemAsync('is_guest');
    
    if (isGuest === 'true') {
      try {
        const localData = await SecureStore.getItemAsync('guest_shopping_list');
        if (localData) setItems(JSON.parse(localData));
      } catch (e) {
        console.error("Error loading local list", e);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const token = await SecureStore.getItemAsync('access_token');
    try {
      const response = await fetch(`${API_BASE_URL}/shopping/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setItems(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const addItem = async () => {
    if (!newItemName.trim()) return;
    setIsAdding(true);

    const isGuest = await SecureStore.getItemAsync('is_guest');
    if (isGuest === 'true') {
      const newItem = { id: Date.now(), name: newItemName, is_bought: false };
      const updatedItems = [newItem, ...items];
      setItems(updatedItems);
      await SecureStore.setItemAsync('guest_shopping_list', JSON.stringify(updatedItems));
      setNewItemName('');
      setIsAdding(false);
      return;
    }

    const token = await SecureStore.getItemAsync('access_token');
    try {
      const response = await fetch(`${API_BASE_URL}/shopping/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newItemName })
      });
      const data = await response.json();
      if (response.ok) {
        setItems(prev => [data, ...prev]);
        setNewItemName('');
      }
    } catch (error) {
      Alert.alert("Error", "Could not add item.");
    } finally {
      setIsAdding(false);
    }
  };

  const toggleBought = async (item) => {
    const isGuest = await SecureStore.getItemAsync('is_guest');
    
    if (isGuest === 'true') {
      const updatedItems = items.map(i => i.id === item.id ? { ...i, is_bought: !i.is_bought } : i);
      setItems(updatedItems);
      await SecureStore.setItemAsync('guest_shopping_list', JSON.stringify(updatedItems));
      return;
    }

    const token = await SecureStore.getItemAsync('access_token');
    try {
      const response = await fetch(`${API_BASE_URL}/shopping/${item.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_bought: !item.is_bought })
      });
      if (response.ok) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_bought: !i.is_bought } : i));
      }
    } catch (error) {
      Alert.alert("Error", "Could not update item.");
    }
  };

  const deleteItem = (id) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to remove this item?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            const isGuest = await SecureStore.getItemAsync('is_guest');
            if (isGuest === 'true') {
              const updatedItems = items.filter(i => i.id !== id);
              setItems(updatedItems);
              await SecureStore.setItemAsync('guest_shopping_list', JSON.stringify(updatedItems));
              return;
            }

            const token = await SecureStore.getItemAsync('access_token');
            try {
              const response = await fetch(`${API_BASE_URL}/shopping/?id=${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (response.ok) {
                setItems(prev => prev.filter(i => i.id !== id));
              }
            } catch (error) {
              Alert.alert("Error", "Could not delete item.");
            }
          } 
        }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.itemCard}>
      <TouchableOpacity 
        style={styles.itemContent} 
        onPress={() => toggleBought(item)}
      >
        <MaterialCommunityIcons 
          name={item.is_bought ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"} 
          size={28} 
          color={item.is_bought ? "#4CD964" : "#FF9500"} 
        />
        <Text style={[styles.itemName, item.is_bought && styles.itemBoughtText]}>
          {item.name}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => deleteItem(item.id)}>
        <MaterialCommunityIcons name="trash-can-outline" size={24} color="#FF3B30" />
      </TouchableOpacity>
    </View>
  );


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Groceries</Text>
        <TouchableOpacity onPress={fetchItems}>
          <MaterialCommunityIcons name="refresh" size={28} color="#FF9500" />
        </TouchableOpacity>
      </View>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Add item manually..."
          placeholderTextColor="#888"
          value={newItemName}
          onChangeText={setNewItemName}
          onSubmitEditing={addItem}
        />
        <TouchableOpacity style={styles.addButton} onPress={addItem} disabled={isAdding}>
          {isAdding ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <MaterialCommunityIcons name="plus" size={28} color="white" />
          )}
        </TouchableOpacity>
      </View>


      {isLoading ? (
        <ActivityIndicator size="large" color="#FF9500" style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="cart-outline" size={80} color="#333" />
              <Text style={styles.emptyText}>Your list is empty!</Text>
              <Text style={styles.emptySubtext}>Add ingredients from a recipe or ask the assistant.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    color: '#FF9500',
    fontSize: 22,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 20,
  },
  inputBar: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  input: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
    color: 'white',
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#FF9500',
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 15,
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemName: {
    color: '#eee',
    fontSize: 18,
    marginLeft: 15,
  },
  itemBoughtText: {
    textDecorationLine: 'line-through',
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: '#eee',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 40,
  },
});
