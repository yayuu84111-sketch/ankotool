# Discord Aanko Bot - 統合版

Discord 多機能 Bot システム（メンバー取得 + /aanko + モデレーション + 経済システム）

## ファイル構成

### メインファイル
- `server.js` - Webサーバー（Express）とAPI エンドポイント
- `bot.js` - メイン Discord Bot（/aanko, /atest, /aadd, /aev コマンド）
- `modbot.js` - モデレーション Bot（スパム対策、経済システム）
- `gateway.js` - Discord Gateway 接続
- `config.js` - 設定ファイル（トークン、デフォルトメッセージ等）

### フォルダ
- `public/` - Webインターフェース（HTML, CSS, JS）
- `storage/` - JSONファイルベースのデータ保存
- `utils/` - ユーティリティ関数群

## 設定変更方法

`config.js` ファイルを編集して設定を変更できます：

```javascript
module.exports = {
    DEFAULT_MESSAGE: `# [あんこちゃんですあんこ鯖では主にピクセルガンの無償代行や荒らしを行っていますスマホ勢荒らし知識がなくても自作あんこアプリで初日から最強荒らし勢になろうピクセルガンも初日で最強になろう](<https://nemtudo.me/e/aTPA>)
# 🤍🩷💚🖤❤️🩵🩶🧡💙💛💜🤎❣️💗💝💓❤️‍🩹❤️‍🔥💞💘💖💕
# 😉あんこちゃんだよ！
# 🩵あんこ鯖では主にピクセルガンの無償代行
# 🧡ワイワイ雑談‼️
# 🩷荒らしを行っています
# 🤍スマホ勢でも荒らし知識がなくても
# 💚自作あんこアプリで最強荒らし勢になろう
# 💜ピクセルガンも初日で最強になろ！
# 🖤 闇落ちあんこちゃん🥹
# https://excessive-chocolate-qomcybqhdz.edgeone.app/IMG_3973.gif
# https://miserable-red-2wlieplbxn.edgeone.app/IMG_3948.gif
# https://democratic-tomato-w8nercfjsr.edgeone.app/IMG_3949.gif
# https://xeric-purple-2nw70kglwu.edgeone.app/IMG_3972.gif
# https://nemtudo.me/e/aTPA
`,
    DIRECT_SEND_DEFAULT_MESSAGE: ``,
    AUTO_BUTTON_DEFAULT_MESSAGE: `# [あんこちゃんですあんこ鯖では主にピクセルガンの無償代行や荒らしを行っていますスマホ勢荒らし知識がなくても自作あんこアプリで初日から最強荒らし勢になろうピクセルガンも初日で最強になろう](<https://nemtudo.me/e/ryNa>)
    # 🤍🩷💚🖤❤️🩵🩶🧡💙💛💜🤎❣️💗💝💓❤️‍🩹❤️‍🔥💞💘💖💕
    # 😉あんこちゃんだよ！
    # 🩵あんこ鯖では主にピクセルガンの無償代行
    # 🧡ワイワイ雑談‼️
    # 🩷荒らしを行っています
    # 🤍スマホ勢でも荒らし知識がなくても
    # 💚自作あんこアプリで最強荒らし勢になろう
    # 💜ピクセルガンも初日で最強になろ！
    # 🖤 闇落ちあんこちゃん🥹
    # https://excessive-chocolate-qomcybqhdz.edgeone.app/IMG_3973.gif
    # https://miserable-red-2wlieplbxn.edgeone.app/IMG_3948.gif
    # https://democratic-tomato-w8nercfjsr.edgeone.app/IMG_3949.gif
    # https://xeric-purple-2nw70kglwu.edgeone.app/IMG_3972.gif
    # https://nemtudo.me/e/aTPA
