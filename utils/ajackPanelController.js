const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder
} = require('discord.js');
const { getUserBalance, work, getInventory, claimDaily, subtractBalance, getBankBalance, deposit, withdraw, stealFrom, transferWallet } = require('./ankoDollar');
const { createGame, createAllInGame, hit, stand, getActiveGame, createPvPInvite, acceptPvPInvite, rejectPvPInvite, hitPvP, standPvP, getPendingInvite, getActivePvPGame } = require('./blackjack');
const { purchaseItem } = require('./shop');
const { getAjackSettings, getShopItems } = require('../storage/fileStorage');

async function createMainPanel(userId, guildId) {
  const balance = await getUserBalance(userId);
  const bankBalance = await getBankBalance(userId);
  const settings = await getAjackSettings(guildId);
  
  const embed = new EmbedBuilder()
    .setTitle('🎰 あんこジャック - メインパネル')
    .setColor(0x5865F2)
    .setDescription('**ようこそ！あんこジャックへ！**')
    .addFields(
      { name: '💰 所持金', value: `**${balance}** あんこドル${balance < 0 ? ' (借金中)' : ''}`, inline: true },
      { name: '🏦 口座残高', value: `**${bankBalance}** あんこドル`, inline: true },
      { name: 'ℹ️ 説明', value: 'ボタンを選んでアクションを実行してください', inline: false }
    )
    .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ajack_blackjack')
        .setLabel('🎴 ブラックジャック (AI)')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ajack_pvp_blackjack')
        .setLabel('⚔️ フレンド対戦')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('ajack_allin')
        .setLabel('🔥 大勝負')
        .setStyle(ButtonStyle.Danger)
    );
  
  const row1_5 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ajack_work')
        .setLabel('💼 働く')
        .setStyle(ButtonStyle.Success)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ajack_shop')
        .setLabel('🛒 ショップ')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ajack_inventory')
        .setLabel('🎒 インベントリ')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ajack_daily')
        .setLabel('🎁 デイリー')
        .setStyle(ButtonStyle.Success)
    );

  const row3 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ajack_bank')
        .setLabel('🏦 銀行')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ajack_steal')
        .setLabel('💰 盗む')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('ajack_transfer')
        .setLabel('💸 送金')
        .setStyle(ButtonStyle.Success)
    );

  const row4 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ajack_ranking')
        .setLabel('🏆 ランキング')
        .setStyle(ButtonStyle.Primary)
    );

  const components = [row1, row1_5, row2, row3, row4];

  if (settings.purchaseRoleId) {
    const roleButton = new ButtonBuilder()
      .setCustomId('ajack_buy_role')
      .setLabel(`🎭 ロール購入 (${settings.rolePrice} あんこドル)`)
      .setStyle(ButtonStyle.Primary);
    
    if (components[components.length - 1].components.length < 5) {
      components[components.length - 1].addComponents(roleButton);
    } else {
      const newRow = new ActionRowBuilder().addComponents(roleButton);
      components.push(newRow);
    }
  }

  return {
    embeds: [embed],
    components
  };
}

async function handleBlackjackButton(interaction) {
  await interaction.reply({
    content: '**ブラックジャックを開始します！**\n\nベット額を選択してください：',
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ajack_bj_bet')
          .setPlaceholder('ベット額を選択')
          .addOptions([
            { label: '10 あんこドル', value: '10' },
            { label: '50 あんこドル', value: '50' },
            { label: '100 あんこドル', value: '100' },
            { label: '500 あんこドル', value: '500' },
            { label: '1000 あんこドル', value: '1000' },
            { label: '5000 あんこドル', value: '5000' },
            { label: '10000 あんこドル', value: '10000' },
            { label: '💰 カスタム金額を入力', value: 'custom', emoji: '💰' }
          ])
      )
    ],
    ephemeral: true
  });
}

