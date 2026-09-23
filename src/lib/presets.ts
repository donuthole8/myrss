import type { Candidate } from "./types";

export type CatalogFeed = Candidate & {
  /** 英語のフィードはタイトルを訳して出す旨を表示する */
  lang: "ja" | "en";
};

export type CatalogCategory = {
  id: string;
  title: string;
  description: string;
  /** 追加したときのフォルダ */
  folder: string;
  feeds: CatalogFeed[];
};

function ja(url: string, title: string, siteUrl: string, description: string): CatalogFeed {
  return { url, title, siteUrl, description, itemCount: 0, lang: "ja" };
}

function en(url: string, title: string, siteUrl: string, description: string): CatalogFeed {
  return { url, title, siteUrl, description, itemCount: 0, lang: "en" };
}

/**
 * おすすめフィードのカタログ。どれもこのアプリのパーサーで読めて、
 * 直近も更新されていることを確認したもの (2026-09)。追加するときも同じ確認をする。
 */
export const CATALOG: CatalogCategory[] = [
  {
    id: "jp-trend",
    title: "国内テックのトレンド",
    description: "エンジニアの間でいま読まれている記事",
    folder: "テック",
    feeds: [
      ja("https://qiita.com/popular-items/feed", "Qiita 人気の記事", "https://qiita.com", "Qiita のトレンド。いいねが伸びている記事"),
      ja("https://zenn.dev/feed", "Zenn トレンド", "https://zenn.dev", "Zenn で注目を集めている記事"),
      ja("https://b.hatena.ne.jp/hotentry/it.rss", "はてブ テクノロジー", "https://b.hatena.ne.jp", "はてなブックマークのテクノロジー人気エントリー"),
      ja("https://b.hatena.ne.jp/hotentry/all.rss", "はてブ 総合", "https://b.hatena.ne.jp", "はてなブックマークの総合人気エントリー。IT 以外も含む"),
      ja("https://b.hatena.ne.jp/entrylist/it.rss", "はてブ テクノロジー 新着", "https://b.hatena.ne.jp", "人気エントリーになる前の新着。話題を早めに拾える"),
      ja("https://www.publickey1.jp/atom.xml", "Publickey", "https://www.publickey1.jp", "クラウド・開発ツール・エンタープライズ IT の業界ニュース"),
      ja("https://gihyo.jp/feed/atom", "gihyo.jp", "https://gihyo.jp", "技術評論社。連載・ニュース・書籍情報"),
      en("https://speakerdeck.com/c/programming.atom", "Speaker Deck: Programming", "https://speakerdeck.com", "勉強会・カンファレンスの発表資料。日本語の資料も多い"),
    ],
  },
  {
    id: "ai",
    title: "AI",
    description: "国内の AI / LLM 記事と、海外の主要 AI ラボ・論客の発信",
    folder: "AI",
    feeds: [
      ja("https://qiita.com/tags/ai/feed", "Qiita: AI", "https://qiita.com/tags/ai", "Qiita の AI タグの新着"),
      ja("https://qiita.com/tags/llm/feed", "Qiita: LLM", "https://qiita.com/tags/llm", "Qiita の LLM タグの新着"),
      ja("https://qiita.com/tags/%E7%94%9F%E6%88%90ai/feed", "Qiita: 生成AI", "https://qiita.com/tags/%E7%94%9F%E6%88%90ai", "Qiita の生成AI タグの新着"),
      ja("https://zenn.dev/topics/llm/feed", "Zenn: LLM", "https://zenn.dev/topics/llm", "Zenn の LLM トピック"),
      ja("https://zenn.dev/topics/ai/feed", "Zenn: AI", "https://zenn.dev/topics/ai", "Zenn の AI トピック"),
      ja("https://zenn.dev/topics/claude/feed", "Zenn: Claude", "https://zenn.dev/topics/claude", "Zenn の Claude トピック"),
      ja("https://rss.itmedia.co.jp/rss/2.0/aiplus.xml", "ITmedia AI+", "https://www.itmedia.co.jp/aiplus/", "AI 専門のニュースメディア"),
      en("https://openai.com/news/rss.xml", "OpenAI News", "https://openai.com", "OpenAI の公式発表"),
      en("https://blog.google/technology/ai/rss/", "Google AI Blog", "https://blog.google/technology/ai/", "Google の AI 関連の発表"),
      en("https://deepmind.google/blog/rss.xml", "Google DeepMind", "https://deepmind.google", "DeepMind の研究・発表"),
      en("https://huggingface.co/blog/feed.xml", "Hugging Face Blog", "https://huggingface.co", "オープンなモデル・ライブラリの技術記事"),
      en("https://simonwillison.net/atom/everything/", "Simon Willison", "https://simonwillison.net", "LLM を実務で使い倒す開発者の日々のメモ"),
      en("https://www.latent.space/feed", "Latent.Space", "https://www.latent.space", "AI エンジニア向けのニュースレター・ポッドキャスト"),
      en("https://jack-clark.net/feed/", "Import AI", "https://jack-clark.net", "AI 研究と政策の週刊ニュースレター"),
      ja("https://blog.lai.so/rss/", "laiso", "https://blog.lai.so", "AI コーディングエージェントと開発ツールの考察"),
      en(
        // 語を増やしすぎると hnrss 側がタイムアウトしやすい
        "https://hnrss.org/newest?q=AI+OR+LLM+OR+GPT+OR+Claude&points=100",
        "Hacker News (AI)",
        "https://news.ycombinator.com",
        "HN の AI 関連投稿のうち 100 ポイント以上",
      ),
    ],
  },
  {
    id: "jp-news",
    title: "国内 IT ニュース",
    description: "IT 業界・ガジェット・開発者向けのニュースサイト",
    folder: "ITニュース",
    feeds: [
      ja("https://rss.itmedia.co.jp/rss/2.0/itmedia_all.xml", "ITmedia", "https://www.itmedia.co.jp", "ITmedia の全記事。量が多い"),
      ja("https://rss.itmedia.co.jp/rss/2.0/ait.xml", "@IT", "https://atmarkit.itmedia.co.jp", "開発者・インフラ技術者向けの記事"),
      ja("https://www.watch.impress.co.jp/data/rss/1.0/ipw/feed.rdf", "Impress Watch", "https://www.watch.impress.co.jp", "PC・スマホ・家電・ネットのニュース"),
      ja("https://gigazine.net/news/rss_2.0/", "GIGAZINE", "https://gigazine.net", "海外テックの話題を日本語で。量が多い"),
      ja("https://codezine.jp/rss/new/20/index.xml", "CodeZine", "https://codezine.jp", "開発者向けの技術ニュース・イベントレポート"),
      ja("https://thinkit.co.jp/rss.xml", "Think IT", "https://thinkit.co.jp", "OSS・クラウドネイティブの連載と解説"),
      ja("https://forest.watch.impress.co.jp/data/rss/1.0/wf/feed.rdf", "窓の杜", "https://forest.watch.impress.co.jp", "ツール・アプリの新着とアップデート。量が多い"),
      ja("https://dev.classmethod.jp/feed/", "DevelopersIO", "https://dev.classmethod.jp", "クラスメソッドの技術ブログ。AWS の検証記事が特に多い"),
      ja("https://news.yahoo.co.jp/rss/topics/it.xml", "Yahoo!ニュース IT", "https://news.yahoo.co.jp", "Yahoo!ニュースの IT トピックス"),
    ],
  },
  {
    id: "global",
    title: "海外テック",
    description: "英語圏のテックニュースとエンジニアコミュニティ",
    folder: "Global",
    feeds: [
      en("https://hnrss.org/frontpage", "Hacker News", "https://news.ycombinator.com", "Hacker News のフロントページ"),
      en("https://hnrss.org/best", "Hacker News: Best", "https://news.ycombinator.com/best", "HN で評価の高い記事だけ。フロントページより少なく濃い"),
      en("https://tldr.tech/api/rss/tech", "TLDR Tech", "https://tldr.tech", "その日のテックニュースを数行ずつ要約。朝の流し読み向き"),
      en("https://lobste.rs/rss", "Lobsters", "https://lobste.rs", "プログラミング寄りのリンク共有コミュニティ"),
      en("https://dev.to/feed", "DEV Community", "https://dev.to", "開発者のブログ投稿"),
      en("https://github.blog/feed/", "The GitHub Blog", "https://github.blog", "GitHub の公式ブログ"),
      en("https://www.theverge.com/rss/index.xml", "The Verge", "https://www.theverge.com", "テック・ガジェット・カルチャー"),
      en("https://feeds.arstechnica.com/arstechnica/index", "Ars Technica", "https://arstechnica.com", "技術寄りの深いテックニュース"),
      en("https://techcrunch.com/feed/", "TechCrunch", "https://techcrunch.com", "スタートアップと資金調達のニュース"),
      en("https://www.technologyreview.com/feed/", "MIT Technology Review", "https://www.technologyreview.com", "技術が社会に与える影響の解説"),
    ],
  },
  {
    id: "weekly",
    title: "週刊まとめ",
    description: "週に一度読めば追いつけるニュースレター",
    folder: "週刊まとめ",
    feeds: [
      ja("https://jser.info/rss/", "JSer.info", "https://jser.info", "JavaScript の週刊まとめ (日本語)"),
      en("https://cprss.s3.amazonaws.com/javascriptweekly.com.xml", "JavaScript Weekly", "https://javascriptweekly.com", "JavaScript の週刊ニュースレター"),
      en("https://cprss.s3.amazonaws.com/frontendfoc.us.xml", "Frontend Focus", "https://frontendfoc.us", "HTML / CSS / ブラウザの週刊ニュースレター"),
      en("https://cprss.s3.amazonaws.com/golangweekly.com.xml", "Golang Weekly", "https://golangweekly.com", "Go の週刊ニュースレター"),
      en("https://this-week-in-rust.org/rss.xml", "This Week in Rust", "https://this-week-in-rust.org", "Rust の週刊まとめ"),
      en("https://sreweekly.com/feed/", "SRE Weekly", "https://sreweekly.com", "障害事例と信頼性エンジニアリングの週刊まとめ"),
    ],
  },
  {
    id: "design",
    title: "設計・エンジニアリング",
    description: "システム設計・アーキテクチャ・開発組織の読み物",
    folder: "設計",
    feeds: [
      en("https://newsletter.pragmaticengineer.com/feed", "The Pragmatic Engineer", "https://newsletter.pragmaticengineer.com", "大手テック企業の開発組織と業界動向の深掘り"),
      en("https://blog.bytebytego.com/feed", "ByteByteGo", "https://blog.bytebytego.com", "システム設計を図解で解説"),
      en("https://martinfowler.com/feed.atom", "Martin Fowler", "https://martinfowler.com", "ソフトウェア設計・アーキテクチャの定番"),
      en("https://feed.infoq.com/", "InfoQ", "https://www.infoq.com", "アーキテクチャ・開発プロセスの記事とカンファレンス講演"),
      ja("https://www.infoq.com/jp/feed/", "InfoQ Japan", "https://www.infoq.com/jp/", "InfoQ の日本語版。更新は少なめ"),
      en("https://aws.amazon.com/blogs/architecture/feed/", "AWS Architecture Blog", "https://aws.amazon.com/blogs/architecture/", "AWS 上の設計パターンと事例"),
      en("https://overreacted.io/rss.xml", "overreacted", "https://overreacted.io", "Dan Abramov のブログ。React と考え方の話"),
    ],
  },
  {
    id: "web",
    title: "Web / フロントエンド",
    description: "フレームワーク公式ブログと、Web 開発の記事",
    folder: "Web",
    feeds: [
      en("https://nextjs.org/feed.xml", "Next.js Blog", "https://nextjs.org", "Next.js のリリースと機能紹介"),
      en("https://react.dev/rss.xml", "React Blog", "https://react.dev", "React 公式ブログ"),
      en("https://vercel.com/atom", "Vercel News", "https://vercel.com", "Vercel の新機能・変更"),
      en("https://devblogs.microsoft.com/typescript/feed/", "TypeScript Blog", "https://devblogs.microsoft.com/typescript/", "TypeScript のリリース告知。更新はまばら"),
      en("https://www.smashingmagazine.com/feed/", "Smashing Magazine", "https://www.smashingmagazine.com", "Web デザイン・CSS・UX の読み物"),
      ja("https://zenn.dev/topics/nextjs/feed", "Zenn: Next.js", "https://zenn.dev/topics/nextjs", "Zenn の Next.js トピック"),
      ja("https://zenn.dev/topics/typescript/feed", "Zenn: TypeScript", "https://zenn.dev/topics/typescript", "Zenn の TypeScript トピック"),
    ],
  },
  {
    id: "cloud",
    title: "クラウド / インフラ",
    description: "クラウド各社の新機能とインフラ技術",
    folder: "クラウド",
    feeds: [
      ja("https://aws.amazon.com/jp/blogs/news/feed/", "AWS ブログ (日本語)", "https://aws.amazon.com/jp/blogs/news/", "AWS の日本語公式ブログ"),
      en("https://aws.amazon.com/about-aws/whats-new/recent/feed/", "AWS What's New", "https://aws.amazon.com/new/", "AWS の新機能アナウンス。量が多い"),
      en("https://cloudblog.withgoogle.com/rss/", "Google Cloud Blog", "https://cloud.google.com/blog", "Google Cloud の公式ブログ"),
      en("https://blog.cloudflare.com/rss/", "Cloudflare Blog", "https://blog.cloudflare.com", "ネットワーク・セキュリティの深い技術記事"),
      en("https://kubernetes.io/feed.xml", "Kubernetes Blog", "https://kubernetes.io/blog/", "Kubernetes 公式ブログ"),
      ja("https://syu-m-5151.hatenablog.com/feed", "じゃあ、おうちで学べる", "https://syu-m-5151.hatenablog.com", "SRE・インフラ・キャリアの個人ブログ"),
      en("https://github.blog/changelog/feed/", "GitHub Changelog", "https://github.blog/changelog/", "GitHub の細かな機能追加・変更"),
      ja("https://qiita.com/tags/aws/feed", "Qiita: AWS", "https://qiita.com/tags/aws", "Qiita の AWS タグの新着"),
    ],
  },
  {
    id: "security",
    title: "セキュリティ",
    description: "脆弱性情報とセキュリティニュース",
    folder: "セキュリティ",
    feeds: [
      ja("https://www.jpcert.or.jp/rss/jpcert-all.rdf", "JPCERT/CC", "https://www.jpcert.or.jp", "注意喚起・脆弱性情報"),
      ja("https://www.security-next.com/feed", "Security NEXT", "https://www.security-next.com", "国内のセキュリティニュース"),
      en("https://feeds.feedburner.com/TheHackersNews", "The Hacker News", "https://thehackernews.com", "攻撃・脆弱性の速報"),
      en("https://krebsonsecurity.com/feed/", "Krebs on Security", "https://krebsonsecurity.com", "サイバー犯罪の調査報道"),
    ],
  },
  {
    id: "techblog",
    title: "企業テックブログ",
    description: "国内 Web 企業のエンジニアリングブログ",
    folder: "テックブログ",
    feeds: [
      ja("https://engineering.mercari.com/blog/feed.xml", "メルカリ", "https://engineering.mercari.com", "Mercari Engineering Blog"),
      ja("https://techblog.lycorp.co.jp/ja/feed/index.xml", "LINEヤフー", "https://techblog.lycorp.co.jp", "LY Corporation Tech Blog"),
      ja("https://developers.cyberagent.co.jp/blog/feed/", "サイバーエージェント", "https://developers.cyberagent.co.jp", "CyberAgent Developers Blog"),
      ja("https://developers.freee.co.jp/feed", "freee", "https://developers.freee.co.jp", "freee Developers Hub"),
      ja("https://tech.smarthr.jp/feed", "SmartHR", "https://tech.smarthr.jp", "SmartHR Tech Blog"),
      ja("https://techlife.cookpad.com/feed", "クックパッド", "https://techlife.cookpad.com", "クックパッド開発者ブログ"),
      ja("https://engineering.dena.com/index.xml", "DeNA", "https://engineering.dena.com", "DeNA Engineering"),
      ja("https://developer.hatenastaff.com/feed", "はてな", "https://developer.hatenastaff.com", "Hatena Developer Blog"),
      ja("https://techblog.zozo.com/feed", "ZOZO", "https://techblog.zozo.com", "ZOZO TECH BLOG"),
      ja("https://moneyforward-dev.jp/feed", "マネーフォワード", "https://moneyforward-dev.jp", "Money Forward Developers Blog"),
      ja("https://blog.cybozu.io/feed", "サイボウズ", "https://blog.cybozu.io", "Cybozu Inside Out"),
      ja("https://tech.layerx.co.jp/feed", "LayerX", "https://tech.layerx.co.jp", "LayerX エンジニアブログ"),
      ja("https://www.m3tech.blog/feed", "エムスリー", "https://www.m3tech.blog", "エムスリーテックブログ"),
      ja("https://tech.findy.co.jp/feed", "Findy", "https://tech.findy.co.jp", "Findy Tech Blog"),
      ja("https://tech.timee.co.jp/feed", "タイミー", "https://tech.timee.co.jp", "Timee Product Team Blog"),
      ja("https://tech.pepabo.com/feed.xml", "ペパボ", "https://tech.pepabo.com", "Pepabo Tech Portal"),
      ja("https://mixi-developers.mixi.co.jp/feed", "MIXI", "https://mixi-developers.mixi.co.jp", "MIXI DEVELOPERS"),
    ],
  },
  {
    id: "global-techblog",
    title: "海外テックブログ",
    description: "海外企業のエンジニアリングブログ",
    folder: "海外テックブログ",
    feeds: [
      en("https://netflixtechblog.com/feed", "Netflix", "https://netflixtechblog.com", "Netflix TechBlog"),
      en("https://stripe.com/blog/feed.rss", "Stripe", "https://stripe.com/blog", "Stripe の技術・プロダクトの記事"),
      en("https://engineering.fb.com/feed/", "Meta", "https://engineering.fb.com", "Engineering at Meta"),
      en("https://shopify.engineering/blog.atom", "Shopify", "https://shopify.engineering", "Shopify Engineering"),
      en("https://tailscale.com/blog/index.xml", "Tailscale", "https://tailscale.com/blog", "ネットワーク・WireGuard の深い技術記事"),
      en("https://planetscale.com/blog/feed.atom", "PlanetScale", "https://planetscale.com/blog", "データベース・MySQL / Postgres の技術記事"),
      en("https://fly.io/blog/feed.xml", "Fly.io", "https://fly.io/blog", "インフラと分散システムの読み物"),
    ],
  },
  {
    id: "lang",
    title: "言語・ランタイム",
    description: "プログラミング言語の公式ブログとトピック",
    folder: "言語",
    feeds: [
      en("https://blog.rust-lang.org/feed.xml", "Rust Blog", "https://blog.rust-lang.org", "Rust 公式ブログ"),
      en("https://go.dev/blog/feed.atom", "The Go Blog", "https://go.dev/blog", "Go 公式ブログ"),
      en("https://nodejs.org/en/feed/blog.xml", "Node.js Blog", "https://nodejs.org", "Node.js のリリースとセキュリティ情報"),
      ja("https://www.ruby-lang.org/ja/feeds/news.rss", "Ruby ニュース", "https://www.ruby-lang.org/ja/", "Ruby 公式サイトのニュース"),
      ja("https://zenn.dev/topics/rust/feed", "Zenn: Rust", "https://zenn.dev/topics/rust", "Zenn の Rust トピック"),
      ja("https://qiita.com/tags/python/feed", "Qiita: Python", "https://qiita.com/tags/python", "Qiita の Python タグの新着"),
    ],
  },
];

export const CATALOG_SIZE = CATALOG.reduce((n, c) => n + c.feeds.length, 0);
