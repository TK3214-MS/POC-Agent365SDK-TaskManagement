# Agent 365 SDK 統合ガイド

このドキュメントでは、Microsoft 365 Agents SDKの統合方法と、本プロジェクトでの実装パターンについて説明します。

## 📦 統合されたパッケージ

### Microsoft 365 Agents SDK（コア）

```json
{
  "@microsoft/agents-activity": "^1.2.2",
  "@microsoft/agents-hosting": "^1.2.2"
}
```

### Agent 365 SDK（拡張機能 - プレビュー）

```json
{
  "@microsoft/agents-a365-notifications": "^0.1.0-preview.30",
  "@microsoft/agents-a365-observability": "^0.1.0-preview.30",
  "@microsoft/agents-a365-observability-hosting": "^0.1.0-preview.64",
  "@microsoft/agents-a365-runtime": "^0.1.0-preview.30",
  "@microsoft/agents-a365-tooling": "^0.1.0-preview.30"
}
```

### 主要コンポーネント

1. **Agent365MessageHandler** (`src/services/agent365/message-handler.ts`)
   - Activity プロトコルに基づいたメッセージ処理
   - JSON ペイロードのパースと検証
   - GitHub Models による議事録抽出
   - Graph API 統合（タスク作成）

2. **Observability** (`src/services/agent365/observability.ts`)
   - OpenTelemetry との統合
   - Activity のトレーシングとロギング
   - エラー追跡とスパン管理

3. **Notifications** (`src/services/agent365/notifications.ts`)
   - 汎用通知サービス
   - 優先度ベースのルーティング
   - 会議サマリー通知

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

#### 1. **Microsoft 365 Activity モード**（Agent 365 SDK）

@microsoft/agents-activity の Activity 形式でリクエストを受け取ります：

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
- @microsoft/agents-activity による Activity プロトコル
- Agent365MessageHandler で処理
- Markdown テキスト + JSON attachment による応答
- OpenTelemetry 統合によるトレーシング

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

#### Activity モードで接続

1. **外部エージェント接続を作成**
   - Copilot Studio → 「設定」→「外部エージェント」
   - メッセージングエンドポイント: `https://<your-tunnel>.devtunnels.ms/api/messages`

2. **認証設定（オプション）**
   - Activity モードでは JWT 認証をスキップ
   - Activity の送信元検証は Activity プロトコル自体で実施

#### Direct JSON モードで接続

README.md の「Copilot Studio との連携手順」を参照してください。

### プログラムからの呼び出し

#### @microsoft/agents-activity を使用

```typescript
import { Activity } from '@microsoft/agents-activity';

const activity: Activity = {
  type: 'message',
  id: 'msg-123',
  text: JSON.stringify({
    meetingTitle: 'Team Sync',
    meetingTranscript: 'Discussion about Q1 goals...',
    approve: false,
  }),
  from: { id: 'user123', name: 'Alice' },
  recipient: { id: 'bot', name: 'Task Management Agent' },
  conversation: { id: 'conv123' },
};

// POST to /api/messages with Activity
fetch('https://.../api/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(activity),
});
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

## 📄 応答フォーマット

### Activity レスポンス

Activity モードでは、Markdown テキスト + JSON attachment で応答を返します：

**text フィールド（Markdown）:**
- 会議サマリーのヘッダー
- 進捗状況
- 決定事項リスト
- アクションアイテムリスト
- リスクリスト
- トレースID

**attachments フィールド（JSON）:**
- contentType: `application/json`
- content: 完全な ResponsePayload（executives、decisions、todos、risks 等）

### レスポンス例

```typescript
{
  type: 'message',
  text: '# 📋 Meeting Summary\n\n**Progress:** Good progress...',
  attachments: [
    {
      contentType: 'application/json',
      content: {
        executiveSummary: { /* ... */ },
        decisions: [ /* ... */ ],
        todos: [ /* ... */ ],
        risks: [ /* ... */ ],
        traceId: 'abc-123'
      }
    }
  ]
}
```

## 🔍 トラブルシューティング

### Activity が認識されない

**原因**: リクエストに `type`, `id`, `conversation` フィールドがない

**解決**: Activity オブジェクトの必須フィールドを確認し、@microsoft/agents-activity の型に準拠

### JSON パースエラー

**原因**: activity.text が有効な JSON ではない

**解決**: activity.text に JSON 文字列を設定、または plain text として処理される

### OpenTelemetry トレースが表示されない

**原因**: OTEL_EXPORTER_TYPE の設定が正しくない

**解決**:
```bash
OTEL_EXPORTER_TYPE=console  # コンソール出力
# または
OTEL_EXPORTER_TYPE=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

## 📚 参考資料

- [Microsoft 365 Agents SDK](https://learn.microsoft.com/microsoft-365/agents-sdk/)
- [Agents for JavaScript GitHub](https://github.com/microsoft/Agents-for-js)
- [Agent 365 Samples](https://github.com/microsoft/Agent365-Samples)
- [@microsoft/agents-activity NPM](https://www.npmjs.com/package/@microsoft/agents-activity)
- [@microsoft/agents-hosting NPM](https://www.npmjs.com/package/@microsoft/agents-hosting)

## 🔄 移行ガイド

### 既存の JSON API から Activity モードへの移行

1. **リクエスト形式の変更**
   ```typescript
   // 従来の JSON
   { meetingTitle: '...', meetingTranscript: '...', approve: false }
   
   // Activity モード
   { 
     type: 'message', 
     id: '...', 
     text: '{"meetingTitle":"...","meetingTranscript":"...","approve":false}',
     conversation: { id: '...' },
     from: { id: '...' },
     recipient: { id: '...' }
   }
   ```

2. **レスポンス処理の変更**
   - Activity レスポンスの `text` フィールドから Markdown を取得
   - `attachments[0].content` から完全な JSON データを取得

3. **認証**
   - Activity モードでは JWT 認証不要（Activity プロトコルで検証）
   - JSON モードは引き続き Entra ID JWT 認証を使用

---

**Note**: Microsoft 365 Agents SDK は公式サポートされているパッケージです。最新の仕様については公式ドキュメントを参照してください。
