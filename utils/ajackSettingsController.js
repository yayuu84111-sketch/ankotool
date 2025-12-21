const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  PermissionFlagsBits
} = require('discord.js');
const { getAjackSettings, updateAjackSettings, getShopItems, updateShopItems } = require('../storage/fileStorage');
const { addShopItem, removeShopItem, updateShopItem } = require('./shop');
const { adminGiveMoney } = require('./ankoDollar');

async function checkAdminPermission(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ このコマンドを使用する権限がありません。（管理者権限が必要）',
      ephemeral: true
    });
    return false;
  }
  return true;
}

async function createSettingsPanel(guildId) {
  const settings = await getAjackSettings(guildId);
  
  const gachaItems = settings.gachaItems || [];
  const gachaStatus = gachaItems.length > 0 ? `設定済み (${gachaItems.length}個のアイテム, ${settings.gachaPrice || 500}あんこドル)` : '未設定';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ あんこジャック設定パネル')
    .setColor(0x5865F2)
    .setDescription('**ゲーム設定を管理します**')
    .addFields(
      { name: '💼 働く報酬', value: `${settings.workRewardMin} - ${settings.workRewardMax} あんこドル`, inline: true },
      { name: '⏰ 働くクールダウン', value: `${Math.floor(settings.workCooldown / 60000)} 分`, inline: true },
      { name: '🎁 デイリー報酬', value: `${settings.dailyBonus || 100} あんこドル`, inline: true },
      { name: '🎭 購入可能ロール', value: settings.purchaseRoleId ? `<@&${settings.purchaseRoleId}>` : '未設定', inline: true },
      { name: '💎 ロール価格', value: `${settings.rolePrice} あんこドル`, inline: true },
      { name: '🎰 ガチャ', value: gachaStatus, inline: true },
      { name: '💬 雑談報酬', value: settings.chatRewardEnabled ? `${settings.chatRewardMin}-${settings.chatRewardMax} (${Math.floor(settings.chatRewardCooldown / 1000)}秒)` : '無効', inline: true },
      { name: '🔒 使用制限チャンネル', value: settings.allowedChannelId ? `<#${settings.allowedChannelId}>` : '制限なし', inline: true },
      { name: '🎴 ブラックジャック倍率', value: `通常: ${settings.regularMultiplier || 1.5}倍、大勝負: ${settings.allInMultiplier || 2.5}倍`, inline: true },
      { name: '💰 盗み設定', value: `成功率: ${settings.stealSuccessRate}%、盗める割合: ${settings.stealPercentage}%\n失敗罰金: ${settings.stealFailurePenalty} あんこドル、クールダウン: ${Math.floor(settings.stealCooldown / 60000)} 分`, inline: false }
    )
    .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ajack_setting_work')
        .setLabel('💼 働く設定')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ajack_setting_daily')
        .setLabel('🎁 デイリー設定')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ajack_setting_shop')
        .setLabel('🛒 ショップ管理')
        .setStyle(ButtonStyle.Primary)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ajack_setting_gacha')
        .setLabel('🎰 ガチャ管理')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ajack_setting_item_add')
        .setLabel('➕ アイテム追加')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('ajack_setting_role')
        .setLabel('🎭 ロール設定')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ajack_setting_channel')
        .setLabel('🔒 チャンネル制限')
        .setStyle(ButtonStyle.Secondary)
    );

  const row2_5 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ajack_setting_chat')
        .setLabel('💬 雑談報酬設定')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ajack_setting_multiplier')
        .setLabel('🎴 倍率設定')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ajack_shop_toggle_visibility')
        .setLabel('👁️ アイテム公開/非公開')
        .setStyle(ButtonStyle.Secondary)
    );

  const row3 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ajack_setting_steal')
        .setLabel('💰 盗み設定')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('ajack_setting_admin_give')
        .setLabel('💸 管理者送金')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('ajack_setting_broadcast_dm')
        .setLabel('📢 全員にDM')
        .setStyle(ButtonStyle.Primary)
    );

  const row4 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ajack_setting_admin_fine')
        .setLabel('⚠️ 罰金')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('ajack_setting_public_button')
        .setLabel('🎁 公開ボタン作成')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('ajack_setting_item_list')
        .setLabel('📋 アイテムID一覧')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ajack_setting_check_balance')
        .setLabel('💰 残高確認')
        .setStyle(ButtonStyle.Primary)
    );

  return {
    embeds: [embed],
    components: [row1, row2, row2_5, row3, row4]
  };
}

async function handleWorkSettings(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ajack_work_modal')
    .setTitle('働く機能の設定');

  const settings = await getAjackSettings(interaction.guild.id);

  const minInput = new TextInputBuilder()
    .setCustomId('work_min')
    .setLabel('最小報酬額（あんこドル）')
    .setStyle(TextInputStyle.Short)
    .setValue(String(settings.workRewardMin))
    .setRequired(true);

  const maxInput = new TextInputBuilder()
    .setCustomId('work_max')
    .setLabel('最大報酬額（あんこドル）')
    .setStyle(TextInputStyle.Short)
    .setValue(String(settings.workRewardMax))
    .setRequired(true);

  const cooldownInput = new TextInputBuilder()
    .setCustomId('work_cooldown')
    .setLabel('クールダウン（分）')
    .setStyle(TextInputStyle.Short)
    .setValue(String(Math.floor(settings.workCooldown / 60000)))
    .setRequired(true);

  const row1 = new ActionRowBuilder().addComponents(minInput);
  const row2 = new ActionRowBuilder().addComponents(maxInput);
  const row3 = new ActionRowBuilder().addComponents(cooldownInput);

  modal.addComponents(row1, row2, row3);

  await interaction.showModal(modal);
}

