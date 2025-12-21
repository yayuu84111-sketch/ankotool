const { getShopItems, updateShopItems } = require('../storage/fileStorage');
const { getUserBalance, subtractBalance, addItemToInventory, getInventory } = require('./ankoDollar');

async function purchaseItem(userId, itemId) {
  const items = await getShopItems();
  const item = items[itemId];
  
  if (!item) {
    return { success: false, error: 'item_not_found' };
  }
  
  const balance = await getUserBalance(userId);
  
  if (balance < item.price) {
    return { 
      success: false, 
      error: 'insufficient_funds', 
      balance,
      required: item.price 
    };
  }
  
  const result = await subtractBalance(userId, item.price);
  if (!result.success) {
    return result;
  }
  
  await addItemToInventory(userId, itemId);
  
  return {
    success: true,
    item,
    newBalance: result.balance
  };
}

async function addShopItem(itemId, name, price, description, emoji, visible = true) {
  const items = await getShopItems();
  items[itemId] = {
    name,
    price,
    description,
    emoji,
    visible
  };
  await updateShopItems(items);
  return { success: true };
}

async function removeShopItem(itemId) {
  const items = await getShopItems();
  if (!items[itemId]) {
    return { success: false, error: 'item_not_found' };
  }
  delete items[itemId];
  await updateShopItems(items);
  return { success: true };
}

async function updateShopItem(itemId, updates) {
  const items = await getShopItems();
  if (!items[itemId]) {
    return { success: false, error: 'item_not_found' };
  }
  items[itemId] = { ...items[itemId], ...updates };
  await updateShopItems(items);
  return { success: true };
}

module.exports = {
  purchaseItem,
  addShopItem,
  removeShopItem,
  updateShopItem
};
