# sz_schedule 完全実装指示書

## 1. プロジェクト概要

製造業向けガントチャートスケジューラ。装置・担当者・タスク・場所の4視点でスケジュールを管理する。数万件のデータを扱うため、Canvas viewport-overlay方式でメモリ効率を確保する。

- **バックエンド**: Laravel 12 + Sanctum認証
- **フロントエンド**: React + Vite（JSX、フックベース、クラスコンポーネントなし）
- **インデント**: 全ファイル2スペース
- **パス**: `/Users/eminaoto/Laravel/sz_schedule`

---

## 2. データベース設計

### マスタテーブル

```sql
-- 機種
dm_kisyu(kisyu_id PK, kisyu_name, sort_no default 0)

-- 整番
kd_serial(
  serial_id PK,
  kisyu_id FK→dm_kisyu,
  serial_no,
  back_color int default 1,
  font_color int default 6,
  shipping_date date nullable,        -- 出荷日
  responsible int default 0   -- 責任者worker_id
)

-- チーム
km_team(team_id PK, team_name, sort_no default 0)

-- 担当者
km_worker(worker_id PK, worker_name, team_id FK→km_team)

-- プロセス(工程)
km_process(process_id PK, process_name, sort_no default 0)

-- タスク
km_task(
  task_id PK,
  task_name,
  back_color int default 1,
  font_color int default 6,
  sort_no int default 0,
  process_id nullable FK→km_process
)

-- 場所
km_resource(resource_id PK, resource_name, sort_no default 0)

-- カレンダー
dr_calendar(
  date varchar PK,    -- 'YYYY-MM-DD'
  date_type tinyint,   -- 0=平日,1=休日, 2=祝日
)

-- display_settings（ユーザーごと1行）
display_settings(
  id PK,
  user_id FK→users,
  settings json       -- 後述のJSON構造
)
```

### トランザクションテーブル

```sql
-- 生産予定
kd_plan(
  plan_id PK,
  serial_id FK→kd_serial,
  task_id FK→km_task,
  worker_id nullable FK→km_worker nullOnDelete,  -- 担当者未定はNULL可
  start_date date,   -- 'YYYY-MM-DD HH:MM:00'
  end_date date,
  deleted int default 0
)

-- 場所予約
kd_reserve(
  reserve_id PK,
  resource_id FK→km_resource,
  serial_id FK→kd_serial,
  start_date varchar,
  end_date varchar,
  deleted int default 0
)
```

---

## 3. APIルート

すべて `/api` プレフィックス、`auth:sanctum` ミドルウェア（ログインのみ除外）。

```
POST   /login
POST   /logout
GET    /me

GET    /serial
GET    /worker
GET    /task
GET    /resource

GET    /plan
POST   /plan/search
POST   /plan
PUT    /plan/{id}
DELETE /plan              -- 複数削除: body { ids: [...] }
DELETE /plan/{id}

GET    /reserve
POST   /reserve/search
POST   /reserve
PUT    /reserve/{id}
DELETE /reserve

POST   /calendar/search
GET    /calendar
POST   /calendar
DELETE /calendar/{date}

GET    /display-settings
PUT    /display-settings

POST   /seed
```

---

## 4. バックエンド実装

### 4-1. displaySettings の JSON 構造

```json
{
  "sbmodellist": [],              // number[] 装置タブで表示する機種ID
  "syteamlist": [],               // number[] 担当者タブのチームフィルタ
  "sytasklist": [],               // number[] 担当者タブのタスクフィルタ
  "tktasklist": [],            // number[] タスクタブの行フィルタ
  "showReserveInDevice": false,       // 装置タブに場所予約行を表示
  "showUnassignedWorker": false,       // 担当者タブに担当者未定予定を表示
  "showShippingDateInDevice": false,   // 装置ヘッダに出荷日列を追加
  "showResponsibleInDevice": false     // 装置ヘッダに責任者列を追加
}
```

### 4-2. PlanController

