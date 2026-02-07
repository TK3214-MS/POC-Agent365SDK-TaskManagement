# POC: Agent 365 SDK - Task Management External Agent

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Agent 365 SDK](https://img.shields.io/badge/Agent%20365%20SDK-Integrated-brightgreen.svg)](https://learn.microsoft.com/microsoft-365/agents-sdk/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Microsoft 365 Agents SDK と統合された外部エージェントで、Copilot Studio から `/api/messages` 経由で呼び出され、会議の議事録から decisions / todos / risks を抽出して返します。

## 🎯 機能概要

- **POST /api/messages**: Copilot Studio / Teams の統合エンドポイント
  - **Microsoft 365 Agent Activity**: Agent 365 SDK による Activity プロトコル対応
  - **Direct JSON API**: 直接 JSON リクエスト対応（JWT 認証あり）
- **Entra ID 認証**: OAuth 2.0 JWT Bearer トークン検証（Client Credentials flow）
- **GitHub Models 連携**: 複数モデル（gpt-4o, o1-preview など）での抽出と評価
- **Microsoft Graph API**: approve=true 時に Planner タスク作成を実行
- **Agent 365 SDK 統合**: 公式 Microsoft 365 Agents SDK および Agent 365 SDK 拡張
- **OpenTelemetry**: リクエストから応答までの observability（Console / OTLP exporter 対応）
- **Dev Tunnel**: localhost:3978 を https 公開し M365 から到達可能に

## 🆕 Agent 365 SDK 統合

このプロジェクトは、**Microsoft 365 Agents SDK** の公式パッケージを採用しています：

### 統合されたコンポーネント

#### Microsoft 365 Agents SDK (Core)
- **@microsoft/agents-activity** (v1.2.2): Activity protocol and schemas
- **@microsoft/agents-hosting** (v1.2.2): Express.js hosting integration

#### Agent 365 SDK (Extensions) - Preview
- **@microsoft/agents-a365-notifications** (v0.1.0-preview.30): Notification capabilities
- **@microsoft/agents-a365-observability** (v0.1.0-preview.30): Observability and tracing
- **@microsoft/agents-a365-runtime** (v0.1.0-preview.30): Runtime utilities
- **@microsoft/agents-a365-tooling** (v0.1.0-preview.30): Developer tooling

### 主な機能
- **Agent365MessageHandler**: Activity-based message processing
- **Observability Integration**: OpenTelemetry wrapper for Agent 365 SDK
- **Notifications**: Meeting summary notifications with priority routing

### デュアルモード対応

```
┌─────────────────────────────────────┐
│   Copilot Studio / Teams            │
└──────────────┬──────────────────────┘
               │
        /api/messages
               │
       ┌───────┴────────┐
       ↓                ↓
Bot Activity      JSON Request
(Agent 365)       (Direct API)
       ↓                ↓
Activity Response JSON Response
(Markdown+JSON)   (JSON only)
```

詳細は [docs/AGENT365_INTEGRATION.md](./docs/AGENT365_INTEGRATION.md) を参照してください。

## 📋 前提条件

- Node.js 20.x 以上
- Azure Entra ID テナント（アプリ登録 × 2: API 用 / Client 用）
- GitHub アカウント（GitHub Models アクセス用トークン）
- Microsoft 365 環境（Graph API、Planner、Teams）
- Dev Tunnel CLI（[インストール手順](https://learn.microsoft.com/azure/developer/dev-tunnels/get-started)）

## 🚀 クイックスタート

### 1. リポジトリのクローンと依存関係のインストール

```bash
git clone <repository-url>
cd POC-Agent365SDK-TaskManagement
npm install
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、以下の値を設定：

```bash
cp .env.example .env
```

#### 必須の環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `TENANT_ID` | Azure Entra ID テナント ID | `00000000-...` |
| `API_CLIENT_ID` | API アプリ（この外部エージェント）の Client ID | `00000000-...` |
| `API_AUDIENCE` | JWT の `aud` クレームで検証する値 | `api://00000000-...` |
| `ALLOWED_APPIDS` | 許可する呼び出し元アプリ ID（カンマ区切り） | `00000000-...` |
| `GITHUB_TOKEN` | GitHub Personal Access Token | `ghp_...` |
| `GRAPH_CLIENT_ID` | Graph API 用アプリの Client ID | `00000000-...` |
| `GRAPH_CLIENT_SECRET` | Graph API 用アプリの Client Secret | `abc123...` |
| `PLANNER_PLAN_ID` | Planner プラン ID | `plan-id-here` |
| `PLANNER_BUCKET_ID` | Planner バケット ID | `bucket-id-here` |

詳細は [.env.example](.env.example) を参照してください。

### 3. ローカルでサーバーを起動

```bash
npm run dev
```

動作確認：

```bash
curl http://localhost:3978/health
# {"status":"ok","timestamp":"2026-02-05T...","service":"external-agent-taskmanagement"}
```

### 4. Dev Tunnel で https 公開

別のターミナルで以下を実行：

```bash
./scripts/devtunnel-setup.sh
```

出力例：

```
✅ Dev Tunnel created: https://abc123.devtunnels.ms
📨 Messaging endpoint URL: https://abc123.devtunnels.ms/api/messages
```

この URL を Copilot Studio の「外部エージェント接続」設定で使用します。

### 5. Copilot Studio での接続設定

1. Copilot Studio を開く
2. 「設定」→「外部エージェント」→「新しい接続」
3. 以下を入力：
   - **エージェント名**: Task Management Agent
   - **メッセージングエンドポイント**: `https://<your-tunnel>.devtunnels.ms/api/messages`
   - **認証方式**: OAuth 2.0 Client Credentials
   - **トークンエンドポイント**: `https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token`
   - **Client ID**: `<GRAPH_CLIENT_ID>`
   - **Client Secret**: `<GRAPH_CLIENT_SECRET>`
   - **スコープ**: `api://<API_CLIENT_ID>/.default`

## 🧪 テスト実行

```bash
# 単体テスト実行
npm test

# カバレッジ付きテスト
npm run test:coverage

# Watch モード
npm run test:watch
```

## 📂 プロジェクト構成

<details>
<summary>ファイル構成を展開</summary>

```
POC-Agent365SDK-TaskManagement/
├── .env.example                    # 環境変数テンプレート
├── package.json                    # Agent 365 SDK パッケージ統合
├── tsconfig.json
├── vitest.config.ts
├── README.md
├── docs/
│   └── AGENT365_INTEGRATION.md    # Agent 365 SDK 統合ガイド
├── scripts/
│   └── devtunnel-setup.sh         # Dev Tunnel セットアップスクリプト
├── src/
│   ├── index.ts                   # エントリーポイント
│   ├── server.ts                  # Express サーバー
│   ├── config/
│   │   ├── env.ts                 # 環境変数の検証
│   │   └── telemetry.ts           # OpenTelemetry 初期化
│   ├── middleware/
│   │   ├── auth.middleware.ts     # Entra ID JWT 検証
│   │   └── telemetry.middleware.ts
│   ├── routes/
│   │   └── messages.route.ts      # POST /api/messages (デュアルモード)
│   ├── schemas/
│   │   ├── request.schema.ts      # リクエスト schema (zod)
│   │   └── response.schema.ts     # レスポンス schema (zod)
│   ├── services/
│   │   ├── agent365/              # 🆕 Agent 365 SDK 統合
│   │   │   ├── message-handler.ts # Activity メッセージ処理
│   │   │   ├── observability.ts   # OpenTelemetry 統合
│   │   │   └── notifications.ts   # 通知サービス
│   │   ├── llm/
│   │   │   ├── github-models.service.ts
│   │   │   ├── extraction.service.ts
│   │   │   └── evaluation.service.ts
│   │   ├── graph/
│   │   │   ├── graph.client.ts
│   │   │   ├── planner.service.ts
│   │   │   └── teams.service.ts
│   │   └── actions/
│   │       ├── action.interface.ts
│   │       └── action.executor.ts
│   ├── utils/
│   │   ├── jwt.util.ts
│   │   ├── pii-filter.util.ts
│   │   └── error-handler.util.ts
│   └── types/
│       └── index.ts
└── tests/                         # 46 テスト（Agent 365 SDK を含む）
    └── unit/
        ├── agent365/              # 🆕 Agent 365 SDK テスト
        │   ├── message-handler.test.ts
        │   ├── observability.test.ts
        │   └── notifications.test.ts
        ├── middleware/
        ├── schemas/
        ├── services/
        └── utils/
```

</details>

## 🔒 セキュリティ

- **Entra ID 認証**: すべてのリクエストで Bearer トークンを検証
- **PII フィルタリング**: ログ・トレースに議事録原文などの機密情報を出力しない
- **Helmet**: セキュリティヘッダーを自動設定
- **環境変数検証**: 起動時に zod でバリデーション

## 📊 OpenTelemetry

### Console Exporter（デフォルト）

開発環境では Console に直接出力：

```bash
OTEL_EXPORTER_TYPE=console npm run dev
```

### OTLP Exporter（本番 / Jaeger / Agent 365 UI）

OTLP 対応のバックエンド（Jaeger など）に送信：

```bash
OTEL_EXPORTER_TYPE=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
npm run dev
```

### Agent 365 UI との連携（将来対応）

※ 現在 Frontier プログラム参加者向けにプレビュー中。利用可能になった場合の手順：

1. Agent 365 UI のダッシュボードで「トレースエンドポイント」を取得
2. `.env` で以下を設定：

```bash
OTEL_EXPORTER_TYPE=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=<Agent 365 UI のエンドポイント>
```

3. 外部エージェントからのリクエストが UI でリアルタイム可視化される

---

## 🤖 GitHub Models と複数モデル評価

### サポートされているモデル

`.env` で以下のように複数モデルを設定可能：

```bash
GITHUB_MODELS_LIST=gpt-4o,o1-preview,gpt-4o-mini
GITHUB_MODELS_DEFAULT=gpt-4o
```

### 複数モデルでの評価機能

開発/検証時に複数のモデルで抽出品質を比較できます：

```typescript
import { evaluateMultipleModels } from './services/llm/evaluation.service';

const results = await evaluateMultipleModels(
  meetingTitle,
  meetingTranscript,
  attendees,
  outputLanguage,
  defaultDueDays,
  ['gpt-4o', 'o1-preview', 'gpt-4o-mini'] // 評価対象モデル
);

console.log('推奨モデル:', results.recommendedModel);
console.log('実行時間:', results.totalTimeMs, 'ms');
```

評価基準：
- 抽出数（decisions + todos + risks）
- 平均信頼度（confidence）
- 実行速度

---

## 🔐 Entra ID 認証設定

### アプリ登録の準備

#### 1. API アプリ（この外部エージェント）を登録

1. Azure Portal → **Entra ID** → **App registrations** → **New registration**
2. 名前：`External-Agent-API`
3. **Expose an API** → **Add a scope**:
   - Scope name: `.default`
   - Who can consent: Admins and users
4. **Client ID** をコピー → `.env` の `API_CLIENT_ID` に設定
5. **Application ID URI**: `api://<API_CLIENT_ID>` → `.env` の `API_AUDIENCE` に設定

#### 2. Client アプリ（呼び出し元）を登録

1. Azure Portal → **Entra ID** → **App registrations** → **New registration**
2. 名前：`External-Agent-Client`
3. **Certificates & secrets** → **New client secret** → コピー
4. `.env` に設定：
   - `GRAPH_CLIENT_ID=<Client の Client ID>`
   - `GRAPH_CLIENT_SECRET=<Client Secret>`
5. **API permissions** → **Add a permission** → **My APIs** → `External-Agent-API` を選択
   - Delegated permissions: `.default` にチェック
6. **Grant admin consent**

#### 3. Copilot Studio で使用

Copilot Studio の外部エージェント設定で：
- **Client ID**: `GRAPH_CLIENT_ID`
- **Client Secret**: `GRAPH_CLIENT_SECRET`
- **Token Endpoint**: `https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token`
- **Scope**: `api://<API_CLIENT_ID>/.default`

---

## 🌐 Dev Tunnel セットアップ詳細

### インストール

```bash
# macOS
brew install --cask devtunnel

# Windows
winget install Microsoft.devtunnel

# Linux
# https://learn.microsoft.com/azure/developer/dev-tunnels/get-started
```

### 自動セットアップ（推奨）

```bash
./scripts/devtunnel-setup.sh
```

スクリプトが以下を自動実行：
1. 既存トンネルの確認
2. 新規トンネル作成（存在しない場合）
3. ポート 3978 を https で公開
4. トンネルホスティング（オプション）

### 手動セットアップ

```bash
# 1. トンネル作成
devtunnel create agent365-external-agent --allow-anonymous

# 2. ポート設定
devtunnel port create <tunnel-id> -p 3978 --protocol https

# 3. トンネルホスト
devtunnel host <tunnel-id>
```

出力例：

```
Hosting port: 3978, https: open
  Connect via browser: https://abc123xyz.devtunnels.ms:3978
  Inspect network activity: https://abc123xyz.devtunnels.ms:3978/$inspect
```

この URL の `/api/messages` を Copilot Studio に設定：

```
https://abc123xyz.devtunnels.ms:3978/api/messages
```

### トンネルの管理

```bash
# トンネル一覧
devtunnel list

# トンネル削除
devtunnel delete <tunnel-id>

# トンネル停止
# Ctrl+C でホスティングを停止
```

---

## 📝 Copilot Studio との連携手順

### 1. Copilot Studio を開く

[https://copilotstudio.microsoft.com/](https://copilotstudio.microsoft.com/)

### 2. 新しい Copilot を作成（または既存を編集）

### 3. 「設定」→「外部エージェント」

### 4. 「新しい接続」をクリック

### 5. 接続情報を入力

| 項目 | 値 |
|------|-----|
| **エージェント名** | Task Management Agent |
| **説明** | Meeting task extraction with GitHub Models |
| **メッセージングエンドポイント** | `https://<your-tunnel>.devtunnels.ms/api/messages` |
| **認証方式** | OAuth 2.0 Client Credentials |
| **トークンエンドポイント** | `https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token` |
| **Client ID** | `<GRAPH_CLIENT_ID>` |
| **Client Secret** | `<GRAPH_CLIENT_SECRET>` |
| **スコープ** | `api://<API_CLIENT_ID>/.default` |

### 6. 「保存」→「テスト」

### 7. テストメッセージ送信例

```json
{
  "meetingTitle": "Q1 Planning Meeting",
  "meetingTranscript": "Alice: We need to finalize the Q1 roadmap. Bob: I'll update the timeline by Friday. Charlie raised concerns about budget constraints.",
  "attendees": ["Alice", "Bob", "Charlie"],
  "policy": {
    "defaultDueDays": 7,
    "requireApproval": true,
    "allowAutoNotify": false
  },
  "outputLanguage": "ja-JP",
  "approve": false
}
```

### 8. レスポンス確認

正常に動作すると、以下のような JSON が返ります：

```json
{
  "executiveSummary": {
    "progress": "Q1 roadmap finalization in progress",
    "keyRisks": ["Budget constraints"],
    "decisionsNeeded": ["Q1 roadmap approval"]
  },
  "decisions": [],
  "todos": [
    {
      "text": "Update the timeline",
      "owner": "Bob",
      "dueDate": "2026-02-12",
      "confidence": 0.92
    }
  ],
  "risks": [
    {
      "text": "Budget constraints",
      "severity": "medium",
      "confidence": 0.88
    }
  ],
  "followUpQuestions": [
    "誰が予算承認を担当しますか？",
    "Q1 ロードマップの最終期限はいつですか？"
  ],
  "draftActions": [...],
  "traceId": "abc123..."
}
```

---

## 🛠️ トラブルシューティング

### ❌ "Invalid or expired JWT token"

- Entra ID のアプリ登録を確認
- トークンエンドポイントが正しいか確認
- Client Secret が有効期限内か確認

### ❌ "Application ID not allowed"

- `.env` の `ALLOWED_APPIDS` に呼び出し元の Client ID を追加

### ❌ Dev Tunnel が接続できない

```bash
# トンネルを再作成
devtunnel delete <tunnel-id>
./scripts/devtunnel-setup.sh
```

### ❌ GitHub Models でエラー

- `GITHUB_TOKEN` が有効か確認：[https://github.com/settings/tokens](https://github.com/settings/tokens)
- GitHub Models へのアクセス権があるか確認

### ❌ Graph API でエラー（approve=true 時）

- `GRAPH_CLIENT_ID` / `GRAPH_CLIENT_SECRET` を確認
- Graph API の権限（`Tasks.ReadWrite`, `ChannelMessage.Send` など）が付与されているか確認
- `PLANNER_PLAN_ID` / `PLANNER_BUCKET_ID` が正しいか確認

---

## 🛠️ 開発ワークフロー

このプロジェクトは以下の PR で段階的に実装されています：

- **PR1**: プロジェクト雛形（現在のコミット）
- **PR2**: Entra ID JWT 検証
- **PR3**: GitHub Models 連携 + 抽出コア
- **PR4**: approve=true 実行パス（Graph API）
- **PR5**: OpenTelemetry 詳細トレーシング
- **PR6**: Dev Tunnel スクリプト + README 拡充

## 📖 リファレンス

- [Microsoft 365 Agents SDK](https://learn.microsoft.com/microsoft-365/agents-sdk/)
- [Agent 365 SDK Samples](https://github.com/microsoft/Agent365-Samples)
- [GitHub Models](https://github.com/marketplace/models)
- [Microsoft Graph API](https://learn.microsoft.com/graph/overview)
- [Dev Tunnels](https://learn.microsoft.com/azure/developer/dev-tunnels/)
- [OpenTelemetry](https://opentelemetry.io/)

## 📝 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照

---

**Note**: このプロジェクトは POC（Proof of Concept）です。本番環境で使用する場合は、セキュリティ監査、エラーハンドリングの強化、スケーラビリティの検証を行ってください。