async function handleWorkModal(interaction) {
  const min = parseInt(interaction.fields.getTextInputValue('work_min'));
  const max = parseInt(interaction.fields.getTextInputValue('work_max'));
  const cooldown = parseInt(interaction.fields.getTextInputValue('work_cooldown')) * 60000;

  if (isNaN(min) || isNaN(max) || isNaN(cooldown) || min > max || min < 0 || cooldown < 0) {
    return interaction.reply({
      content: '❌ 無効な値が入力されました。正しい数値を入力してください。',
      ephemeral: true
    });
  }

  await updateAjackSettings(interaction.guild.id, {
    workRewardMin: min,
    workRewardMax: max,
    workCooldown: cooldown
  });

  const embed = new EmbedBuilder()
    .setTitle('✅ 設定を更新しました')
    .setColor(0x00FF00)
    .addFields(
      { name: '💼 働く報酬', value: `${min} - ${max} あんこドル`, inline: true },
      { name: '⏰ クールダウン', value: `${Math.floor(cooldown / 60000)} 分`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleShopManagement(interaction) {
  const items = await getShopItems();

  const embed = new EmbedBuilder()
    .setTitle('🛒 ショップ管理')
    .setColor(0xFFD700)
    .setDescription('**ショップアイテムを管理します**')
    .setTimestamp();

  const itemList = Object.entries(items).map(([id, item]) => {
    const visibilityStatus = item.visible === false ? '🔒 非公開' : '✅ 公開中';
    return { name: `${item.emoji} ${item.name} (ID: ${id})`, value: `価格: ${item.price} あんこドル | ${visibilityStatus}`, inline: true };
  });

  if (itemList.length > 0) {
    embed.addFields(itemList);
  } else {
    embed.setDescription('現在アイテムはありません。');
  }

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ajack_shop_add')
        .setLabel('➕ アイテム追加')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('ajack_shop_remove')
        .setLabel('➖ アイテム削除')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('ajack_shop_toggle_visibility')
        .setLabel('👁️ 公開/非公開切替')
        .setStyle(ButtonStyle.Primary)
    );

  await interaction.reply({
    embeds: [embed],
    components: [row1],
    ephemeral: true
  });
}

async function handleAddItem(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ajack_add_item_modal')
    .setTitle('アイテムを追加');

  const idInput = new TextInputBuilder()
    .setCustomId('item_id')
    .setLabel('アイテムID（英数字のみ、例：health_potion）')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const nameInput = new TextInputBuilder()
    .setCustomId('item_name')
    .setLabel('アイテム名')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const priceInput = new TextInputBuilder()
    .setCustomId('item_price')
    .setLabel('価格（あんこドル）※任意')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const descInput = new TextInputBuilder()
    .setCustomId('item_desc')
    .setLabel('説明')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const emojiInput = new TextInputBuilder()
    .setCustomId('item_emoji')
    .setLabel('絵文字（例：🎁）')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(idInput),
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(priceInput),
    new ActionRowBuilder().addComponents(descInput),
    new ActionRowBuilder().addComponents(emojiInput)
  );

  await interaction.showModal(modal);
}

async function handleAddItemModal(interaction) {
  const id = interaction.fields.getTextInputValue('item_id').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const name = interaction.fields.getTextInputValue('item_name');
  const priceInput = interaction.fields.getTextInputValue('item_price');
  const price = priceInput ? parseInt(priceInput) : 0;
  const description = interaction.fields.getTextInputValue('item_desc');
  const emoji = interaction.fields.getTextInputValue('item_emoji');

  if (priceInput && (isNaN(price) || price < 0)) {
    return interaction.reply({
      content: '❌ 無効な価格です。正の整数を入力してください。',
      ephemeral: true
    });
  }

  const items = await getShopItems();
  const existingItemWithSameName = Object.values(items).find(item => item.name === name);
  
  if (existingItemWithSameName) {
    return interaction.reply({
      content: `❌ 同じ名前のアイテムが既に存在します。\nアイテム名: **${name}**\n別の名前を使用してください。`,
      ephemeral: true
    });
  }

  await addShopItem(id, name, price, description, emoji, false);

  const embed = new EmbedBuilder()
    .setTitle('✅ アイテムを作成しました')
    .setColor(0x00FF00)
    .addFields(
      { name: 'ID', value: id, inline: true },
      { name: '名前', value: `${emoji} ${name}`, inline: true },
      { name: '価格', value: price > 0 ? `${price} あんこドル` : '未設定', inline: true },
      { name: '説明', value: description, inline: false }
    )
    .setDescription('※このアイテムは非公開として保存されました。\nショップに公開する場合は、ショップ管理から公開設定を変更してください。')
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleRemoveItem(interaction) {
  const items = await getShopItems();
  const options = Object.entries(items).map(([id, item]) => ({
    label: item.name,
    value: id,
    description: `${item.price} あんこドル`,
    emoji: item.emoji
  }));

  if (options.length === 0) {
    return interaction.reply({
      content: '❌ 削除するアイテムがありません。',
      ephemeral: true
    });
  }

  const row = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ajack_shop_remove_select')
        .setPlaceholder('削除するアイテムを選択')
        .addOptions(options)
    );

  await interaction.reply({
    content: '削除するアイテムを選択してください：',
    components: [row],
    ephemeral: true
  });
}

async function handleRemoveItemSelect(interaction) {
  const itemId = interaction.values[0];
  
  await removeShopItem(itemId);

  await interaction.update({
    content: `✅ アイテム「${itemId}」を削除しました。`,
    components: []
  });
}

async function handleRoleSettings(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ajack_role_modal')
    .setTitle('ロール購入設定');

  const settings = await getAjackSettings(interaction.guild.id);

  const roleIdInput = new TextInputBuilder()
    .setCustomId('role_id')
    .setLabel('ロールID（購入可能にするロールのID）')
    .setStyle(TextInputStyle.Short)
    .setValue(settings.purchaseRoleId || '')
    .setPlaceholder('例: 123456789012345678')
    .setRequired(false);

  const rolePriceInput = new TextInputBuilder()
    .setCustomId('role_price')
    .setLabel('ロール価格（あんこドル）')
    .setStyle(TextInputStyle.Short)
    .setValue(String(settings.rolePrice))
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(roleIdInput),
    new ActionRowBuilder().addComponents(rolePriceInput)
  );

  await interaction.showModal(modal);
}