- `planRules()`: `workerId` は `nullable|integer|min:1`（担当者未設定を許容）
- `store()` / `update()`: `planRules()` を使い、`worker_id = $data['workerId'] ?? null`
- `search()`: `from`, `to`, `kisyu_ids[]`, `team_ids[]`, `task_ids[]`, `show_unassigned_worker` を受け付ける
  - `team_ids` あり + `show_unassigned_worker=true` → `whereIn(assignee_id) OR whereNull(assignee_id)`
  - `team_ids` なし → フィルタなし（全件）
- `formatPlan()` は `planId`, `serialId`, `taskId`, `taskName`, `kisyuId`, `kisyuName`, `serialNo`,
  `taskBackColor`, `taskFontColor`, `startDate`, `endDate`, `workerId`, `workerName` を返す

### 4-3. SerialController

`index()` で `shippingDate`, `responsible` も含めて返す。

### 4-4. TaskController

タスクに `km_process` をeagerロード。`processId`, `processName`, `processSortNo`, `sortNo` を返す。

### 4-5. CalendarController

```php
public function search(Request $request) {
  $data = $request->validate([
    'from' => 'required|date',
    'to'   => 'required|date|after_or_equal:from',
  ]);
  $rows = DrCalendar::whereBetween('date', [$data['from'], $data['to']])->get();
  return response()->json($rows->map(fn($c) => [
    'date'    => $c->calendar_date,
    'dateType' => $c->date_type,
  ]));
}
```

---

## 5. フロントエンド構成

### 5-1. ファイル構成

```
resources/js/
  lib/
    api.js             -- apiFetch, initCsrf
    spreadsheet.js     -- 定数, layoutPlans, computeGaps, 日付ユーティリティ
  components/
    LoginPage.jsx
    SpreadsheetGridClient.jsx          -- ルートコンテナ
    SpreadsheetGrid.jsx                -- グリッド本体（forwardRef）
    SpreadsheetGridCanvas.jsx          -- Canvas背景描画
    SpreadsheetGridBars.jsx            -- 予定バー描画
    SpreadsheetGridHeaders.jsx         -- 上部日付ヘッダ
    SpreadsheetGridLeftHeader.jsx      -- 左固定列
    SpreadsheetGridResourceOverlayBars.jsx
    SpreadsheetGridToolbar.jsx
    SpreadsheetGridStatusBar.jsx
    DisplaySettingsDrawer.jsx
    ScheduleDialog.jsx
    GridNavBar.jsx
    GridTabBar.jsx
    GridTabPane.jsx
    ContextMenu.jsx
    BarTooltip.jsx
    AlertToast.jsx
    DatePicker.jsx
    DeviceHeaderTooltip.jsx
    VirtualList.jsx
```

### 5-2. spreadsheet.js 定数・主要関数

```js
// 定数
CELL_SIZE = 20         // セル高さ/幅（正方形）
HDR_H = 20             // ヘッダ1行の高さ
TOTAL_HDR_H = HDR_H * 4
MIN_ROWS = 3           // グループあたり最小行数
MIN_ROWS_RESOURCE = 1
BUFFER_ROWS = 12       // 仮想スクロールバッファ
DEV_HDR_W = 160        // 装置ヘッダ基本幅
ASGN_HDR_W = 80        // 追加列幅
HANDLE_W = 5           // リサイズハンドル幅

TIME_SLOTS = [
  { label: 'AM1',  start: '08:30', end: '10:30' },
  { label: 'AM2',  start: '10:40', end: '12:25' },
  { label: 'PM1',  start: '13:05', end: '15:05' },
  { label: 'PM2',  start: '15:15', end: '17:15' },
  { label: '残業1', start: '17:25', end: '19:25' },
  { label: '残業2', start: '19:25', end: '21:25' },
]
SLOT_COUNT = 6

// 主要関数
layoutPlans(plans, groupKey, groups, viewMode, startDate, minRows, resourcePlans=null)
// groupKey: 'device'→serialId, 'worker'→workerId, 'task'→taskId, 'resource'→resourceId
// 戻り値: { groups: [...], totalRows }
// 各グループ: { ...g, startRow, numRows, plans[]{rowIdx}, resourceRowIdx, resourceNumRows, resourcePlans[] }

computeGaps(fetchedRanges, from, to)
// フェッチ済みレンジを除いた未取得区間の配列を返す
```

