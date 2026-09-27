// アプリアイコン一式を public/logo.svg から作り直す: node scripts/icons.mjs
// sharp は next が画像最適化のために入れているものを使う
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const BG = "#6246d8";
const source = await readFile(new URL("../public/logo.svg", import.meta.url), "utf8");
// 背景の四角を除いた絵柄だけ
const glyph = source.replace(/<svg[^>]*>|<\/svg>|<rect[^>]*\/>/g, "").trim();

const svg = ({ scale = 1, bg = BG, radius = 0, mono = false } = {}) => {
  const body = mono ? glyph.replace(/#fff\b/g, "#000").replace(/ stroke-opacity="[^"]*"/g, "") : glyph;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${bg ? `<rect width="512" height="512" rx="${radius}" fill="${bg}"/>` : ""}
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${body}</g>
</svg>`);
};

const png = (input, size) => sharp(input, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/** PNG をそのまま入れた ICO。いまのブラウザはどれも読める */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size % 256, at);
    header.writeUInt8(size % 256, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(data.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

const out = (path, data) => writeFile(new URL(`../${path}`, import.meta.url), data);

// ホーム画面・タブ用。絵柄は四角いっぱいに置き、角は OS に任せる
const full = svg();
await out("public/icon-192.png", await png(full, 192));
await out("public/icon-512.png", await png(full, 512));
// iOS は透過を黒で塗るので背景つきのまま
await out("src/app/apple-icon.png", await png(full, 180));
// Android の丸・角丸マスクで欠けないよう、絵柄を中央 80% の安全域に収める
await out("public/icon-maskable-512.png", await png(svg({ scale: 0.8 }), 512));
// Android 13 以降のテーマアイコン。形だけ使われるので透過に黒一色
await out("public/icon-monochrome-512.png", await png(svg({ bg: null, scale: 0.8, mono: true }), 512));

// タブのアイコン。小さく出るので角を丸めた版にする
const tab = svg({ radius: 112 });
await out("src/app/icon.svg", tab);
await out(
  "src/app/favicon.ico",
  ico([
    { size: 16, data: await png(tab, 16) },
    { size: 32, data: await png(tab, 32) },
    { size: 48, data: await png(tab, 48) },
  ]),
);

console.log("icons written");
