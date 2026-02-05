# Agent 365 SDK 統合ガイド

このドキュメントでは、Microsoft Agent 365 SDK の統合方法と、本プロジェクトでの実装パターンについて説明します。

## 📦 統合されたパッケージ

### コアパッケージ

```json
{
  "@microsoft/teams-ai": "^1.5.0",
  "@microsoft/adaptivecards-tools": "^1.1.0",
  "adaptivecards": "^3.0.4",
  "botbuilder": "^4.23.1",
  "botbuilder-core": "^4.23.1"
}
```

### 主要コンポーネント

1. **Bot Framework Adapter** (`src/agent365/bot-adapter.ts`)
   - Microsoft Bot Framework との通信を処理
   - エラーハンドリングとトレース機能を提供

2. **Activity Handler** (`src/agent365/activity-handler.ts`)
   - Bot Framework Activity パターンに基づいた実装
   - メッセージ処理・会員追加イベント等を管理
   - OpenTelemetry との統合

3. **Adaptive Cards** (`src/agent365/adaptive-cards.ts`)
   - リッチな UI カードの生成
   - Teams / Copilot Studio での表示最適化

## 🔧 アーキテクチャ

### リクエストフロー

```
Copilot Studio / Teams
        ↓
    /api/messages
        ↓
   [Format Detection]
        ↓
    ┌───────────┴───────────┐
    ↓                       ↓
Bot Activity          JSON Request
(Agent 365 SDK)       (Direct API)
    ↓                       ↓
Activity Handler      Auth Middleware
    ↓                       ↓
[Processing Logic - 共通]
    ↓
Response (Adaptive Card / JSON)
```

### デュアルモード対応

本実装は以下の 2 つのモードをサポートします：

#### 1. **Bot Framework Activity モード**（Agent 365 SDK）

Bot Framework の Activity 形式でリクエストを受け取ります：

```json
{
  "type": "message",
  "id": "abc123",
  "timestamp": "2026-02-05T...",
  "serviceUrl": "https://...",
  "channelId": "msteams",
  "from": { "id": "...", "name": "User" },
  "conversation": { "id": "..." },
  "text": "{\"meetingTitle\": \"...\", ...}"
}
```

**特徴:**
- Bot Framework Adapter を使用
- Activity Handler パターンで処理
- Adaptive Cards による応答
- Teams / Copilot Studio の高度な機能を利用可能

#### 2. **Direct JSON モード**（レガシー互換）

標準的な JSON リクエスト：

```json
{
  "meetingTitle": "Q1 Planning",
  "meetingTranscript": "...",
  "approve": false
}
```

**特徴:**
- Entra ID JWT 認証
- シンプルな JSON 応答
- 既存のクライアントとの互換性維持

## 🚀 使用方法

### Copilot Studio での設定

#### Bot Framework モードで接続

1. **Bot チャンネル登録**
   - Azure Portal → **Bot Services** → **Create**
   - Messaging endpoint: `https://<your-tunnel>.devtunnels.ms/api/messages`
   - Microsoft App ID: `API_CLIENT_ID`
   - Password/Secret: `GRAPH_CLIENT_SECRET`

2. **Copilot Studio 設定**
   - 「スキル」→「Bot Framework スキル」を追加
   - Manifest URL を設定（または手動で Bot ID を入力）

3. **環境変数設定**
   ```bash
   BOT_ID=<API_CLIENT_ID>
   BOT_PASSWORD=<GRAPH_CLIENT_SECRET>
   ```

#### Direct JSON モードで接続（従来通り）

README.md の「Copilot Studio との連携手順」を参照してください。

### プログラムからの呼び出し

#### Bot Framework SDK を使用

```typescript
import { TurnContext, ActivityTypes } from 'botbuilder';

const activity = {
  type: ActivityTypes.Message,
  text: JSON.stringify({
    meetingTitle: 'Team Sync',
    meetingTranscript: 'Discussion about Q1 goals...',
    approve: false,
  }),
  from: { id: 'user123', name: 'Alice' },
  recipient: { id: 'bot', name: 'Task Management Agent' },
  conversation: { id: 'conv123' },
  channelId: 'directline',
  serviceUrl: 'https://...',
};

// POST to /api/messages with Bot Framework Activity
```

#### Direct JSON API

```typescript
const response = await fetch('https://.../api/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <JWT>',
  },
  body: JSON.stringify({
    meetingTitle: 'Team Sync',
    meetingTranscript: 'Discussion...',
    approve: false,
  }),
});
```

## 🎨 Adaptive Cards

### 応答の表示

Agent 365 SDK モードでは、Adaptive Cards を使用してリッチな UI を提供します：

- **FactSet**: 集計情報（進捗、決定数、タスク数、リスク数）
- **セクション分け**: 決定/タスク/リスク/フォローアップ質問
- **カラーコーディング**: リスクレベルに応じた色分け
- **インタラクティブ要素**: 将来的にアクション ボタンを追加可能

### カスタマイズ

`src/agent365/adaptive-cards.ts` を編集することで、カードのレイアウトをカスタマイズできます：

```typescript
// アクションボタンの追加例
card.actions = [
  {
    type: 'Action.Submit',
    title: 'Approve All Tasks',
    data: { action: 'approve' },
  },
];
```

## 🔍 トラブルシューティング

### Bot Framework Activity が認識されない

**原因**: リクエストに `type`, `id`, `serviceUrl` フィールドがない

**解決**: Bot Framework Emulator または Direct Line API を使用して正しい形式でリクエストを送信

### "appId or appPassword is required" エラー

**原因**: Bot Framework の認証情報が設定されていない

**解決**: 
```bash
BOT_ID=<your-bot-id>
BOT_PASSWORD=<your-bot-password>
```

### Adaptive Card が表示されない

**原因**: クライアントが Adaptive Cards をサポートしていない

**解決**: Teams / Copilot Studio を使用するか、JSON モードに切り替え

## 📚 参考資料

- [Microsoft 365 Agents SDK](https://learn.microsoft.com/microsoft-365/agents-sdk/)
- [Bot Framework Documentation](https://docs.microsoft.com/azure/bot-service/)
- [Teams AI Library](https://github.com/microsoft/teams-ai)
- [Adaptive Cards](https://adaptivecards.io/)
- [Agent 365 Samples](https://github.com/microsoft/Agent365-Samples)

## 🔄 移行ガイド

### 既存の JSON クライアントから Agent 365 SDK への移行

1. Bot チャンネル登録を作成
2. クライアントを Bot Framework SDK に更新
3. Activity 形式でリクエストを送信
4. Adaptive Cards 形式で応答を受信

完全な移行手順は [MIGRATION.md](./MIGRATION.md) を参照してください。

---

**Note**: Agent 365 SDK は Microsoft の進化する技術スタックです。最新のベストプラクティスについては、公式ドキュメントを確認してください。