---

## 6. SpreadsheetGridClient

- **タブ**: `device` / `worker` / `task` / `resource` の4タブを常時マウント
- **表示切り替え**: `GridTabPane` で `visibility:hidden`（スクロール位置を保持）
- **初回フェッチ**: `serial`, `worker`, `task`, `resource`, `display-settings` を並列取得
- **タブ切り替え確認**: `isDirty=true` の状態でタブ変更しようとした際、3択モーダルを表示
  - 「保存してタブを切り替え」
  - 「変更を破棄してタブを切り替え」
  - 「閉じる」（タブ切り替えしない）
- **タブ間ジャンプ**: バー右クリック → 相手タブの対応予定へスクロール＋ソナーエフェクト
  - 表示設定対象外 / 表示期間外 の場合はAlertToastで通知してジャンプしない
- **保存/キャンセル**: 全タブグリッドの `saveChanges()` / `cancelChanges()` を並列実行

---

## 7. SpreadsheetGrid（グリッド本体）

### 7-1. 左ヘッダ幅の動的計算

```js
const showShippingDate = mode === 'device' && !!displaySettings.showShippingDateInDevice;
const showResponsible  = mode === 'device' && !!displaySettings.showResponsibleInDevice;
const deviceExtraW = (showShippingDate ? ASGN_HDR_W : 0) + (showResponsible ? ASGN_HDR_W : 0);
const leftHdrW = mode === 'device'   ? DEV_HDR_W + deviceExtraW
               : mode === 'worker' || mode === 'task' ? ASGN_HDR_W * 2
               : ASGN_HDR_W;
```

### 7-2. データフェッチ戦略

- **Gap-based fetching**: `computeGaps` でフェッチ済み範囲を除いた区間のみAPIコール
- **スクロール先読み**: `PREFETCH_DAYS = 30` 日分を先読みフェッチ
- **非アクティブタブ**: `pendingFetchRef` フラグを立て、タブ復帰時に実行
- 予定・場所予定・カレンダーの3系統それぞれに独立したフェッチ管理

### 7-3. 予定の更新（楽観的更新）

```
ダイアログ「保存」ボタン押下
  → ダイアログを即座に閉じる
  → ローカルstateを即反映
      新規: 仮ID（負数）でstateに追加
      編集: payloadを即適用
  → API呼び出し
  → 成功: 本IDで差し替え（新規）/ 確定データで上書き（編集）
  → 失敗: ローカルstateを元に戻す
           AlertToastで「登録/更新に失敗しました」表示（4秒で自動消去）
```

### 7-4. ドラッグ&リサイズ

- `pointerdown` 時点で選択確定（Ctrl/Cmd: 追加選択, 通常: 単一選択）
- 4px 以上移動でドラッグ判定
- ドラッグ中はゴーストバーを表示（`ghostDrag` state）
- `commitDrag`: APIを呼ばず `pendingUpdatesRef` に積む → `isDirty=true`
- 複数選択ドラッグ: 主対象の着地先グループを全プランに適用

### 7-5. 矩形選択

- コンテンツ領域の `pointerdown` で開始
- `pointerup` 時に矩形と各バーの座標を比較して選択Set更新

### 7-6. コピー&ペースト

- `Ctrl+C` / 右クリック「コピー」: 選択バーをコピーバッファへ
- `Ctrl+V` / 右クリック「貼り付け」: 現在スクロール位置にペースト
- **タスクモードはCtrl+Vによるペースト無効**
- ペーストバーは仮ID（負数）で `pendingCreatesRef` に積む
- 保存時（`saveChanges`）: POST APIで登録し、仮IDを本IDに差し替える

### 7-7. 担当者未定グループ（workerモードのみ）