async function handleRoleModal(interaction) {
  const roleId = interaction.fields.getTextInputValue('role_id').trim();
  const price = parseInt(interaction.fields.getTextInputValue('role_price'));

  if (roleId && !/^\d{17,20}$/.test(roleId)) {
    return interaction.reply({
      content: '❌ 無効なロールIDです。ロールIDは17-20桁の数字である必要があります。',
      ephemeral: true
    });
  }

  if (isNaN(price) || price < 0) {
    return interaction.reply({
      content: '❌ 無効な価格です。正の整数を入力してください。',
      ephemeral: true
    });
  }

  await updateAjackSettings(interaction.guild.id, {
    purchaseRoleId: roleId || null,
    rolePrice: price
  });

  const embed = new EmbedBuilder()
    .setTitle('✅ ロール設定を更新しました')
    .setColor(0x00FF00)
    .addFields(
      { name: '🎭 購入可能ロール', value: roleId ? `<@&${roleId}>` : '未設定', inline: true },
      { name: '💎 ロール価格', value: `${price} あんこドル`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleChatSettings(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ajack_chat_modal')
    .setTitle('雑談報酬設定');

  const settings = await getAjackSettings(interaction.guild.id);

  const minInput = new TextInputBuilder()
    .setCustomId('chat_min')
    .setLabel('最小報酬額（あんこドル）')
    .setStyle(TextInputStyle.Short)
    .setValue(String(settings.chatRewardMin))
    .setRequired(true);

  const maxInput = new TextInputBuilder()
    .setCustomId('chat_max')
    .setLabel('最大報酬額（あんこドル）')
    .setStyle(TextInputStyle.Short)
    .setValue(String(settings.chatRewardMax))
    .setRequired(true);

  const cooldownInput = new TextInputBuilder()
    .setCustomId('chat_cooldown')
    .setLabel('クールダウン（秒）')
    .setStyle(TextInputStyle.Short)
    .setValue(String(Math.floor(settings.chatRewardCooldown / 1000)))
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(minInput),
    new ActionRowBuilder().addComponents(maxInput),
    new ActionRowBuilder().addComponents(cooldownInput)
  );

  await interaction.showModal(modal);
}

async function handleChatModal(interaction) {
  const min = parseInt(interaction.fields.getTextInputValue('chat_min'));
  const max = parseInt(interaction.fields.getTextInputValue('chat_max'));
  const cooldown = parseInt(interaction.fields.getTextInputValue('chat_cooldown')) * 1000;

  if (isNaN(min) || isNaN(max) || isNaN(cooldown) || min > max || min < 0 || cooldown < 0) {
    return interaction.reply({
      content: '❌ 無効な値が入力されました。正しい数値を入力してください。',
      ephemeral: true
    });
  }

  await updateAjackSettings(interaction.guild.id, {
    chatRewardMin: min,
    chatRewardMax: max,
    chatRewardCooldown: cooldown
  });

  const embed = new EmbedBuilder()
    .setTitle('✅ 雑談報酬設定を更新しました')
    .setColor(0x00FF00)
    .addFields(
      { name: '💬 雑談報酬', value: `${min} - ${max} あんこドル`, inline: true },
      { name: '⏰ クールダウン', value: `${Math.floor(cooldown / 1000)} 秒`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleChatToggle(interaction) {
  const settings = await getAjackSettings(interaction.guild.id);
  const newValue = !settings.chatRewardEnabled;

  await updateAjackSettings(interaction.guild.id, {
    chatRewardEnabled: newValue
  });

  await interaction.reply({
    content: `✅ 雑談報酬を${newValue ? '有効' : '無効'}にしました。`,
    ephemeral: true
  });
}

async function handleStealSettings(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ajack_steal_modal')
    .setTitle('盗み機能設定');

  const settings = await getAjackSettings(interaction.guild.id);

  const successRateInput = new TextInputBuilder()
    .setCustomId('steal_success_rate')
    .setLabel('成功確率（%、0-100）')
    .setStyle(TextInputStyle.Short)
    .setValue(String(settings.stealSuccessRate))
    .setRequired(true);

  const percentageInput = new TextInputBuilder()
    .setCustomId('steal_percentage')
    .setLabel('盗める割合（%、0-100）')
    .setStyle(TextInputStyle.Short)
    .setValue(String(settings.stealPercentage))
    .setRequired(true);

  const penaltyInput = new TextInputBuilder()
    .setCustomId('steal_penalty')
    .setLabel('失敗時の罰金（あんこドル）')
    .setStyle(TextInputStyle.Short)
    .setValue(String(settings.stealFailurePenalty))
    .setRequired(true);

  const cooldownInput = new TextInputBuilder()
    .setCustomId('steal_cooldown')
    .setLabel('クールダウン（分）')
    .setStyle(TextInputStyle.Short)
    .setValue(String(Math.floor(settings.stealCooldown / 60000)))
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(successRateInput),
    new ActionRowBuilder().addComponents(percentageInput),
    new ActionRowBuilder().addComponents(penaltyInput),
    new ActionRowBuilder().addComponents(cooldownInput)
  );

  await interaction.showModal(modal);
}

async function handleStealModal(interaction) {
  const successRate = parseInt(interaction.fields.getTextInputValue('steal_success_rate'));
  const percentage = parseInt(interaction.fields.getTextInputValue('steal_percentage'));
  const penalty = parseInt(interaction.fields.getTextInputValue('steal_penalty'));
  const cooldown = parseInt(interaction.fields.getTextInputValue('steal_cooldown')) * 60000;

  if (isNaN(successRate) || isNaN(percentage) || isNaN(penalty) || isNaN(cooldown) ||
      successRate < 0 || successRate > 100 || percentage < 0 || percentage > 100 ||
      penalty < 0 || cooldown < 0) {
    return interaction.reply({
      content: '❌ 無効な値が入力されました。正しい数値を入力してください。',
      ephemeral: true
    });
  }

  await updateAjackSettings(interaction.guild.id, {
    stealSuccessRate: successRate,
    stealPercentage: percentage,
    stealFailurePenalty: penalty,
    stealCooldown: cooldown
  });

  const embed = new EmbedBuilder()
    .setTitle('✅ 盗み設定を更新しました')
    .setColor(0x00FF00)
    .addFields(
      { name: '📊 成功率', value: `${successRate}%`, inline: true },
      { name: '💵 盗める割合', value: `${percentage}%`, inline: true },
      { name: '💸 失敗時の罰金', value: `${penalty} あんこドル`, inline: true },
      { name: '⏰ クールダウン', value: `${Math.floor(cooldown / 60000)} 分`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAdminGive(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('💸 管理者送金')
    .setColor(0xFFD700)
    .setDescription('**ユーザーにあんこドルを送金します**\n\n無限に生成できます。')
    .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(
      new UserSelectMenuBuilder()
        .setCustomId('ajack_admin_give_select')
        .setPlaceholder('送金先を選択')
        .setMaxValues(1)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ajack_admin_give_all')
        .setLabel('💰 全員に送金')
        .setStyle(ButtonStyle.Success)
    );

  await interaction.reply({
    embeds: [embed],
    components: [row1, row2],
    ephemeral: true
  });
}

async function handleAdminGiveAll(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ajack_admin_give_modal:all')
    .setTitle('全員に送金');

  const amountInput = new TextInputBuilder()
    .setCustomId('give_amount')
    .setLabel('送金額（あんこドル）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 1000')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(amountInput));

  await interaction.showModal(modal);
}

async function handleAdminGiveSelect(interaction) {
  const targetId = interaction.values[0];

  const modal = new ModalBuilder()
    .setCustomId(`ajack_admin_give_modal:${targetId}`)
    .setTitle('管理者送金');

  const amountInput = new TextInputBuilder()
    .setCustomId('give_amount')
    .setLabel('送金額（あんこドル）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 10000')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(amountInput));

  await interaction.showModal(modal);
}

async function handleAdminGiveModal(interaction) {
  const targetId = interaction.customId.split(':')[1];
  const amount = parseInt(interaction.fields.getTextInputValue('give_amount'));

  if (isNaN(amount) || amount <= 0) {
    return interaction.reply({
      content: '❌ 無効な金額です。正の整数を入力してください。',
      ephemeral: true
    });
  }

  if (targetId === 'all') {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const members = await interaction.guild.members.fetch();
      const nonBotMembers = members.filter(member => !member.user.bot);
      
      let successCount = 0;
      for (const [userId] of nonBotMembers) {
        const result = await adminGiveMoney(userId, amount);
        if (result.success) {
          successCount++;
          try {
            const member = await interaction.guild.members.fetch(userId);
            if (member) {
              await member.send(`💰 管理者があなたに **${amount}** あんこドルを送金しました！`).catch(() => {});
            }
          } catch (error) {
          }
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ 全員への送金完了')
        .setColor(0x00FF00)
        .setDescription(`サーバー内の全メンバー（Bot除く）に **${amount}** あんこドルを送金しました。`)
        .addFields(
          { name: '📊 送金結果', value: `${successCount} / ${nonBotMembers.size} 人に送金完了`, inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('全員送金エラー:', error);
      await interaction.editReply({
        content: '❌ 全員への送金処理中にエラーが発生しました。'
      });
    }
    return;
  }

  const result = await adminGiveMoney(targetId, amount);

  if (!result.success) {
    return interaction.reply({
      content: '❌ 送金に失敗しました。',
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ 送金完了')
    .setColor(0x00FF00)
    .setDescription(`**<@${targetId}>** に **${amount}** あんこドルを送金しました。`)
    .addFields(
      { name: '💰 相手の新しい残高', value: `${result.balance} あんこドル`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });

  try {
    const targetUser = await interaction.guild.members.fetch(targetId);
    if (targetUser) {
      await targetUser.send(`💰 管理者があなたに **${amount}** あんこドルを送金しました！`).catch(() => {});
    }
  } catch (error) {
  }
}

async function handleAdminFine(interaction) {
  if (!(await checkAdminPermission(interaction))) return;

  const embed = new EmbedBuilder()
    .setTitle('⚠️ 管理者罰金')
    .setColor(0xFF0000)
    .setDescription('**ユーザーから罰金を徴収します**\n\n指定した金額を差し引きます。')
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new UserSelectMenuBuilder()
        .setCustomId('ajack_admin_fine_select')
        .setPlaceholder('罰金対象を選択')
        .setMaxValues(1)
    );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true
  });
}

async function handleAdminFineSelect(interaction) {
  if (!(await checkAdminPermission(interaction))) return;

  const targetId = interaction.values[0];

  const modal = new ModalBuilder()
    .setCustomId(`ajack_admin_fine_modal:${targetId}`)
    .setTitle('管理者罰金');

  const amountInput = new TextInputBuilder()
    .setCustomId('fine_amount')
    .setLabel('罰金額（あんこドル）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 500')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(amountInput));

  await interaction.showModal(modal);
}

async function handleAdminFineModal(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ このコマンドを使用する権限がありません。（管理者権限が必要）',
      ephemeral: true
    });
  }

  const targetId = interaction.customId.split(':')[1];
  const amount = parseInt(interaction.fields.getTextInputValue('fine_amount'));

  if (isNaN(amount) || amount <= 0) {
    return interaction.reply({
      content: '❌ 無効な金額です。正の整数を入力してください。',
      ephemeral: true
    });
  }

  const { forceFine } = require('./ankoDollar');
  const result = await forceFine(targetId, amount);

  if (!result.success) {
    if (result.error === 'debt_limit_exceeded') {
      return interaction.reply({
        content: `❌ 借金制限に達しています。\n💰 手持ち残高: **${result.balance}** あんこドル\n🏦 銀行残高: **${result.bankBalance}** あんこドル\n🚫 借金制限: **${result.limit}** あんこドル`,
        ephemeral: true
      });
    }
    return interaction.reply({
      content: '❌ 罰金の徴収に失敗しました。',
      ephemeral: true
    });
  }

  const deductionDetails = [];
  if (result.fromWallet > 0) {
    deductionDetails.push(`💰 手持ちから: **${result.fromWallet}** あんこドル`);
  }
  if (result.fromBank > 0) {
    deductionDetails.push(`🏦 銀行から: **${result.fromBank}** あんこドル`);
  }
  if (result.debtAdded > 0) {
    deductionDetails.push(`📉 借金として: **${result.debtAdded}** あんこドル`);
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ 罰金徴収完了')
    .setColor(0x00FF00)
    .setDescription(`**<@${targetId}>** から **${amount}** あんこドルを徴収しました。\n\n${deductionDetails.join('\n')}`)
    .addFields(
      { name: '💰 新しい手持ち残高', value: `${result.finalWallet} あんこドル`, inline: true },
      { name: '🏦 新しい銀行残高', value: `${result.finalBank} あんこドル`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });

  try {
    const targetUser = await interaction.guild.members.fetch(targetId);
    if (targetUser) {
      let message = `⚠️ 管理者があなたに **${amount}** あんこドルの罰金を課しました。\n\n`;
      message += deductionDetails.join('\n');
      message += `\n\n💰 現在の手持ち: **${result.finalWallet}** あんこドル\n🏦 現在の銀行: **${result.finalBank}** あんこドル`;
      await targetUser.send(message).catch(() => {});
    }
  } catch (error) {
  }
}

async function handleDailySettings(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ajack_daily_modal')
    .setTitle('デイリーボーナス設定');

  const settings = await getAjackSettings(interaction.guild.id);

  const bonusInput = new TextInputBuilder()
    .setCustomId('daily_bonus')
    .setLabel('デイリーボーナス額（あんこドル）')
    .setStyle(TextInputStyle.Short)
    .setValue(String(settings.dailyBonus || 100))
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(bonusInput));

  await interaction.showModal(modal);
}

async function handleDailyModal(interaction) {
  const bonus = parseInt(interaction.fields.getTextInputValue('daily_bonus'));

  if (isNaN(bonus) || bonus < 0) {
    return interaction.reply({
      content: '❌ 無効な値が入力されました。正の整数を入力してください。',
      ephemeral: true
    });
  }

  await updateAjackSettings(interaction.guild.id, {
    dailyBonus: bonus
  });

  const embed = new EmbedBuilder()
    .setTitle('✅ デイリーボーナス設定を更新しました')
    .setColor(0x00FF00)
    .addFields(
      { name: '🎁 デイリーボーナス', value: `${bonus} あんこドル`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleGachaManagement(interaction) {
  if (!(await checkAdminPermission(interaction))) return;

  const settings = await getAjackSettings(interaction.guild.id);
  const gachaItems = settings.gachaItems || [];
  
  const embed = new EmbedBuilder()
    .setTitle('🎰 ガチャ管理')
    .setColor(0xFFD700)
    .setDescription('**ガチャ機能を一から管理します**')
    .addFields(
      { name: '価格', value: `${settings.gachaPrice || 500} あんこドル`, inline: true },
      { name: 'アイテム数', value: `${gachaItems.length}個`, inline: true },
      { name: '説明', value: settings.gachaDescription || '運試しガチャ！', inline: false }
    )
    .setTimestamp();

  if (gachaItems.length > 0) {
    const totalWeight = gachaItems.reduce((sum, item) => sum + (item.weight || 1), 0);
    const itemsText = gachaItems.map(item => {
      const prob = ((item.weight || 1) / totalWeight * 100).toFixed(2);
      return `${item.name} - ${prob}%`;
    }).join('\n');
    embed.addFields({ name: '📦 登録アイテム', value: itemsText || 'なし', inline: false });
  }

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ajack_gacha_create')
        .setLabel('🎰 ガチャ作成')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('ajack_gacha_add_item')
        .setLabel('➕ アイテム追加')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ajack_gacha_remove_item')
        .setLabel('🗑️ アイテム削除')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(gachaItems.length === 0)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ajack_gacha_deploy')
        .setLabel('📤 ガチャボタンを配置')
        .setStyle(ButtonStyle.Success)
        .setDisabled(gachaItems.length === 0),
      new ButtonBuilder()
        .setCustomId('ajack_gacha_reset')
        .setLabel('🔄 リセット')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(gachaItems.length === 0)
    );

  await interaction.reply({
    embeds: [embed],
    components: [row1, row2],
    ephemeral: true
  });
}

async function handleGachaCreate(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ajack_gacha_create_modal')
    .setTitle('ガチャ作成');

  const settings = await getAjackSettings(interaction.guild.id);

  const priceInput = new TextInputBuilder()
    .setCustomId('gacha_price')
    .setLabel('ガチャ価格（あんこドル）')
    .setStyle(TextInputStyle.Short)
    .setValue(String(settings.gachaPrice || 500))
    .setRequired(true);

  const descInput = new TextInputBuilder()
    .setCustomId('gacha_desc')
    .setLabel('ガチャの説明')
    .setStyle(TextInputStyle.Paragraph)
    .setValue(settings.gachaDescription || '運試しガチャ！')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(priceInput),
    new ActionRowBuilder().addComponents(descInput)
  );

  await interaction.showModal(modal);
}

async function handleGachaCreateModal(interaction) {
  const price = parseInt(interaction.fields.getTextInputValue('gacha_price'));
  const description = interaction.fields.getTextInputValue('gacha_desc');

  if (isNaN(price) || price < 0) {
    return interaction.reply({
      content: '❌ 無効な価格です。正の整数を入力してください。',
      ephemeral: true
    });
  }

  await updateAjackSettings(interaction.guild.id, {
    gachaPrice: price,
    gachaDescription: description
  });

  const embed = new EmbedBuilder()
    .setTitle('✅ ガチャ設定を更新しました')
    .setColor(0x00FF00)
    .addFields(
      { name: '価格', value: `${price} あんこドル`, inline: true },
      { name: '説明', value: description, inline: false }
    )
    .setDescription('次に「アイテム追加」からアイテムを追加してください。')
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleGachaAddItem(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ajack_gacha_add_item_modal')
    .setTitle('アイテム追加');

  const nameInput = new TextInputBuilder()
    .setCustomId('item_name')
    .setLabel('アイテム名')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: レアカード')
    .setRequired(true);

  const weightInput = new TextInputBuilder()
    .setCustomId('item_weight')
    .setLabel('確率の重み（大きいほど出やすい）')
    .setStyle(TextInputStyle.Short)
    .setValue('1')
    .setPlaceholder('例: 1, 5, 10')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(weightInput)
  );

  await interaction.showModal(modal);
}

async function handleGachaAddItemModal(interaction) {
  const itemName = interaction.fields.getTextInputValue('item_name');
  const weight = parseInt(interaction.fields.getTextInputValue('item_weight'));

  if (isNaN(weight) || weight < 1) {
    return interaction.reply({
      content: '❌ 無効な重みです。1以上の整数を入力してください。',
      ephemeral: true
    });
  }

  const settings = await getAjackSettings(interaction.guild.id);
  const gachaItems = settings.gachaItems || [];

  gachaItems.push({
    id: Date.now().toString(),
    name: itemName,
    weight: weight
  });

  await updateAjackSettings(interaction.guild.id, {
    gachaItems: gachaItems
  });

  const totalWeight = gachaItems.reduce((sum, item) => sum + item.weight, 0);
  const probability = (weight / totalWeight * 100).toFixed(2);

  const embed = new EmbedBuilder()
    .setTitle('✅ アイテムを追加しました')
    .setColor(0x00FF00)
    .addFields(
      { name: 'アイテム名', value: itemName, inline: true },
      { name: '重み', value: String(weight), inline: true },
      { name: '確率', value: `${probability}%`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleGachaRemoveItem(interaction) {
  const settings = await getAjackSettings(interaction.guild.id);
  const gachaItems = settings.gachaItems || [];

  if (gachaItems.length === 0) {
    return interaction.reply({
      content: '❌ 削除可能なアイテムがありません。',
      ephemeral: true
    });
  }

  const options = gachaItems.map((item, index) => ({
    label: item.name,
    value: String(index),
    description: `重み: ${item.weight}`
  }));

  const row = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ajack_gacha_remove_item_select')
        .setPlaceholder('削除するアイテムを選択')
        .addOptions(options.slice(0, 25))
    );

  await interaction.reply({
    content: '削除するアイテムを選択してください：',
    components: [row],
    ephemeral: true
  });
}

async function handleGachaRemoveItemSelect(interaction) {
  const index = parseInt(interaction.values[0]);
  const settings = await getAjackSettings(interaction.guild.id);
  const gachaItems = settings.gachaItems || [];

  if (index < 0 || index >= gachaItems.length) {
    return interaction.update({
      content: '❌ 無効なアイテムです。',
      components: []
    });
  }

  const removedItem = gachaItems.splice(index, 1)[0];

  await updateAjackSettings(interaction.guild.id, {
    gachaItems: gachaItems
  });

  await interaction.update({
    content: `✅ アイテム「${removedItem.name}」を削除しました。`,
    components: []
  });
}

async function handleGachaReset(interaction) {
  await updateAjackSettings(interaction.guild.id, {
    gachaItems: [],
    gachaPrice: 500,
    gachaDescription: '運試しガチャ！'
  });

  await interaction.update({
    content: '✅ ガチャ設定をリセットしました。',
    embeds: [],
    components: []
  });
}

async function handleGachaDeploy(interaction) {
  const settings = await getAjackSettings(interaction.guild.id);
  const gachaItems = settings.gachaItems || [];

  if (gachaItems.length === 0) {
    return interaction.reply({
      content: '❌ アイテムが設定されていません。先にアイテムを追加してください。',
      ephemeral: true
    });
  }

  const channel = interaction.channel;
  
  const totalWeight = gachaItems.reduce((sum, item) => sum + item.weight, 0);
  const itemList = gachaItems.map(item => {
    const prob = (item.weight / totalWeight * 100).toFixed(2);
    return `• ${item.name} - ${prob}%`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('🎰 ガチャ')
    .setColor(0xFFD700)
    .setDescription(settings.gachaDescription || '運試しガチャ！')
    .addFields(
      { name: '💰 価格', value: `${settings.gachaPrice || 500} あんこドル`, inline: false },
      { name: '🎁 景品一覧', value: itemList, inline: false }
    )
    .setFooter({ text: 'ボタンを押してガチャを回そう！' })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ajack_public_gacha_roll')
        .setLabel('🎰 ガチャを回す')
        .setStyle(ButtonStyle.Success)
    );

  await channel.send({
    embeds: [embed],
    components: [row]
  });

  await interaction.reply({
    content: '✅ ガチャボタンをこのチャンネルに配置しました！',
    ephemeral: true
  });
}

async function handlePublicGachaRoll(interaction) {
  const userId = interaction.user.id;
  const guildId = interaction.guild.id;

  await interaction.deferReply();

  const settings = await getAjackSettings(guildId);
  const gachaItems = settings.gachaItems || [];

  if (gachaItems.length === 0) {
    return interaction.editReply({
      content: '❌ ガチャの景品が設定されていません。'
    });
  }

  const price = settings.gachaPrice || 500;
  const { getUserBalance, subtractBalance, addItemToInventory } = require('./ankoDollar');
  const balance = await getUserBalance(userId);

  if (balance < price) {
    return interaction.editReply({
      content: `❌ 残高が不足しています。\nガチャ価格: **${price}** あんこドル\n現在の残高: **${balance}** あんこドル`
    });
  }

  const result = await subtractBalance(userId, price);
  if (!result.success) {
    return interaction.editReply({
      content: '❌ ガチャの購入に失敗しました。'
    });
  }

  const totalWeight = gachaItems.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  
  let selectedItem = gachaItems[0];
  for (const item of gachaItems) {
    random -= item.weight;
    if (random <= 0) {
      selectedItem = item;
      break;
    }
  }

  const itemId = `gacha_${selectedItem.id}`;
  await addItemToInventory(userId, itemId, 1);

  const probability = (selectedItem.weight / totalWeight * 100).toFixed(2);

  const embed = new EmbedBuilder()
    .setTitle('🎰 ガチャ結果')
    .setColor(0xFFD700)
    .setDescription(`**<@${userId}>** がガチャを引きました！`)
    .addFields(
      { name: '🎁 獲得アイテム', value: selectedItem.name, inline: false },
      { name: '📊 確率', value: `${probability}%`, inline: true },
      { name: '💰 使用金額', value: `${price} あんこドル`, inline: true },
      { name: '💵 残高', value: `${result.balance} あんこドル`, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleItemAddShortcut(interaction) {
  await handleAddItem(interaction);
}

async function handleItemList(interaction) {
  const items = await getShopItems();

  const embed = new EmbedBuilder()
    .setTitle('📋 アイテムID一覧')
    .setColor(0x5865F2)
    .setDescription('**ショップに登録されている全アイテムのIDと名前**')
    .setTimestamp();

  const itemList = Object.entries(items).map(([id, item]) => {
    return { name: `${item.emoji} ${item.name}`, value: `ID: \`${id}\`\n価格: ${item.price} あんこドル`, inline: true };
  });

  if (itemList.length > 0) {
    embed.addFields(itemList);
  } else {
    embed.setDescription('現在登録されているアイテムはありません。');
  }

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

async function handleToggleVisibility(interaction) {
  const items = await getShopItems();
  const options = Object.entries(items).map(([id, item]) => {
    const visibilityIcon = item.visible === false ? '🔒' : '✅';
    const visibilityText = item.visible === false ? '非公開' : '公開中';
    return {
      label: item.name,
      value: id,
      description: `${visibilityIcon} ${visibilityText} | ${item.price} あんこドル`,
      emoji: item.emoji
    };
  });

  if (options.length === 0) {
    return interaction.reply({
      content: '❌ 切り替えるアイテムがありません。',
      ephemeral: true
    });
  }

  const row = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ajack_shop_toggle_visibility_select')
        .setPlaceholder('公開/非公開を切り替えるアイテムを選択')
        .addOptions(options)
    );

  await interaction.reply({
    content: '公開/非公開を切り替えるアイテムを選択してください：',
    components: [row],
    ephemeral: true
  });
}

async function handleToggleVisibilitySelect(interaction) {
  const itemId = interaction.values[0];
  const items = await getShopItems();
  const item = items[itemId];
  
  if (!item) {
    return interaction.update({
      content: '❌ アイテムが見つかりませんでした。',
      components: []
    });
  }

  const newVisibility = item.visible === false ? true : false;
  await updateShopItem(itemId, { visible: newVisibility });

  const statusText = newVisibility ? '公開' : '非公開';
  const statusIcon = newVisibility ? '✅' : '🔒';
  
  await interaction.update({
    content: `${statusIcon} アイテム「${item.name}」を${statusText}に設定しました。`,
    components: []
  });
}

async function handleCheckBalance(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('💰 ユーザー残高確認')
    .setColor(0x5865F2)
    .setDescription('**ユーザーを選択して残高を確認します**')
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new UserSelectMenuBuilder()
        .setCustomId('ajack_check_balance_select')
        .setPlaceholder('残高を確認するユーザーを選択')
        .setMaxValues(1)
    );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true
  });
}

async function handleCheckBalanceSelect(interaction) {
  const targetId = interaction.values[0];
  
  const { getUserBalance, getBankBalance } = require('./ankoDollar');
  const balance = await getUserBalance(targetId);
  const bankBalance = await getBankBalance(targetId);
  const total = balance + bankBalance;

  const embed = new EmbedBuilder()
    .setTitle('💰 ユーザー残高')
    .setColor(0xFFD700)
    .setDescription(`**<@${targetId}>** の残高情報`)
    .addFields(
      { name: '💰 手持ち', value: `**${balance}** あんこドル${balance < 0 ? ' (借金中)' : ''}`, inline: true },
      { name: '🏦 銀行', value: `**${bankBalance}** あんこドル`, inline: true },
      { name: '💎 総資産', value: `**${total}** あんこドル`, inline: true }
    )
    .setTimestamp();

  await interaction.update({
    embeds: [embed],
    components: []
  });
}

async function handleChannelSettings(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ajack_channel_modal')
    .setTitle('チャンネル制限設定');

  const settings = await getAjackSettings(interaction.guild.id);

  const channelIdInput = new TextInputBuilder()
    .setCustomId('channel_id')
    .setLabel('許可するチャンネルID（空欄=制限なし）')
    .setStyle(TextInputStyle.Short)
    .setValue(settings.allowedChannelId || '')
    .setPlaceholder('例: 123456789012345678')
    .setRequired(false);

  modal.addComponents(new ActionRowBuilder().addComponents(channelIdInput));

  await interaction.showModal(modal);
}

async function handleChannelModal(interaction) {
  const channelId = interaction.fields.getTextInputValue('channel_id').trim();

  if (channelId && !/^\d{17,20}$/.test(channelId)) {
    return interaction.reply({
      content: '❌ 無効なチャンネルIDです。チャンネルIDは17-20桁の数字である必要があります。',
      ephemeral: true
    });
  }

  await updateAjackSettings(interaction.guild.id, {
    allowedChannelId: channelId || null
  });

  const embed = new EmbedBuilder()
    .setTitle('✅ チャンネル制限設定を更新しました')
    .setColor(0x00FF00)
    .addFields(
      { name: '🔒 許可チャンネル', value: channelId ? `<#${channelId}>` : '制限なし（全チャンネルで使用可能）', inline: false }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleMultiplierSettings(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ajack_multiplier_modal')
    .setTitle('ブラックジャック倍率設定');

  const settings = await getAjackSettings(interaction.guild.id);

  const regularInput = new TextInputBuilder()
    .setCustomId('regular_multiplier')
    .setLabel('通常ゲーム倍率（例: 1.5）')
    .setStyle(TextInputStyle.Short)
    .setValue(String(settings.regularMultiplier || 1.5))
    .setPlaceholder('例: 1.5')
    .setRequired(true);

  const allInInput = new TextInputBuilder()
    .setCustomId('allin_multiplier')
    .setLabel('大勝負倍率（例: 2.5）')
    .setStyle(TextInputStyle.Short)
    .setValue(String(settings.allInMultiplier || 2.5))
    .setPlaceholder('例: 2.5')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(regularInput),
    new ActionRowBuilder().addComponents(allInInput)
  );

  await interaction.showModal(modal);
}

async function handleMultiplierModal(interaction) {
  const regular = parseFloat(interaction.fields.getTextInputValue('regular_multiplier'));
  const allIn = parseFloat(interaction.fields.getTextInputValue('allin_multiplier'));

  if (isNaN(regular) || isNaN(allIn) || regular <= 0 || allIn <= 0) {
    return interaction.reply({
      content: '❌ 無効な倍率です。0より大きい数値を入力してください。',
      ephemeral: true
    });
  }

  await updateAjackSettings(interaction.guild.id, {
    regularMultiplier: regular,
    allInMultiplier: allIn
  });

  const embed = new EmbedBuilder()
    .setTitle('✅ ブラックジャック倍率設定を更新しました')
    .setColor(0x00FF00)
    .addFields(
      { name: '🎴 通常ゲーム倍率', value: `${regular}倍`, inline: true },
      { name: '🔥 大勝負倍率', value: `${allIn}倍`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

const publicButtonClaims = new Map();

async function handlePublicButtonCreate(interaction) {
  if (!(await checkAdminPermission(interaction))) return;

  const modal = new ModalBuilder()
    .setCustomId('ajack_public_button_modal')
    .setTitle('公開ボタン作成');

  const amountInput = new TextInputBuilder()
    .setCustomId('button_amount')
    .setLabel('配布金額（あんこドル）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 500')
    .setRequired(true);

  const messageInput = new TextInputBuilder()
    .setCustomId('button_message')
    .setLabel('メッセージ内容')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('ボタンの上に表示されるメッセージ')
    .setRequired(true);

  const channelInput = new TextInputBuilder()
    .setCustomId('button_channel')
    .setLabel('送信先チャンネルID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 123456789012345678')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(amountInput),
    new ActionRowBuilder().addComponents(messageInput),
    new ActionRowBuilder().addComponents(channelInput)
  );

  await interaction.showModal(modal);
}

async function handlePublicButtonModal(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ このコマンドを使用する権限がありません。（管理者権限が必要）',
      ephemeral: true
    });
  }

  const amount = parseInt(interaction.fields.getTextInputValue('button_amount'));
  const message = interaction.fields.getTextInputValue('button_message');
  const channelId = interaction.fields.getTextInputValue('button_channel').trim();

  if (isNaN(amount) || amount <= 0) {
    return interaction.reply({
      content: '❌ 無効な金額です。正の整数を入力してください。',
      ephemeral: true
    });
  }

  if (!/^\d{17,20}$/.test(channelId)) {
    return interaction.reply({
      content: '❌ 無効なチャンネルIDです。チャンネルIDは17-20桁の数字である必要があります。',
      ephemeral: true
    });
  }

  try {
    const channel = await interaction.guild.channels.fetch(channelId);
    
    if (!channel || !channel.isTextBased()) {
      return interaction.reply({
        content: '❌ 指定されたチャンネルが見つからないか、テキストチャンネルではありません。',
        ephemeral: true
      });
    }

    const buttonId = `ajack_public_claim:${Date.now()}:${Math.random().toString(36).substring(7)}`;
    publicButtonClaims.set(buttonId, {
      amount: amount,
      claimedUsers: new Set()
    });

    const embed = new EmbedBuilder()
      .setTitle('🎁 あんこドル配布')
      .setColor(0xFFD700)
      .setDescription(message)
      .addFields(
        { name: '💰 配布金額', value: `${amount} あんこドル`, inline: true }
      )
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId(buttonId)
      .setLabel('💰 受け取る')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(button);

    await channel.send({
      embeds: [embed],
      components: [row]
    });

    await interaction.reply({
      content: `✅ 公開ボタンを <#${channelId}> に送信しました！`,
      ephemeral: true
    });
  } catch (error) {
    console.error('公開ボタン作成エラー:', error);
    await interaction.reply({
      content: '❌ 公開ボタンの作成中にエラーが発生しました。',
      ephemeral: true
    });
  }
}

async function handlePublicButtonClaim(interaction) {
  const buttonData = publicButtonClaims.get(interaction.customId);

  if (!buttonData) {
    return interaction.reply({
      content: '❌ このボタンは無効です。',
      ephemeral: true
    });
  }

  if (buttonData.claimedUsers.has(interaction.user.id)) {
    return interaction.reply({
      content: '❌ すでにこのボタンから受け取っています。',
      ephemeral: true
    });
  }

  const result = await adminGiveMoney(interaction.user.id, buttonData.amount);

  if (!result.success) {
    return interaction.reply({
      content: '❌ あんこドルの受け取りに失敗しました。',
      ephemeral: true
    });
  }

  buttonData.claimedUsers.add(interaction.user.id);

  const embed = new EmbedBuilder()
    .setTitle('✅ 受け取り完了')
    .setColor(0x00FF00)
    .setDescription(`**${buttonData.amount}** あんこドルを受け取りました！`)
    .addFields(
      { name: '💰 あなたの新しい残高', value: `${result.balance} あんこドル`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleBroadcastDM(interaction) {
  if (!(await checkAdminPermission(interaction))) return;

  const modal = new ModalBuilder()
    .setCustomId('ajack_broadcast_dm_modal')
    .setTitle('全員にDM送信');

  const messageInput = new TextInputBuilder()
    .setCustomId('dm_message')
    .setLabel('送信するメッセージ')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('サーバーの全メンバーに送信するメッセージを入力してください')
    .setMaxLength(2000)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(messageInput));

  await interaction.showModal(modal);
}

async function handleBroadcastDMModal(interaction) {
  if (!(await checkAdminPermission(interaction))) return;

  await interaction.deferReply({ ephemeral: true });

  const message = interaction.fields.getTextInputValue('dm_message');

  try {
    await interaction.guild.members.fetch();
    
    const members = interaction.guild.members.cache.filter(member => !member.user.bot);
    const totalMembers = members.size;
    
    let successCount = 0;
    let failCount = 0;
    const failedUsers = [];
    const startTime = Date.now();
    let canUpdateInteraction = true;

    try {
      await interaction.editReply({
        content: `📢 DM送信を開始します...\n対象: ${totalMembers}人のメンバー`
      });
    } catch (err) {
      console.warn('初期メッセージ更新失敗:', err.message);
      canUpdateInteraction = false;
    }

    for (const [userId, member] of members) {
      try {
        await member.send(message);
        successCount++;
      } catch (err) {
        failCount++;
        failedUsers.push(member.user.tag);
        console.warn(`DM送信失敗: ${member.user.tag} - ${err.message}`);
      }
      
      const elapsedMinutes = (Date.now() - startTime) / 60000;
      if (elapsedMinutes > 14) {
        canUpdateInteraction = false;
      }
      
      if (canUpdateInteraction && (successCount + failCount) % 10 === 0) {
        try {
          await interaction.editReply({
            content: `📢 DM送信中... (${successCount + failCount}/${totalMembers})\n✅ 成功: ${successCount} | ❌ 失敗: ${failCount}`
          });
        } catch (err) {
          console.warn('進捗更新失敗（インタラクションタイムアウト）:', err.message);
          canUpdateInteraction = false;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const embed = new EmbedBuilder()
      .setTitle('📢 DM送信完了')
      .setColor(successCount > 0 ? 0x00FF00 : 0xFF0000)
      .addFields(
        { name: '📊 送信結果', value: `対象: ${totalMembers}人`, inline: false },
        { name: '✅ 成功', value: `${successCount}人`, inline: true },
        { name: '❌ 失敗', value: `${failCount}人`, inline: true }
      )
      .setTimestamp();

    if (failCount > 0 && failedUsers.length <= 10) {
      embed.addFields({
        name: '⚠️ 送信失敗したユーザー',
        value: failedUsers.join('\n') || 'なし',
        inline: false
      });
    } else if (failCount > 10) {
      embed.addFields({
        name: '⚠️ 送信失敗したユーザー',
        value: `${failedUsers.slice(0, 10).join('\n')}\n...他${failCount - 10}人`,
        inline: false
      });
    }

    if (canUpdateInteraction) {
      try {
        await interaction.editReply({
          content: null,
          embeds: [embed]
        });
      } catch (err) {
        console.warn('最終結果更新失敗（インタラクションタイムアウト）:', err.message);
        canUpdateInteraction = false;
      }
    }

    if (!canUpdateInteraction) {
      console.log(`📢 DM送信完了 - 成功: ${successCount}/${totalMembers}, 失敗: ${failCount}`);
      try {
        const logChannel = interaction.channel;
        if (logChannel?.isTextBased()) {
          await logChannel.send({
            content: `<@${interaction.user.id}> DM送信が完了しました。\n*インタラクションのタイムアウトにより、チャンネルに結果を送信しています。*`,
            embeds: [embed]
          });
          console.log('フォールバック通知をチャンネルに送信しました');
        }
      } catch (err) {
        console.error('ログチャンネルへの送信失敗:', err.message);
      }
    }

  } catch (error) {
    console.error('DM一斉送信エラー:', error);
    try {
      await interaction.editReply({
        content: `❌ DM送信中にエラーが発生しました。\nエラー: ${error.message}`
      });
    } catch (err) {
      console.error('エラーメッセージ更新失敗:', err.message);
    }
  }
}

module.exports = {
  checkAdminPermission,
  createSettingsPanel,
  handleWorkSettings,
  handleWorkModal,
  handleDailySettings,
  handleDailyModal,
  handleShopManagement,
  handleAddItem,
  handleAddItemModal,
  handleRemoveItem,
  handleRemoveItemSelect,
  handleRoleSettings,
  handleRoleModal,
  handleChatSettings,
  handleChatModal,
  handleChatToggle,
  handleStealSettings,
  handleStealModal,
  handleChannelSettings,
  handleChannelModal,
  handleMultiplierSettings,
  handleMultiplierModal,
  handleGachaManagement,
  handleGachaCreate,
  handleGachaCreateModal,
  handleGachaAddItem,
  handleGachaAddItemModal,
  handleGachaRemoveItem,
  handleGachaRemoveItemSelect,
  handleGachaReset,
  handleGachaDeploy,
  handlePublicGachaRoll,
  handleItemAddShortcut,
  handleAdminGive,
  handleAdminGiveAll,
  handleAdminGiveSelect,
  handleAdminGiveModal,
  handleAdminFine,
  handleAdminFineSelect,
  handleAdminFineModal,
  handleItemList,
  handleToggleVisibility,
  handleToggleVisibilitySelect,
  handleCheckBalance,
  handleCheckBalanceSelect,
  handlePublicButtonCreate,
  handlePublicButtonModal,
  handlePublicButtonClaim,
  handleBroadcastDM,
  handleBroadcastDMModal
};
