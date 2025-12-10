const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createGame, hit, stand, getActiveGame, cancelGame } = require('./blackjack');
const { getUserBalance, claimDaily, INITIAL_BALANCE, DAILY_BONUS } = require('./ankoDollar');

async function handleBjStart(interaction) {
  const bet = interaction.options.getInteger('bet');
  const userId = interaction.user.id;

  const activeGame = getActiveGame(userId);
  if (activeGame) {
    return interaction.reply({
      content: '❌ 既に進行中のゲームがあります。先に /bjhit または /bjstand でゲームを終了してください。',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  let result;
  try {
    result = await createGame(userId, bet, true, null, interaction.guild.id);
  } catch (error) {
    console.error('ゲーム作成エラー:', error);
    await interaction.editReply({
      content: '❌ ゲームの開始に失敗しました。時間をおいてもう一度お試しください。'
    }).catch(() => {});
    return;
  }

  if (!result.success) {
    if (result.error === 'insufficient_funds') {
      await interaction.editReply({
        content: `❌ 残高が不足しています。\n現在の残高: **${result.balance}** あんこドル`
      }).catch(() => {});
      return;
    }
    if (result.error === 'debt_limit_exceeded') {
      await interaction.editReply({
        content: `❌ 借金制限に達しています。\n現在の残高: **${result.balance}** あんこドル\n借金制限: **${result.limit}** あんこドル`
      }).catch(() => {});
      return;
    }
    await interaction.editReply({
      content: '❌ ゲームの開始に失敗しました。'
    }).catch(() => {});
    return;
  }

  let gameId = null;
  try {
    if (result.result === 'blackjack' || result.result === 'push') {
      gameId = result.gameId;
      try {
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
      } catch (replyError) {
        console.error('即座決済の結果表示エラー:', replyError);
      }
      return;
    }

    gameId = result.game.gameId;
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
  } catch (error) {
    console.error('ゲーム表示エラー:', error);
    if (gameId) {
      await cancelGame(gameId);
    }
    await interaction.editReply({
      content: '❌ エラーが発生しました。ベットは返金されました。'
    }).catch(() => {});
  }
}

async function handleBjHit(interaction) {
  const userId = interaction.user.id;
  const activeGame = getActiveGame(userId);

  if (!activeGame) {
    return interaction.reply({
      content: '❌ 進行中のゲームがありません。/bjstart でゲームを開始してください。',
      ephemeral: true
    });
  }

  const isButton = interaction.isButton();
  if (isButton) {
    await interaction.deferUpdate();
  } else {
    await interaction.deferReply({ ephemeral: true });
  }

  let result;
  try {
    result = await hit(activeGame.gameId);

    if (!result.success) {
      await interaction.editReply({
        content: '❌ カードを引くことができませんでした。',
        components: []
      });
      return;
    }

    if (result.bust) {
      try {
        const embed = new EmbedBuilder()
          .setTitle('🎰 ブラックジャック - バースト！')
          .setColor(0xFF0000)
          .addFields(
            { name: '🎴 あなたの手札', value: `${result.playerHand} (${result.playerValue})`, inline: true },
            { name: '🎴 ディーラーの手札', value: `${result.dealerHand} (${result.dealerValue})`, inline: true },
            { name: '📈 利益', value: `${result.profit} あんこドル`, inline: true }
          )
          .setDescription(`**${result.message}**`)
          .setTimestamp();

        const newBalance = await getUserBalance(userId);
        embed.setFooter({ text: `残高: ${newBalance} あんこドル` });

        await interaction.editReply({ embeds: [embed], components: [] });
      } catch (replyError) {
        console.error('バースト結果表示エラー:', replyError);
      }
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎰 ブラックジャック')
      .setColor(0x5865F2)
      .addFields(
        { name: '🎴 あなたの手札', value: `${result.playerHand} (${result.playerValue})`, inline: false },
        { name: '🎴 ディーラーの見えるカード', value: result.dealerUpCard, inline: false }
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
  } catch (error) {
    console.error('ヒット処理エラー:', error);
    await cancelGame(activeGame.gameId);
    return interaction.editReply({
      content: '❌ エラーが発生しました。ゲームは中止され、ベットは返金されました。',
      components: []
    }).catch(() => {});
  }
}

async function handleBjStand(interaction) {
  const userId = interaction.user.id;
  const activeGame = getActiveGame(userId);

  if (!activeGame) {
    return interaction.reply({
      content: '❌ 進行中のゲームがありません。/bjstart でゲームを開始してください。',
      ephemeral: true
    });
  }

  const isButton = interaction.isButton();
  if (isButton) {
    await interaction.deferUpdate();
  } else {
    await interaction.deferReply({ ephemeral: true });
  }

  let result;
  try {
    result = await stand(activeGame.gameId);

    if (!result.success) {
      await interaction.editReply({
        content: '❌ スタンドできませんでした。',
        components: []
      });
      return;
    }
  } catch (error) {
    console.error('スタンド処理エラー:', error);
    await cancelGame(activeGame.gameId);
    await interaction.editReply({
      content: '❌ エラーが発生しました。ゲームは中止され、ベットは返金されました。',
      components: []
    }).catch(() => {});
    return;
  }

  try {
    let color;
    if (result.result === 'win') {
      color = 0x00FF00;
    } else if (result.result === 'lose') {
      color = 0xFF0000;
    } else {
      color = 0xFFFF00;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎰 ブラックジャック - ${result.result === 'win' ? '勝利！' : result.result === 'lose' ? '敗北...' : '引き分け'}`)
      .setColor(color)
      .addFields(
        { name: '🎴 あなたの手札', value: `${result.playerHand} (${result.playerValue})`, inline: true },
        { name: '🎴 ディーラーの手札', value: `${result.dealerHand} (${result.dealerValue})`, inline: true },
        { name: '💸 配当', value: `${result.payout} あんこドル`, inline: true },
        { name: '📈 利益', value: `${result.profit > 0 ? '+' : ''}${result.profit} あんこドル`, inline: true }
      )
      .setDescription(`**${result.message}**`)
      .setTimestamp();

    const newBalance = await getUserBalance(userId);
    embed.setFooter({ text: `残高: ${newBalance} あんこドル` });

    await interaction.editReply({ embeds: [embed], components: [] });
  } catch (replyError) {
    console.error('スタンド結果表示エラー:', replyError);
  }
}

async function handleBjBalance(interaction) {
  const userId = interaction.user.id;
  const balance = await getUserBalance(userId);

  const embed = new EmbedBuilder()
    .setTitle('💰 あんこドル残高')
    .setColor(0xFFD700)
    .setDescription(`**${balance}** あんこドル`)
    .addFields(
      { name: 'ℹ️ 初期ボーナス', value: `新規ユーザーには ${INITIAL_BALANCE} あんこドルが付与されます`, inline: false },
      { name: '🎁 デイリーボーナス', value: `/bjdaily で毎日 ${DAILY_BONUS} あんこドルを受け取れます`, inline: false }
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

async function handleBjDaily(interaction) {
  const userId = interaction.user.id;

  await interaction.deferReply();

  const result = await claimDaily(userId);

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

async function handleBjButton(interaction) {
  const userId = interaction.user.id;
  const activeGame = getActiveGame(userId);

  if (!activeGame) {
    return interaction.reply({
      content: '❌ あなたの進行中のゲームがありません。このボタンは使用できません。',
      ephemeral: true
    });
  }

  if (interaction.customId === 'bj_hit') {
    return handleBjHit(interaction);
  } else if (interaction.customId === 'bj_stand') {
    return handleBjStand(interaction);
  }
}

module.exports = {
  handleBjStart,
  handleBjHit,
  handleBjStand,
  handleBjBalance,
  handleBjDaily,
  handleBjButton
};