`displaySettings.showUnassignedWorker = true` の場合、通常担当者グループの下に追加:

- `workerId === null` の予定を `serialId` 別にグループ化
- ヘッダ左列: `kisyuName`、右列: `serialNo`
- 背景色: `#fef9c3`（黄色）
- グループキー: `ua-${serialId}`
- ソート: kisyuName → serialNo

### 7-8. タスクタブ（読み取り専用）

タスクモードでは以下をすべて無効化:

| 操作 | 挙動 |
|---|---|
| セル右クリック | メニューなし（`e.preventDefault()` のみ） |
| バー右クリック | 「詳細」のみ表示 |
| バードラッグ/リサイズ | 無効（選択は可能） |
| `Ctrl+V` ペースト | 無効 |

### 7-9. カレンダーデータ

- `fetchedCalendarRangesRef` でギャップ管理
- `POST /calendar/search` でDB取得
- `calendarData: Map<dateStr, { dateType}>`
- `dateType === 1`: 休日（赤背景）
- `dateType === 3`: 祝日

### 7-10. ソナーエフェクト

タブジャンプ時・製番検索時にバー位置を3波のリングで強調表示（赤枠、380msずつ遅延）。

---

## 8. 左固定ヘッダ（SpreadsheetGridLeftHeader）

| モード | 列構成 |
|--------|--------|
| `device` | `DEV_HDR_W`: 機種名(上)/整番(下) ＋ `ASGN_HDR_W`: 出荷日（ON時）＋ `ASGN_HDR_W`: 責任者（ON時） |
| `worker` | `80px`: チーム名 ＋ `80px`: 担当者名（担当者未定グループ時は機種名/整番） |
| `task`   | `80px`: プロセス名 ＋ `80px`: タスク名 |
| `resource` | `ASGN_HDR_W`: 場所名 |

- 装置タブで場所表示ON時、各装置グループ下部に「場所」サブ行（水色背景 `#dbeafe`）を追加
- 装置ヘッダはクリック可能（DeviceHeaderTooltipを表示）

---

## 9. 表示設定ドロワー（DisplaySettingsDrawer）

右スライドドロワー。3タブ構成（装置 / 担当者 / タスク）。

**装置タブ:**
- 機種チェックリスト（`sbmodellist`）
- 「出荷日(3列目)を表示」チェック（`showShippingDateInDevice`）
- 「責任者(4列目)を表示」チェック（`showResponsibleInDevice`）
- 「場所予定を表示」チェック（`showResourceInDevice`）

**担当者タブ:**
- チームチェックリスト（`syteamlist`）
- 「担当者未定も表示」チェック（`showUnassignedWorker`）
- タスクチェックリスト（`sytasklist`）＋「未選択の場合は全タスクのバーを表示します」注記

**タスクタブ:**
- プロセスごとにグループ化したタスクチェックリスト（`tktasklist`）＋「未選択の場合は全タスクを表示します」注記

保存時: `PUT /display-settings` 呼び出し、適用ドロワータブに対応するグリッドタブへ自動切り替え。

---

## 10. 予定登録・編集ダイアログ（ScheduleDialog）

### 10-1. 共通フィールド

- **開始日**: DatePicker + 時間スロット6択ボタン（AM1/AM2/PM1/PM2/残業1/残業2）
- **終了日**: DatePicker + 時間スロット6択ボタン（終了時刻）
- 開始日時 > 終了日時の場合はエラーメッセージ表示（保存不可）

### 10-2. 場所モード（`gridMode === 'resource'`）

- 場所（読み取り専用テキスト）
- **機種** ドロップダウン → **製番** ドロップダウン（機種で絞り込み）
- 機種変更時: 製番を先頭に自動切り替え

### 10-3. その他モード（device / worker / task）