async function handleBetSelect(interaction) {
  const selectedValue = interaction.values[0];
  const userId = interaction.user.id;

  if (selectedValue === 'custom') {
    const modal = new ModalBuilder()
      .setCustomId('ajack_bj_custom_bet_modal')
      .setTitle('カスタムベット額入力');

    const betInput = new TextInputBuilder()
      .setCustomId('custom_bet')
      .setLabel('ベット額（あんこドル）')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('例: 1000')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(betInput));

    return interaction.showModal(modal);
  }

  const bet = parseInt(selectedValue);

  const activeGame = getActiveGame(userId);
  if (activeGame) {
    return interaction.reply({
      content: '❌ 既に進行中のゲームがあります。',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const result = await createGame(userId, bet, true, null, interaction.guild.id);
  
  if (!result.success) {
    if (result.error === 'debt_limit_exceeded') {
      await interaction.editReply({
        content: `❌ 借金制限に達しています。\n現在の残高: **${result.balance}** あんこドル\n借金制限: **${result.limit}** あんこドル`,
        components: []
      });
      return;
    }
    await interaction.editReply({
      content: '❌ ゲームの開始に失敗しました。',
      components: []
    });
    return;
  }

  if (result.result === 'blackjack' || result.result === 'push') {
    const embed = new EmbedBuilder()
      .setTitle('🎰 ブラックジャック')
      .setColor(result.result === 'blackjack' ? 0x00FF00 : 0xFFFF00)
      .addFields(
        { name: '🎴 あなたの手札', value: `${result.playerHand} (${result.playerValue})`, inline: true },
        { name: '🎴 ディーラーの手札', value: `${result.dealerHand} (${result.dealerValue})`, inline: true },
        { name: '💰 ベット額', value: `${bet} あんこドル`, inline: true },
        { name: '💸 配当', value: `${result.payout} あんこドル`, inline: true },
        { name: '📈 利益', value: `${result.profit > 0 ? '+' : ''}${result.profit} あんこドル`, inline: true }
      )
      .setDescription(`**${result.message}**`)
      .setTimestamp();

    const newBalance = await getUserBalance(userId);
    embed.setFooter({ text: `残高: ${newBalance} あんこドル` });

    await interaction.editReply({ embeds: [embed], components: [] });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🎰 ブラックジャック')
    .setColor(0x5865F2)
    .addFields(
      { name: '🎴 あなたの手札', value: `${result.game.playerHand} (${result.game.playerValue})`, inline: false },
      { name: '🎴 ディーラーの見えるカード', value: result.game.dealerUpCard, inline: false },
      { name: '💰 ベット額', value: `${result.game.bet} あんこドル`, inline: false }
    )
    .setDescription('**ヒットしますか？スタンドしますか？**')
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('bj_hit')
        .setLabel('🎴 ヒット')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('bj_stand')
        .setLabel('✋ スタンド')
        .setStyle(ButtonStyle.Danger)
    );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleAllInButton(interaction) {
  const userId = interaction.user.id;
  const balance = await getUserBalance(userId);

  if (balance <= 0) {
    return interaction.reply({
      content: `❌ 残高が不足しています。\n現在の残高: **${balance}** あんこドル`,
      ephemeral: true
    });
  }

  const confirmEmbed = new EmbedBuilder()
    .setTitle('🔥 大勝負')
    .setColor(0xFF0000)
    .setDescription(`**全財産（${balance} あんこドル）を賭けますか？**\n\n⚠️ 負けた場合、借金になります！`)
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ajack_allin_confirm')
        .setLabel('✅ 賭ける')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('ajack_allin_cancel')
        .setLabel('❌ キャンセル')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.reply({
    embeds: [confirmEmbed],
    components: [row],
    ephemeral: true
  });
}

async function handleAllInConfirm(interaction) {
  const userId = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  const result = await createAllInGame(userId, interaction.guild.id);

  if (!result.success) {
    if (result.error === 'debt_limit_exceeded') {
      await interaction.editReply({
        content: `❌ 借金制限に達しているため、大勝負はできません。\n現在の残高: **${result.balance}** あんこドル\n借金制限: **${result.limit}** あんこドル`,
        components: []
      });
      return;
    }
    await interaction.editReply({
      content: `❌ ゲームを開始できませんでした。\n現在の残高: **${result.balance}** あんこドル`,
      components: []
    });
    return;
  }

  if (result.result === 'blackjack' || result.result === 'push') {
    const embed = new EmbedBuilder()
      .setTitle('🔥 大勝負 - ブラックジャック！')
      .setColor(result.result === 'blackjack' ? 0x00FF00 : 0xFFFF00)
      .addFields(
        { name: '🎴 あなたの手札', value: `${result.playerHand} (${result.playerValue})`, inline: true },
        { name: '🎴 ディーラーの手札', value: `${result.dealerHand} (${result.dealerValue})`, inline: true },
        { name: '💰 ベット額', value: `${result.game?.bet || result.payout} あんこドル`, inline: true },
        { name: '💸 配当', value: `${result.payout} あんこドル`, inline: true },
        { name: '📈 利益', value: `${result.profit > 0 ? '+' : ''}${result.profit || 0} あんこドル`, inline: true }
      )
      .setDescription(`**${result.message}**`)
      .setTimestamp();

    const newBalance = await getUserBalance(userId);
    embed.setFooter({ text: `残高: ${newBalance} あんこドル` });

    await interaction.editReply({ embeds: [embed], components: [] });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🔥 大勝負 - ブラックジャック')
    .setColor(0xFF0000)
    .addFields(
      { name: '🎴 あなたの手札', value: `${result.game.playerHand} (${result.game.playerValue})`, inline: false },
      { name: '🎴 ディーラーの見えるカード', value: result.game.dealerUpCard, inline: false },
      { name: '💰 ベット額', value: `${result.game.bet} あんこドル（全財産）`, inline: false }
    )
    .setDescription('**ヒットしますか？スタンドしますか？**')
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('bj_hit')
        .setLabel('🎴 ヒット')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('bj_stand')
        .setLabel('✋ スタンド')
        .setStyle(ButtonStyle.Danger)
    );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleWorkButton(interaction) {
  const userId = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  const result = await work(userId);

  if (!result.success) {
    if (result.error === 'on_cooldown') {
      return interaction.editReply({
        content: `⏰ まだ働けません。\n次回まで: **${result.minutesLeft}分${result.secondsLeft}秒**`
      });
    }
    return interaction.editReply({
      content: '❌ 働くことができませんでした。'
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('💼 お仕事完了')
    .setColor(0x00FF00)
    .setDescription(`お疲れ様でした！\n**+${result.reward}** あんこドルを獲得しました！`)
    .addFields(
      { name: '💰 新しい残高', value: `${result.newBalance} あんこドル`, inline: false }
    )
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function handleShopButton(interaction) {
  const items = await getShopItems();
  const visibleItems = Object.fromEntries(
    Object.entries(items).filter(([id, item]) => item.visible !== false)
  );
  const userId = interaction.user.id;
  const balance = await getUserBalance(userId);

  const embed = new EmbedBuilder()
    .setTitle('🛒 ショップ')
    .setColor(0xFFD700)
    .setDescription('**購入したいアイテムを選択してください**')
    .addFields(
      { name: '💰 現在の残高', value: `${balance} あんこドル`, inline: false }
    )
    .setTimestamp();

  const itemList = Object.entries(visibleItems).map(([id, item]) => {
    return { name: `${item.emoji} ${item.name}`, value: `価格: ${item.price} あんこドル\n${item.description}`, inline: true };
  });

  if (itemList.length > 0) {
    embed.addFields(itemList);
  } else {
    embed.setDescription('現在販売中のアイテムはありません。');
  }

  const options = Object.entries(visibleItems).map(([id, item]) => ({
    label: item.name,
    value: id,
    description: `${item.price} あんこドル - ${item.description}`,
    emoji: item.emoji
  }));

  if (options.length === 0) {
    return interaction.reply({
      embeds: [embed]
    });
  }

  const row = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ajack_shop_buy')
        .setPlaceholder('アイテムを選択')
        .addOptions(options)
    );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true
  });
}

async function handleShopBuy(interaction) {
  const itemId = interaction.values[0];
  const userId = interaction.user.id;

  await interaction.deferUpdate();

  const result = await purchaseItem(userId, itemId);

  if (!result.success) {
    if (result.error === 'insufficient_funds') {
      await interaction.editReply({
        content: `❌ 残高が不足しています。\n現在の残高: **${result.balance}** あんこドル\n必要な金額: **${result.required}** あんこドル`,
        components: []
      });
      return;
    }
    await interaction.editReply({
      content: '❌ アイテムの購入に失敗しました。',
      components: []
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🛒 購入完了')
    .setColor(0x00FF00)
    .setDescription(`**${result.item.emoji} ${result.item.name}** を購入しました！`)
    .addFields(
      { name: '💰 新しい残高', value: `${result.newBalance} あんこドル`, inline: false }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [] });
}

async function handleInventoryButton(interaction) {
  const userId = interaction.user.id;
  const inventory = await getInventory(userId);
  const items = await getShopItems();
  
  let gachaItems = [];
  if (interaction.guild) {
    const guildId = interaction.guild.id;
    const settings = await getAjackSettings(guildId);
    gachaItems = settings.gachaItems || [];
  }

  const embed = new EmbedBuilder()
    .setTitle('🎒 インベントリ')
    .setColor(0x9B59B6)
    .setTimestamp();

  const inventoryList = Object.entries(inventory).map(([itemId, quantity]) => {
    if (itemId.startsWith('gacha_')) {
      const gachaItemId = itemId.replace('gacha_', '');
      const gachaItem = gachaItems.find(item => item.id === gachaItemId);
      if (gachaItem) {
        return { name: `🎰 ${gachaItem.name}`, value: `所持数: ${quantity}個`, inline: true };
      }
      return { name: `🎰 ガチャアイテム`, value: `所持数: ${quantity}個`, inline: true };
    } else {
      const item = items[itemId];
      if (item) {
        return { name: `${item.emoji} ${item.name}`, value: `所持数: ${quantity}個`, inline: true };
      }
    }
    return null;
  }).filter(Boolean);

  if (inventoryList.length > 0) {
    embed.setDescription('**あなたの所持アイテム**');
    embed.addFields(inventoryList);
  } else {
    embed.setDescription('アイテムを所持していません。');
  }

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

async function handleDailyButton(interaction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId || interaction.guild?.id;

  await interaction.deferReply({ ephemeral: true });

  const result = await claimDaily(userId, guildId);

  if (!result.success) {
    if (result.error === 'already_claimed') {
      return interaction.editReply({
        content: `❌ 本日のデイリーボーナスは既に受け取っています。\n次回まで: **${result.hoursLeft}時間${result.minutesLeft}分**`
      });
    }
    return interaction.editReply({
      content: '❌ デイリーボーナスの受け取りに失敗しました。'
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('🎁 デイリーボーナス')
    .setColor(0x00FF00)
    .setDescription(`**+${result.bonus}** あんこドルを受け取りました！`)
    .addFields(
      { name: '💰 新しい残高', value: `${result.newBalance} あんこドル`, inline: false }
    )
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function handleBuyRoleButton(interaction) {
  const userId = interaction.user.id;
  const settings = await getAjackSettings(interaction.guild.id);

  if (!settings.purchaseRoleId) {
    return interaction.reply({
      content: '❌ 購入可能なロールが設定されていません。'
    });
  }

  const member = interaction.member;
  if (member.roles.cache.has(settings.purchaseRoleId)) {
    return interaction.reply({
      content: '❌ 既にこのロールを持っています。'
    });
  }

  const balance = await getUserBalance(userId);
  if (balance < settings.rolePrice) {
    return interaction.reply({
      content: `❌ 残高が不足しています。\n現在の残高: **${balance}** あんこドル\n必要な金額: **${settings.rolePrice}** あんこドル`
    });
  }

  const confirmEmbed = new EmbedBuilder()
    .setTitle('🎭 ロール購入確認')
    .setColor(0x5865F2)
    .setDescription(`**<@&${settings.purchaseRoleId}>** を **${settings.rolePrice} あんこドル** で購入しますか？`)
    .addFields(
      { name: '💰 現在の残高', value: `${balance} あんこドル`, inline: true },
      { name: '💸 購入後の残高', value: `${balance - settings.rolePrice} あんこドル`, inline: true }
    )
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ajack_buy_role_confirm')
        .setLabel('✅ 購入する')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('ajack_buy_role_cancel')
        .setLabel('❌ キャンセル')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.reply({
    embeds: [confirmEmbed],
    components: [row]
  });
}

async function handleBuyRoleConfirm(interaction) {
  const userId = interaction.user.id;
  const settings = await getAjackSettings(interaction.guild.id);

  await interaction.deferUpdate();

  if (!settings.purchaseRoleId) {
    await interaction.editReply({
      content: '❌ 購入可能なロールが設定されていません。',
      embeds: [],
      components: []
    });
    return;
  }

  const member = interaction.member;
  if (member.roles.cache.has(settings.purchaseRoleId)) {
    await interaction.editReply({
      content: '❌ 既にこのロールを持っています。',
      embeds: [],
      components: []
    });
    return;
  }

  const result = await subtractBalance(userId, settings.rolePrice, false);
  if (!result.success) {
    await interaction.editReply({
      content: `❌ 残高が不足しています。\n現在の残高: **${result.balance}** あんこドル`,
      embeds: [],
      components: []
    });
    return;
  }

  try {
    await member.roles.add(settings.purchaseRoleId);
    
    const embed = new EmbedBuilder()
      .setTitle('✅ ロール購入完了')
      .setColor(0x00FF00)
      .setDescription(`**<@&${settings.purchaseRoleId}>** を購入しました！`)
      .addFields(
        { name: '💸 支払い金額', value: `${settings.rolePrice} あんこドル`, inline: true },
        { name: '💰 新しい残高', value: `${result.balance} あんこドル`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed], components: [] });
  } catch (error) {
    console.error('ロール付与エラー:', error);
    
    const { addBalance } = require('./ankoDollar');
    await addBalance(userId, settings.rolePrice);
    const refundedBalance = await getUserBalance(userId);
    
    await interaction.editReply({
      content: `❌ ロールの付与に失敗しました。お金は返金されました。\n💰 現在の残高: **${refundedBalance}** あんこドル`,
      embeds: [],
      components: []
    });
  }
}

async function handleBuyRoleCancel(interaction) {
  await interaction.update({
    content: 'ロール購入をキャンセルしました。',
    embeds: [],
    components: []
  });
}

async function handleBankButton(interaction) {
  const userId = interaction.user.id;
  const walletBalance = await getUserBalance(userId);
  const bankBalance = await getBankBalance(userId);
  
  const embed = new EmbedBuilder()
    .setTitle('🏦 銀行')
    .setColor(0x5865F2)
    .setDescription('**銀行口座の管理**\n\n口座に預けたお金は盗まれません。')
    .addFields(
      { name: '💰 所持金', value: `${walletBalance} あんこドル`, inline: true },
      { name: '🏦 口座残高', value: `${bankBalance} あんこドル`, inline: true }
    )
    .setTimestamp();
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ajack_bank_deposit')
        .setLabel('💵 入金')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('ajack_bank_withdraw')
        .setLabel('💸 出金')
        .setStyle(ButtonStyle.Primary)
    );
  
  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true
  });
}

async function handleBankDeposit(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ajack_bank_deposit_modal')
    .setTitle('口座に入金');
  
  const amountInput = new TextInputBuilder()
    .setCustomId('deposit_amount')
    .setLabel('入金額（あんこドル）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 1000')
    .setRequired(true);
  
  modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
  
  await interaction.showModal(modal);
}

async function handleBankDepositModal(interaction) {
  const userId = interaction.user.id;
  const amount = parseInt(interaction.fields.getTextInputValue('deposit_amount'));
  
  if (isNaN(amount) || amount <= 0) {
    return interaction.reply({
      content: '❌ 無効な金額です。正の整数を入力してください。',
      ephemeral: true
    });
  }
  
  const result = await deposit(userId, amount);
  
  if (!result.success) {
    if (result.error === 'insufficient_funds') {
      return interaction.reply({
        content: `❌ 所持金が不足しています。\n💰 現在の所持金: **${result.balance}** あんこドル`,
        ephemeral: true
      });
    }
    return interaction.reply({
      content: '❌ 入金に失敗しました。',
      ephemeral: true
    });
  }
  
  const embed = new EmbedBuilder()
    .setTitle('✅ 入金完了')
    .setColor(0x00FF00)
    .setDescription(`**${amount}** あんこドルを口座に入金しました。`)
    .addFields(
      { name: '💰 所持金', value: `${result.walletBalance} あんこドル`, inline: true },
      { name: '🏦 口座残高', value: `${result.bankBalance} あんこドル`, inline: true }
    )
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleBankWithdraw(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ajack_bank_withdraw_modal')
    .setTitle('口座から出金');
  
  const amountInput = new TextInputBuilder()
    .setCustomId('withdraw_amount')
    .setLabel('出金額（あんこドル）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 1000')
    .setRequired(true);
  
  modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
  
  await interaction.showModal(modal);
}

async function handleBankWithdrawModal(interaction) {
  const userId = interaction.user.id;
  const amount = parseInt(interaction.fields.getTextInputValue('withdraw_amount'));
  
  if (isNaN(amount) || amount <= 0) {
    return interaction.reply({
      content: '❌ 無効な金額です。正の整数を入力してください。',
      ephemeral: true
    });
  }
  
  const result = await withdraw(userId, amount);
  
  if (!result.success) {
    if (result.error === 'insufficient_bank_funds') {
      return interaction.reply({
        content: `❌ 口座残高が不足しています。\n🏦 現在の口座残高: **${result.balance}** あんこドル`,
        ephemeral: true
      });
    }
    return interaction.reply({
      content: '❌ 出金に失敗しました。',
      ephemeral: true
    });
  }
  
  const embed = new EmbedBuilder()
    .setTitle('✅ 出金完了')
    .setColor(0x00FF00)
    .setDescription(`**${amount}** あんこドルを口座から出金しました。`)
    .addFields(
      { name: '💰 所持金', value: `${result.walletBalance} あんこドル`, inline: true },
      { name: '🏦 口座残高', value: `${result.bankBalance} あんこドル`, inline: true }
    )
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleStealButton(interaction) {
  const guildId = interaction.guild.id;
  const settings = await getAjackSettings(guildId);
  
  const embed = new EmbedBuilder()
    .setTitle('💰 盗む')
    .setColor(0xFF0000)
    .setDescription('**他のユーザーの所持金を盗みます**\n\n⚠️ 口座に預けたお金は盗めません。\n⚠️ 失敗すると罰金が発生します！')
    .addFields(
      { name: '📊 成功率', value: `${settings.stealSuccessRate}%`, inline: true },
      { name: '💵 盗める割合', value: `${settings.stealPercentage}%`, inline: true },
      { name: '💸 失敗時の罰金', value: `${settings.stealFailurePenalty} あんこドル`, inline: true }
    )
    .setTimestamp();
  
  const row = new ActionRowBuilder()
    .addComponents(
      new UserSelectMenuBuilder()
        .setCustomId('ajack_steal_select')
        .setPlaceholder('盗む対象を選択')
        .setMaxValues(1)
    );
  
  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true
  });
}

async function handleStealSelect(interaction) {
  const thiefId = interaction.user.id;
  const targetId = interaction.values[0];
  const guildId = interaction.guild.id;
  
  if (thiefId === targetId) {
    return interaction.update({
      content: '❌ 自分自身から盗むことはできません。',
      embeds: [],
      components: []
    });
  }
  
  await interaction.deferUpdate();
  
  const result = await stealFrom(thiefId, targetId, guildId);
  
  if (!result.success) {
    if (result.error === 'on_cooldown') {
      await interaction.editReply({
        content: `❌ クールダウン中です。\n⏰ 残り時間: ${result.minutesLeft}分${result.secondsLeft}秒`,
        embeds: [],
        components: []
      });
      return;
    }
    if (result.error === 'target_no_money') {
      await interaction.editReply({
        content: `❌ <@${targetId}>の所持金がありません。`,
        embeds: [],
        components: []
      });
      return;
    }
    if (result.error === 'target_too_poor') {
      await interaction.editReply({
        content: `❌ <@${targetId}>の所持金が少なすぎます。`,
        embeds: [],
        components: []
      });
      return;
    }
  }
  
  if (result.stealSuccess) {
    const embed = new EmbedBuilder()
      .setTitle('✅ 盗み成功！')
      .setColor(0x00FF00)
      .setDescription(`**<@${targetId}>** から **${result.stolenAmount}** あんこドルを盗みました！`)
      .addFields(
        { name: '💰 あなたの所持金', value: `${result.thiefBalance} あんこドル`, inline: true },
        { name: '💸 相手の所持金', value: `${result.targetBalance} あんこドル`, inline: true }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed], components: [] });
    
    try {
      const targetUser = await interaction.guild.members.fetch(targetId);
      if (targetUser) {
        await targetUser.send(`💰 <@${thiefId}>があなたから **${result.stolenAmount}** あんこドルを盗みました！\n💡 ヒント: 銀行口座に預けたお金は盗まれません。`).catch(() => {});
      }
    } catch (error) {
    }
  } else {
    const embed = new EmbedBuilder()
      .setTitle('❌ 盗み失敗！')
      .setColor(0xFF0000)
      .setDescription(`盗みに失敗しました。罰金として **${result.penalty}** あんこドルが引かれました。`)
      .addFields(
        { name: '💰 あなたの所持金', value: `${result.thiefBalance} あんこドル`, inline: true }
      )
      .setTimestamp();
    
    if (result.debtLimitReached) {
      embed.setDescription(`盗みに失敗しました。罰金を支払おうとしましたが、借金制限に達しているため一部しか引かれませんでした。`);
    }
    
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

async function handleTransferButton(interaction) {
  const userId = interaction.user.id;
  const balance = await getUserBalance(userId);
  
  const embed = new EmbedBuilder()
    .setTitle('💸 送金')
    .setColor(0x5865F2)
    .setDescription('**他のユーザーにあんこドルを送ります**\n\n所持金から送金されます。')
    .addFields(
      { name: '💰 現在の所持金', value: `${balance} あんこドル`, inline: true }
    )
    .setTimestamp();
  
  const row = new ActionRowBuilder()
    .addComponents(
      new UserSelectMenuBuilder()
        .setCustomId('ajack_transfer_select')
        .setPlaceholder('送金先を選択')
        .setMaxValues(1)
    );
  
  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true
  });
}

async function handleTransferSelect(interaction) {
  const targetId = interaction.values[0];
  
  if (interaction.user.id === targetId) {
    return interaction.update({
      content: '❌ 自分自身に送金することはできません。',
      embeds: [],
      components: []
    });
  }
  
  const modal = new ModalBuilder()
    .setCustomId(`ajack_transfer_modal:${targetId}`)
    .setTitle('送金');
  
  const amountInput = new TextInputBuilder()
    .setCustomId('transfer_amount')
    .setLabel('送金額（あんこドル）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 1000')
    .setRequired(true);
  
  modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
  
  await interaction.showModal(modal);
}

async function handleTransferModal(interaction) {
  const userId = interaction.user.id;
  const targetId = interaction.customId.split(':')[1];
  const amount = parseInt(interaction.fields.getTextInputValue('transfer_amount'));
  
  if (isNaN(amount) || amount <= 0) {
    return interaction.reply({
      content: '❌ 無効な金額です。正の整数を入力してください。',
      ephemeral: true
    });
  }
  
  const result = await transferWallet(userId, targetId, amount);
  
  if (!result.success) {
    if (result.error === 'insufficient_funds') {
      return interaction.reply({
        content: `❌ 所持金が不足しています。\n💰 現在の所持金: **${result.balance}** あんこドル`,
        ephemeral: true
      });
    }
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
      { name: '💰 あなたの所持金', value: `${result.fromBalance} あんこドル`, inline: true }
    )
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
  
  try {
    const targetUser = await interaction.guild.members.fetch(targetId);
    if (targetUser) {
      await targetUser.send(`💸 <@${userId}>があなたに **${amount}** あんこドルを送金しました！`).catch(() => {});
    }
  } catch (error) {
  }
}

async function handleRankingButton(interaction) {
  const { getAllUsersBalances } = require('../storage/fileStorage');
  const allBalances = await getAllUsersBalances();
  
  await interaction.guild.members.fetch().catch(() => {});
  const guildMemberIds = new Set(interaction.guild.members.cache.keys());
  
  const guildBalances = Array.from(allBalances.entries())
    .filter(([userId]) => guildMemberIds.has(userId))
    .map(([userId, data]) => ({
      userId,
      total: data.total,
      wallet: data.wallet,
      bank: data.bank
    }))
    .sort((a, b) => b.total - a.total);

  if (guildBalances.length === 0) {
    return interaction.reply({
      content: '❌ このサーバーにランキングデータがありません。',
      ephemeral: true
    });
  }

  const rankings = guildBalances.slice(0, 10);
  let description = '**サーバー内のお金持ちランキング TOP 10**\n\n';
  
  const medals = ['🥇', '🥈', '🥉'];
  rankings.forEach((rank, index) => {
    const medal = medals[index] || `${index + 1}.`;
    const isCurrentUser = rank.userId === interaction.user.id;
    const highlight = isCurrentUser ? '**→ ' : '';
    const highlightEnd = isCurrentUser ? ' ←**' : '';
    
    description += `${medal} ${highlight}<@${rank.userId}>: **${rank.total}** あんこドル${highlightEnd}\n`;
    description += `    💰 手持ち: ${rank.wallet} | 🏦 銀行: ${rank.bank}\n\n`;
  });

  const userRankData = rankings.find(r => r.userId === interaction.user.id);
  if (!userRankData) {
    const currentUserBalance = await getUserBalance(interaction.user.id);
    const currentUserBank = await getBankBalance(interaction.user.id);
    const currentUserTotal = currentUserBalance + currentUserBank;
    const userPosition = guildBalances.findIndex(u => u.userId === interaction.user.id) + 1;
    
    if (userPosition > 0) {
      description += `\n📊 **あなたの順位**: ${userPosition}位\n`;
      description += `💰 総資産: **${currentUserTotal}** あんこドル`;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('🏆 お金持ちランキング')
    .setColor(0xFFD700)
    .setDescription(description)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handlePvPBlackjackButton(interaction) {
  const pendingInvite = getPendingInvite(interaction.user.id);
  if (pendingInvite) {
    const embed = new EmbedBuilder()
      .setTitle('⚔️ フレンド対戦の招待')
      .setColor(0xFFD700)
      .setDescription(`**<@${pendingInvite.challengerId}>** から対戦の招待が届いています！\n\n💰 ベット額: **${pendingInvite.bet}** あんこドル\n\n受け入れますか？`)
      .setTimestamp();

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`ajack_pvp_accept:${pendingInvite.inviteId}`)
          .setLabel('✅ 受け入れる')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`ajack_pvp_reject:${pendingInvite.inviteId}`)
          .setLabel('❌ 拒否する')
          .setStyle(ButtonStyle.Danger)
      );

    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  const activePvPGame = getActivePvPGame(interaction.user.id);
  if (activePvPGame) {
    return displayPvPGame(interaction, activePvPGame);
  }

  const modal = new ModalBuilder()
    .setCustomId('ajack_pvp_bet_modal')
    .setTitle('フレンド対戦 - ベット額入力');

  const betInput = new TextInputBuilder()
    .setCustomId('pvp_bet')
    .setLabel('ベット額（あんこドル）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 1000')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(betInput));

  await interaction.showModal(modal);
}

async function handlePvPBetModal(interaction) {
  const bet = parseInt(interaction.fields.getTextInputValue('pvp_bet'));

  if (isNaN(bet) || bet <= 0) {
    return interaction.reply({
      content: '❌ 無効なベット額です。正の整数を入力してください。',
      ephemeral: true
    });
  }

  const balance = await getUserBalance(interaction.user.id);
  if (balance < bet) {
    return interaction.reply({
      content: `❌ 残高が不足しています。\n現在の残高: **${balance}** あんこドル`,
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('⚔️ フレンド対戦 - 対戦相手を選択')
    .setColor(0x5865F2)
    .setDescription(`**ベット額: ${bet} あんこドル**\n\n対戦する相手を選択してください：`)
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(`ajack_pvp_opponent:${bet}`)
        .setPlaceholder('対戦相手を選択')
        .setMaxValues(1)
    );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handlePvPOpponentSelect(interaction) {
  const bet = parseInt(interaction.customId.split(':')[1]);
  const opponentId = interaction.values[0];

  if (opponentId === interaction.user.id) {
    return interaction.update({
      content: '❌ 自分自身に対戦を申し込むことはできません。',
      components: [],
      embeds: []
    });
  }

  await interaction.deferUpdate();

  const result = await createPvPInvite(interaction.user.id, opponentId, bet);

  if (!result.success) {
    if (result.error === 'insufficient_funds') {
      return interaction.editReply({
        content: `❌ 残高が不足しています。\n現在の残高: **${result.balance}** あんこドル`,
        components: [],
        embeds: []
      });
    }
    if (result.error === 'opponent_insufficient_funds') {
      return interaction.editReply({
        content: `❌ 対戦相手の残高が不足しています。\n相手の残高: **${result.balance}** あんこドル`,
        components: [],
        embeds: []
      });
    }
    return interaction.editReply({
      content: '❌ 対戦の申し込みに失敗しました。',
      components: [],
      embeds: []
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ 対戦を申し込みました！')
    .setColor(0x00FF00)
    .setDescription(`<@${opponentId}> に対戦を申し込みました。\n\n💰 ベット額: **${bet}** あんこドル\n\n相手が受け入れるまでお待ちください。`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [] });

  try {
    const opponent = await interaction.client.users.fetch(opponentId);
    const inviteEmbed = new EmbedBuilder()
      .setTitle('⚔️ フレンド対戦の招待')
      .setColor(0xFFD700)
      .setDescription(`**<@${interaction.user.id}>** から対戦の招待が届いています！\n\n💰 ベット額: **${bet}** あんこドル\n\n/ajack コマンドで招待を確認してください。`)
      .setTimestamp();

    await opponent.send({ embeds: [inviteEmbed] }).catch(() => {});
  } catch (error) {
    console.error('PvP招待DM送信エラー:', error);
  }
}

async function handlePvPInviteAccept(interaction) {
  const inviteId = interaction.customId.split(':')[1];

  await interaction.deferUpdate();

  const result = await acceptPvPInvite(inviteId);

  if (!result.success) {
    if (result.error === 'invite_not_found') {
      return interaction.editReply({
        content: '❌ 招待が見つかりませんでした。',
        components: [],
        embeds: []
      });
    }
    if (result.error === 'challenger_insufficient_funds') {
      return interaction.editReply({
        content: `❌ 挑戦者の残高が不足しています。`,
        components: [],
        embeds: []
      });
    }
    if (result.error === 'opponent_insufficient_funds') {
      return interaction.editReply({
        content: `❌ あなたの残高が不足しています。\n現在の残高: **${result.balance}** あんこドル`,
        components: [],
        embeds: []
      });
    }
    return interaction.editReply({
      content: '❌ 対戦の開始に失敗しました。',
      components: [],
      embeds: []
    });
  }

  if (result.result === 'win' || result.result === 'draw') {
    const color = result.result === 'win' ? (result.winnerId === interaction.user.id ? 0x00FF00 : 0xFF0000) : 0xFFFF00;
    const title = result.result === 'draw' ? '引き分け！' : (result.winnerId === interaction.user.id ? 'あなたの勝ちです！' : '相手の勝ちです！');

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ フレンド対戦 - ${title}`)
      .setColor(color)
      .addFields(
        { name: `🎴 <@${result.game.challengerId}> の手札`, value: `${result.challengerHand} (${result.challengerValue})`, inline: true },
        { name: `🎴 <@${result.game.opponentId}> の手札`, value: `${result.opponentHand} (${result.opponentValue})`, inline: true },
        { name: '💸 配当', value: `${result.payout} あんこドル`, inline: true }
      )
      .setDescription(`**${result.message}**\n\n両者ともブラックジャック！`)
      .setTimestamp();

    const newBalance = await getUserBalance(interaction.user.id);
    embed.setFooter({ text: `残高: ${newBalance} あんこドル` });

    return interaction.editReply({ embeds: [embed], components: [] });
  }

  return displayPvPGame(interaction, result.game, true);
}

async function handlePvPInviteReject(interaction) {
  const inviteId = interaction.customId.split(':')[1];

  await interaction.deferUpdate();

  const result = await rejectPvPInvite(inviteId);

  if (!result.success) {
    return interaction.editReply({
      content: '❌ 招待の拒否に失敗しました。',
      components: [],
      embeds: []
    });
  }

  await interaction.editReply({
    content: '✅ 対戦の招待を拒否しました。',
    components: [],
    embeds: []
  });
}

async function handlePvPHit(interaction) {
  const gameId = interaction.customId.split(':')[1];
  const userId = interaction.user.id;

  const activePvPGame = getActivePvPGame(userId);
  if (!activePvPGame || activePvPGame.gameId !== gameId) {
    return interaction.reply({
      content: '❌ あなたの進行中のゲームではありません。このボタンは使用できません。',
      ephemeral: true
    });
  }

  await interaction.deferUpdate();

  const result = await hitPvP(gameId, userId);

  if (!result.success) {
    let errorMessage = '❌ カードを引くことができませんでした。';
    
    if (result.error === 'not_your_turn') {
      errorMessage = '❌ 今はあなたのターンではありません。相手の行動を待ってください。';
    } else if (result.error === 'already_stood') {
      errorMessage = '❌ 既にスタンドしています。';
    } else if (result.error === 'game_not_found') {
      errorMessage = '❌ ゲームが見つかりませんでした。';
    } else if (result.error === 'game_already_finished') {
      errorMessage = '❌ ゲームは既に終了しています。';
    }
    
    return interaction.editReply({
      content: errorMessage,
      components: []
    });
  }

  if (result.result === 'win') {
    const isWinner = result.winnerId === interaction.user.id;
    const color = isWinner ? 0x00FF00 : 0xFF0000;
    const title = isWinner ? 'あなたの勝ちです！' : '相手の勝ちです！';

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ フレンド対戦 - ${title}`)
      .setColor(color)
      .addFields(
        { name: `🎴 挑戦者の手札`, value: `${result.challengerHand} (${result.challengerValue})`, inline: true },
        { name: `🎴 対戦相手の手札`, value: `${result.opponentHand} (${result.opponentValue})`, inline: true },
        { name: '💸 配当', value: `${result.payout} あんこドル`, inline: true },
        { name: '📈 利益', value: `${isWinner ? '+' : '-'}${result.profit} あんこドル`, inline: true }
      )
      .setDescription(`**${result.message}**\n\nバースト！21を超えました...`)
      .setTimestamp();

    const newBalance = await getUserBalance(interaction.user.id);
    embed.setFooter({ text: `残高: ${newBalance} あんこドル` });

    return interaction.editReply({ embeds: [embed], components: [] });
  }

  const game = {
    gameId: result.gameId,
    challengerId: result.isPvP ? result.gameId.split('-')[1] : null,
    opponentId: result.isPvP ? result.gameId.split('-')[2] : null,
    challengerHand: result.challengerHand,
    challengerValue: result.challengerValue,
    opponentHand: result.opponentHand,
    opponentValue: result.opponentValue
  };

  return displayPvPGame(interaction, game, true);
}

async function handlePvPStand(interaction) {
  const gameId = interaction.customId.split(':')[1];
  const userId = interaction.user.id;

  const activePvPGame = getActivePvPGame(userId);
  if (!activePvPGame || activePvPGame.gameId !== gameId) {
    return interaction.reply({
      content: '❌ あなたの進行中のゲームではありません。このボタンは使用できません。',
      ephemeral: true
    });
  }

  await interaction.deferUpdate();

  const result = await standPvP(gameId, userId);

  if (!result.success) {
    let errorMessage = '❌ スタンドできませんでした。';
    
    if (result.error === 'not_your_turn') {
      errorMessage = '❌ 今はあなたのターンではありません。相手の行動を待ってください。';
    } else if (result.error === 'already_stood') {
      errorMessage = '❌ 既にスタンドしています。';
    } else if (result.error === 'game_not_found') {
      errorMessage = '❌ ゲームが見つかりませんでした。';
    } else if (result.error === 'game_already_finished') {
      errorMessage = '❌ ゲームは既に終了しています。';
    }
    
    return interaction.editReply({
      content: errorMessage,
      components: []
    });
  }

  if (result.waiting) {
    const embed = new EmbedBuilder()
      .setTitle('⚔️ フレンド対戦 - 待機中')
      .setColor(0xFFFF00)
      .addFields(
        { name: `🎴 挑戦者の手札`, value: `${result.challengerHand} (${result.challengerValue})`, inline: true },
        { name: `🎴 対戦相手の手札`, value: `${result.opponentHand} (${result.opponentValue})`, inline: true }
      )
      .setDescription('**あなたはスタンドしました！**\n\n相手の行動を待っています...')
      .setTimestamp();

    return interaction.editReply({ embeds: [embed], components: [] });
  }

  if (result.result === 'win' || result.result === 'draw') {
    const isWinner = result.result === 'win' && result.winnerId === interaction.user.id;
    const color = result.result === 'draw' ? 0xFFFF00 : (isWinner ? 0x00FF00 : 0xFF0000);
    const title = result.result === 'draw' ? '引き分け！' : (isWinner ? 'あなたの勝ちです！' : '相手の勝ちです！');

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ フレンド対戦 - ${title}`)
      .setColor(color)
      .addFields(
        { name: `🎴 挑戦者の手札`, value: `${result.challengerHand} (${result.challengerValue})`, inline: true },
        { name: `🎴 対戦相手の手札`, value: `${result.opponentHand} (${result.opponentValue})`, inline: true },
        { name: '💸 配当', value: `${result.payout} あんこドル`, inline: true }
      )
      .setDescription(`**${result.message}**`)
      .setTimestamp();

    if (result.result === 'win') {
      embed.addFields({ name: '📈 利益', value: `${isWinner ? '+' : '-'}${result.profit} あんこドル`, inline: true });
    }

    const newBalance = await getUserBalance(interaction.user.id);
    embed.setFooter({ text: `残高: ${newBalance} あんこドル` });

    return interaction.editReply({ embeds: [embed], components: [] });
  }
}

async function displayPvPGame(interaction, game, isUpdate = false) {
  const isChallenger = interaction.user.id === game.challengerId;
  const yourHand = isChallenger ? game.challengerHand : game.opponentHand;
  const yourValue = isChallenger ? game.challengerValue : game.opponentValue;
  const opponentHand = isChallenger ? game.opponentHand : game.challengerHand;
  const opponentValue = isChallenger ? game.opponentValue : game.challengerValue;
  
  const isYourTurn = game.currentTurn === interaction.user.id;
  const turnIndicator = isYourTurn ? '🟢 **あなたのターン**' : '🔴 **相手のターン**';

  const embed = new EmbedBuilder()
    .setTitle('⚔️ フレンド対戦 - ブラックジャック')
    .setColor(isYourTurn ? 0x00FF00 : 0xFF0000)
    .addFields(
      { name: '🎴 あなたの手札', value: `${yourHand} (${yourValue})`, inline: true },
      { name: '🎴 相手の手札', value: `${opponentHand} (${opponentValue})`, inline: true },
      { name: '💰 ベット額', value: `${game.bet} あんこドル`, inline: true }
    )
    .setDescription(`${turnIndicator}\n\n**ヒットしますか？スタンドしますか？**\n\nフレンド対戦では **2倍** の配当です！`)
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`ajack_pvp_hit:${game.gameId}`)
        .setLabel('🎴 ヒット')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`ajack_pvp_stand:${game.gameId}`)
        .setLabel('✋ スタンド')
        .setStyle(ButtonStyle.Danger)
    );

  if (isUpdate) {
    await interaction.editReply({ embeds: [embed], components: [row] });
  } else {
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
}

async function handleCustomBetModal(interaction) {
  const bet = parseInt(interaction.fields.getTextInputValue('custom_bet'));
  const userId = interaction.user.id;

  if (isNaN(bet) || bet <= 0) {
    return interaction.reply({
      content: '❌ 無効なベット額です。正の整数を入力してください。',
      ephemeral: true
    });
  }

  const activeGame = getActiveGame(userId);
  if (activeGame) {
    return interaction.reply({
      content: '❌ 既に進行中のゲームがあります。',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const result = await createGame(userId, bet, true, null, interaction.guild.id);
  
  if (!result.success) {
    if (result.error === 'debt_limit_exceeded') {
      await interaction.editReply({
        content: `❌ 借金制限に達しています。\n現在の残高: **${result.balance}** あんこドル\n借金制限: **${result.limit}** あんこドル`
      });
      return;
    }
    await interaction.editReply({
      content: '❌ ゲームの開始に失敗しました。'
    });
    return;
  }

  if (result.result === 'blackjack' || result.result === 'push') {
    const embed = new EmbedBuilder()
      .setTitle('🎰 ブラックジャック')
      .setColor(result.result === 'blackjack' ? 0x00FF00 : 0xFFFF00)
      .addFields(
        { name: '🎴 あなたの手札', value: `${result.playerHand} (${result.playerValue})`, inline: true },
        { name: '🎴 ディーラーの手札', value: `${result.dealerHand} (${result.dealerValue})`, inline: true },
        { name: '💰 ベット額', value: `${bet} あんこドル`, inline: true },
        { name: '💸 配当', value: `${result.payout} あんこドル`, inline: true },
        { name: '📈 利益', value: `${result.profit > 0 ? '+' : ''}${result.profit} あんこドル`, inline: true }
      )
      .setDescription(`**${result.message}**`)
      .setTimestamp();

    const newBalance = await getUserBalance(userId);
    embed.setFooter({ text: `残高: ${newBalance} あんこドル` });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🎰 ブラックジャック')
    .setColor(0x5865F2)
    .addFields(
      { name: '🎴 あなたの手札', value: `${result.game.playerHand} (${result.game.playerValue})`, inline: false },
      { name: '🎴 ディーラーの見えるカード', value: result.game.dealerUpCard, inline: false },
      { name: '💰 ベット額', value: `${result.game.bet} あんこドル`, inline: false }
    )
    .setDescription('**ヒットしますか？スタンドしますか？**')
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('bj_hit')
        .setLabel('🎴 ヒット')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('bj_stand')
        .setLabel('✋ スタンド')
        .setStyle(ButtonStyle.Danger)
    );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

module.exports = {
  createMainPanel,
  handleBlackjackButton,
  handleBetSelect,
  handleAllInButton,
  handleAllInConfirm,
  handleWorkButton,
  handleShopButton,
  handleShopBuy,
  handleInventoryButton,
  handleDailyButton,
  handleBuyRoleButton,
  handleBuyRoleConfirm,
  handleBuyRoleCancel,
  handleBankButton,
  handleBankDeposit,
  handleBankDepositModal,
  handleBankWithdraw,
  handleBankWithdrawModal,
  handleStealButton,
  handleStealSelect,
  handleTransferButton,
  handleTransferSelect,
  handleTransferModal,
  handleRankingButton,
  handlePvPBlackjackButton,
  handlePvPBetModal,
  handlePvPOpponentSelect,
  handlePvPInviteAccept,
  handlePvPInviteReject,
  handlePvPHit,
  handlePvPStand,
  handleCustomBetModal
};
