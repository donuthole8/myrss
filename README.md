# Reedly

Feedly ライクな RSS / Atom リーダー。3ペイン構成で、購読状態はブラウザの localStorage に持つ。

```bash
npm run dev   # http://localhost:3000
```

## できること

- **購読** — サイトのURLを入れるとフィードを自動探索（`<link rel="alternate">` → `/feed` `/rss.xml` などの定番パス）。フォルダ分け可。
- **3ペイン** — サイドバー（フォルダ / フィード・未読数）、記事一覧、本文ビュー。
- **未読管理** — 開いた記事を自動で既読に。未読のみ表示、表示中を一括既読。
- **スター** — 記事本体ごと保存するので、フィードから流れ落ちても残る。
- **検索** — タイトル / 要約 / フィード名を横断。
- **OPML** — 読み込みと書き出し。他のリーダーからの移行・退避用。
- **テーマ** — system / light / dark を切り替え。初回描画前に当てるのでちらつかない。
- **ショートカット** — `J`/`K` 移動、`O` 元記事、`M` 既読切替、`S` スター、`U` 未読のみ、`R` 更新、`A` 追加、`/` 検索、`?` ヘルプ。

## 構成

| パス | 役割 |
| --- | --- |
| `src/app/api/feed/` | フィード取得。`GET` は単体（購読前プレビュー）、`POST` は購読中を一括更新。5分のメモリキャッシュ付き |
| `src/app/api/discover/` | サイトURLからフィードを探す。同じ中身を返す別URLは1つに畳む |
| `src/app/api/icon/` | ファビコンのプロキシ。外部サービスに購読リストを渡さずに済ませるため |
| `src/lib/rss.ts` | RSS 2.0 / Atom / RDF(RSS 1.0) のパースと本文のサニタイズ |
| `src/lib/net.ts` | URL検証・タイムアウト・文字コード判定・TTLキャッシュ |
| `src/lib/store.ts` | localStorage の読み書き（キー: `feedly-clone:v1`） |
| `src/components/Reader.tsx` | 状態の持ち主。他のコンポーネントはすべて props 受け取り |

フィードの取得とパースはすべてサーバー側（Route Handler）でやる。ブラウザから直接叩くと CORS で弾かれるのと、本文のサニタイズをクライアントに任せたくないため。

## 制約・メモ

- 購読データは**そのブラウザの localStorage にしかない**。別デバイスと同期はしない（OPML書き出しで移す）。
- 記事キャッシュはサーバーのメモリなので、プロセスを再起動すると消える（次のアクセスで取り直す）。
- 取得先URLはループバック / プライベートIP帯を弾いている。ただしリダイレクト先までは追跡していない。
- 本文は `sanitize-html` を通し、iframe は YouTube / Vimeo / SoundCloud / Speaker Deck のみ許可。

## デプロイ（Vercel）

```bash
npx vercel          # 初回: プレビュー環境に上げてリンク作成
npx vercel --prod   # 本番へ
```

Hobbyプランの上限は**200プロジェクト / 100デプロイ per day**なので、プロジェクト数は気にしなくてよい。環境変数は不要。

### スマホで使う

本番URLをスマホのブラウザで開いて「ホーム画面に追加」すると、スタンドアロン表示（アドレスバーなし）のアプリとして起動する。`src/app/manifest.ts` と `public/icon-*.png` がその定義。

**注意: 購読データは端末ごとに別**。localStorageにしか持っていないので、PCとスマホは同期しない。移すときはPC側でOPMLを書き出し → スマホ側で読み込む。既読・スターは移らない。

### サーバーレスでの挙動

- フィード取得は Next の Data Cache（`revalidate: 300`）に載せている。インスタンスが使い捨てられてもキャッシュは効く。`src/lib/net.ts` の `fetchWithLimit` が窓口。
- `TtlCache`（メモリ）は同一インスタンスに連続で当たったときのパース結果の使い回し用。サーバーレスでは当たったらラッキー程度のもの。
- 関数の実行時間上限は各 route の `maxDuration` で指定（feed 30s / discover 45s / icon 20s）。個別のfetchは10秒でタイムアウトさせている。

### 公開範囲

URLを知っていれば誰でも開けるし、`/api/feed` は任意のURLを取りに行くプロキシとして使える。気になるなら Vercel の Project Settings → Deployment Protection → Vercel Authentication を有効にする（自分のVercelアカウントでログインした人だけがアクセスできる）。