- **機種** ドロップダウン → **製番** ドロップダウン（機種で絞り込み）
- **工程（タスク）** ドロップダウン
- **チーム** ドロップダウン（「（未設定）」選択肢あり）
- **担当者** ドロップダウン（チームで絞り込み、チーム未設定時はdisabled・グレー背景）
  - チーム変更時: 担当者リスト自動絞り込み＋先頭担当者自動選択
  - チーム「（未設定）」選択時: `workerId = null` で保存（担当者未定予定）

### 10-4. 初期値の解決

- 編集時: 既存プランの `serialId` → `kisyuId` 逆引き、`workerId` → `teamId` 逆引き
- 新規時（右クリック）: `initialData` から `serialId` / `resourceId` / `workerId` を初期セット

---

## 11. タブバー・ステータスバー

**GridTabBar:**
- タブ: `装置` / `担当者` / `タスク` / `場所`
- `isDirty=true` 時: 「保存」「キャンセル」ボタンを表示

**SpreadsheetGridStatusBar:**
```
{件数} 装置/担当者/タスク/場所 / {行数}行 × {日数}日  |  予定{件数}件
[選択中N件]  [コピー済みN件]
```

**SpreadsheetGridToolbar:**
- 開始日付入力
- 月送りボタン（◀◀ -2M / ◀ -1M / ▶ +1M / ▶▶ +2M）
- 日単位 / 時間割 切り替えボタン
- 製番検索（`device` モードのみ）

---

## 12. Canvas 描画方式

`SpreadsheetGridCanvas` は viewport-overlay 方式:

- スクロール領域の**外側**に `position:absolute` で固定配置（`zIndex:0`）
- スクロール領域は `zIndex:1` で透明に重ねる
- `scrollLeft` / `scrollTop` を offset にして可視範囲のみ描画
- HiDPI対応: `devicePixelRatio` でcanvasの実ピクセルサイズを調整
- 描画内容: セル背景色（平日=白/土=水色/日=ピンク/祝日=赤）、グリッド線、グループ区切り線、場所行背景

---

## 13. AlertToast コンポーネント

```
position: absolute, top:12, right:12, zIndex:9999
背景: #fef2f2（赤みがかった白）
枠線: #fca5a5
文字色: #b91c1c
アイコン: ⚠
×ボタンで手動消去
```

使用箇所:
- `SpreadsheetGridClient`: ジャンプ失敗時
- `SpreadsheetGrid`: 予定登録/更新失敗時（楽観的更新のロールバック通知）

---

## 14. 保存・キャンセル、初期データ生成のフロー

### 保存（Saveボタン / 保存してタブ切り替え）

```
pendingCreates: POST /plan（仮IDを本IDに差し替え）
pendingDeletes: DELETE /plan（idリスト）
pendingUpdates: PUT /plan/{id}（削除済みIDはスキップ）
→ 各Ref.current をリセット
→ isDirty = false
```

### キャンセル（Cancelボタン / 破棄してタブ切り替え）

```
pendingCreates/Updates/Deletes をリセット
fetchedRangesRef をリセット
plans state をリセット
isDirty = false
→ 初期フェッチを再実行
```

### 初期データ生成
ナビゲーションバーに「初期データ生成」ボタンと、「予定データ生成」ボタン設置
初期データ生成ボタン押下で以下のデータを/api/seed/masterで生成する。既存データは洗い替える
・マスタテーブル一式(各種100件ずつ程度。カレンダーは前後1年の2年分)

予定データ生成ボタン押下で以下のデータを/api/seed/plansで生成する。既存データの追加していく
・トランザクションデータ(装置予定と場所予定を1000件ずつ)

---

## 15. コード規約

- インデント: **2スペース**（タブ禁止）
- React: 関数コンポーネント + フック。クラスコンポーネント不使用
- 状態管理: React標準（`useState` / `useRef` / `useMemo` / `useCallback`）、外部ライブラリ不使用
- ESLint: `react-hooks/exhaustive-deps` の抑制コメントは必要箇所のみ
- PHP: PSR準拠、コントローラは `App\Http\Controllers\Api` 名前空間
- API通信: `apiFetch()` ラッパー経由（Sanctum XSRF-TOKEN自動付与）
