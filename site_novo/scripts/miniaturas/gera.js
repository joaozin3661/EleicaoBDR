/* Gera as miniaturas WebP das fotos dos candidatos em site_novo/fotos/<id_candidatura>.webp, a partir da lista
   gravada por scripts/exporta_fotos.py. As originais do TSE têm 161 × 225 px em JPEG pouco comprimido (~29 KB);
   a miniatura mantém o tamanho e fica com ~3 KB. Pula as que já existem, então pode rodar de novo.
   Uso: node scripts/miniaturas/gera.js */

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const lista = JSON.parse(fs.readFileSync(path.join(__dirname, "lista.json"), "utf8"));
const destino = path.resolve(__dirname, "..", "..", "fotos");
fs.mkdirSync(destino, { recursive: true });

let feitas = 0, puladas = 0, falhas = 0, bytes = 0, i = 0;
const t0 = Date.now();

async function trabalha() {
  while (i < lista.length) {
    const [id, origem] = lista[i++];
    const saida = path.join(destino, `${id}.webp`);
    if (fs.existsSync(saida)) { puladas++; continue; }
    try {
      const buf = await sharp(origem).resize(161, 225, { fit: "cover", withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
      fs.writeFileSync(saida, buf);
      bytes += buf.length;
      feitas++;
    } catch (e) {
      falhas++;
      if (falhas <= 10) console.warn(`falhou ${id}: ${e.message}`);
    }
    if ((feitas + puladas + falhas) % 2000 === 0) console.log(`${feitas + puladas + falhas} de ${lista.length}...`);
  }
}

Promise.all(Array.from({ length: 8 }, trabalha)).then(() => {
  const mb = (bytes / 1e6).toFixed(1);
  console.log(`feitas ${feitas} (${mb} MB), já existiam ${puladas}, falhas ${falhas}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (falhas) process.exitCode = 1;
});