,
    DEFAULT_MENTION_COUNT: 3,
    RANDOM_CHAR_LENGTH: 64,
    BOT_TOKEN: 'メインBotトークン',
    CLIENT_ID: 'クライアントID',
    BOT_TOKEN_3: 'モデレーションBotトークン',
    PORT: 5000
};
```

## 機能一覧

### アカウント設定（Webインターフェース）
1. **表示名を変更**: Discordの表示名（global_name）を変更
2. **全グループDMから退出**: 参加している全てのグループDMから一括退出

### メインBot (bot.js)
1. **メンバー取得**: Discord サーバーのメンバーIDを取得
2. **/aanko コマンド**: ボタンを押すと5回メッセージを送信（カスタムメッセージ対応）
3. **/atest コマンド**: 外部コマンドがサーバーで使えるかテスト
4. **/aadd コマンド**: カスタムデフォルトメッセージの管理（追加・一覧・削除）
5. **/aev コマンド**: 自分にしか見えない@everyoneを表示
6. **直接実行**: トークンを使って直接メッセージを送信
7. **自動ボタンクリック**: ボタン作成＆自動実行
8. **ランダム文字挿入**: メッセージに多言語ランダム文字を追加

## /aadd カスタムメッセージ機能

自分専用のカスタムデフォルトメッセージを作成・管理できます：

1. **/aadd add content:[メッセージ] title:[タイトル]** - 新しいカスタムメッセージを保存（タイトルは任意）
2. **/aadd list** - 自分のカスタムメッセージ一覧を表示（タイトル付きで表示）
3. **/aadd delete id:[メッセージID]** - 指定したメッセージを削除

カスタムメッセージは各ユーザー専用で、他のユーザーからは使えません。

## /aanko でカスタムメッセージを使う

**簡単な方法（おすすめ）:**
- `/aanko use_custom:True` - 最新のカスタムメッセージを自動で使用

**タイトルで指定する場合（おすすめ）:**
1. `/aadd add content:メッセージ title:あいさつ` でタイトル付きで作成
2. `/aanko custom_id:あいさつ` でタイトルを入力するだけで使用

**IDで指定する場合:**
1. `/aadd add` でカスタムメッセージを作成
2. `/aadd list` でメッセージIDを確認
3. `/aanko custom_id:[ID]` でそのメッセージを使用

### モデレーションBot (modbot.js)
1. **/apanel**: コントロールパネル
2. **/asettings**: 設定パネル（スパム対策、コンテンツ管理）
3. **/aban, /akick, /atimeout**: モデレーションコマンド
4. **/ajack**: あんこジャック経済ゲーム
5. **/ajacksetting**: 経済システム設定
6. **/aid**: 許可ユーザー管理

### 経済システム（あんこジャック）
- ブラックジャック
- デイリーボーナス
- ワーク（労働報酬）
- ショップ＆インベントリ
- チャット報酬

### グループDM作成機能（Webインターフェース）
フレンドとのグループDMを高速で連続作成できます：

**設定項目:**
- **フレンドID**: 2人以上のフレンドIDを指定（カンマ or 改行区切り）
- **グループ名**: 任意のグループ名（空欄でデフォルト）
- **グループアイコンURL**: 画像URLを指定（任意）
- **作成回数**: 連続で何回グループを作成するか（1回～）
- **作成間隔（秒）**: 各作成の間隔（デフォルト1秒）
- **お知らせメッセージ**: グループに自動でメッセージを送る
- **作成後に自動で抜ける**: 自動でグループから退出

**使い方:**
1. トークンを入力
2. フレンドIDを2人以上入力
3. 作成回数と間隔を設定
4. 「グループDMを作成」ボタンをクリック
5. 進捗バーで進行状況を確認
6. 途中で「停止」ボタンで中断可能

## /atest 外部コマンドテスト

サーバーで外部アプリコマンドが有効か無効かを確認する機能：

1. Webインターフェースの「外部コマンドテスト」セクションでチャンネルIDを入力
2. 「外部コマンドをテスト」ボタンをクリック
3. システムがユーザートークンを使って自動で `/atest` コマンドを実行
4. 結果を確認

## ランダム文字挿入機能

- 韓国語、中国語、日本語、ロシア語、アラビア語など多言語文字
- 「# 」で始まる行の後にランダム配置
- URLを含む行は除外

## 起動方法

`node server.js` で起動（自動設定済み）

## 高速並列ボタンAPI

`/api/fast-parallel-button` エンドポイントで全チャンネルに同時にボタンを作成・クリック：

```json
POST /api/fast-parallel-button
{
  "token": "ユーザートークン",
  "channelIds": ["チャンネルID1", "チャンネルID2", ...],
  "guildId": "サーバーID",
  "message": "カスタムメッセージ",
  "userIds": ["ユーザーID1", "ユーザーID2"],
  "mentionCount": 2,
  "clickCount": 5,
  "clickDelayMs": 200
}
```

### 処理フロー
1. **Phase 1**: 全チャンネルに並列でボタン作成（100msスタガー）
2. **Phase 2**: webhookからメッセージIDを取得（エフェメラル対応）
3. **Phase 3**: 全ボタンを並列でクリック（指定回数）

### 技術詳細
- `recentButtonCreations` Mapでボタンデータを保存
- `buttonPayloadStore` Mapでペイロード（userIds, mentionCount, message）を保存
- エフェメラルメッセージの場合、`interactionToken`からメッセージIDを取得
- ボタンクリック時、複数のフォールバック機構でペイロードを検索

## メッセージ記録・再送信機能（Webインターフェース）

チャンネルからメッセージを記録して、別のチャンネルに再送信できます：

**記録（Record）:**
1. トークンを入力
2. 記録元チャンネルIDを入力（「チャンネルID取得」ボタンで自動取得可能）
3. 取得するメッセージ数を指定（1-100）
4. 「メッセージを記録」ボタンをクリック

**再送信（Replay）:**
1. 記録キーが自動入力される
2. 送信先チャンネルIDを入力（「チャンネルID取得」ボタンで自動取得可能）
3. オプション：追加メッセージ、メンション、@everyone、ランダム文字など
4. 「メッセージを送信」ボタンをクリック

**技術詳細:**
- 記録データはファイルに永続化（サーバー再起動後も保持）
- 記録から1時間後に自動削除（ファイル容量増加防止）
- storage/recorded_messages.json に保存

## 注意事項

- 環境変数は不要（全て config.js に統合）
- storage/ フォルダ内のJSONファイルでデータ永続化
- レート制限回避のため、チャンネル間に100msの遅延あり
