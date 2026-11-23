/** Busca a foto de um candidato direto no zip oficial do TSE (cdn.tse.jus.br), sem baixar o zip inteiro.
 *
 * Os zips de fotos (foto_cand<ano>_<UF>_div.zip, de 100 MB a 2 GB) aceitam pedidos de pedaço (Range). Aqui se lê
 * só o diretório do zip (o índice que fica no fim do arquivo, guardado em memória por zip) e depois só os bytes
 * da foto pedida, uns 30 KB. A foto é gravada em dados/tse/fotos_candidatos/<ano>/<UF>/, no mesmo lugar e com o
 * mesmo nome do baixar_fotos.py, então da segunda vez ela sai do disco.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const URL_ZIP = (ano: number, uf: string) =>
  `https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes${ano}/fotos/foto_cand${ano}_${uf}_div.zip`;

type Entrada = { nome: string; metodo: number; comprimido: number; offset: number };
const diretorios = new Map<string, Promise<Map<string, Entrada> | null>>();

async function pedaco(url: string, inicio: number, fim: number): Promise<Buffer> {
  const r = await fetch(url, { headers: { Range: `bytes=${inicio}-${fim}` } });
  if (r.status !== 206) throw new Error(`o TSE respondeu ${r.status} ao pedido de pedaço`);
  return Buffer.from(await r.arrayBuffer());
}

async function tamanho(url: string): Promise<number> {
  const r = await fetch(url, { method: "HEAD" });
  if (!r.ok) throw new Error(`o TSE respondeu ${r.status}`);
  return Number(r.headers.get("content-length"));
}

/** Lê o diretório central do zip (com ZIP64, porque os zips grandes passam de 65.535 fotos ou de 4 GB). */
async function leDiretorio(url: string): Promise<Map<string, Entrada>> {
  const total = await tamanho(url);
  const cauda = await pedaco(url, Math.max(0, total - 65_600), total - 1);
  const iEocd = cauda.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (iEocd < 0) throw new Error("fim do zip não encontrado");
  let qtd = cauda.readUInt16LE(iEocd + 10);
  let tamDir = cauda.readUInt32LE(iEocd + 12);
  let iniDir = cauda.readUInt32LE(iEocd + 16);
  const iLoc = cauda.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x07]), iEocd);
  if (iLoc >= 0) {
    // ZIP64: o registro de fim de 64 bits diz onde está o diretório
    const off64 = Number(cauda.readBigUInt64LE(iLoc + 8));
    const reg = await pedaco(url, off64, off64 + 55);
    qtd = Number(reg.readBigUInt64LE(32));
    tamDir = Number(reg.readBigUInt64LE(40));
    iniDir = Number(reg.readBigUInt64LE(48));
  }
  const dir = await pedaco(url, iniDir, iniDir + tamDir - 1);
  const mapa = new Map<string, Entrada>();
  let p = 0;
  for (let k = 0; k < qtd && p + 46 <= dir.length; k++) {
    if (dir.readUInt32LE(p) !== 0x02014b50) break;
    const metodo = dir.readUInt16LE(p + 10);
    let comprimido = dir.readUInt32LE(p + 20);
    const descomprimido = dir.readUInt32LE(p + 24);
    const nNome = dir.readUInt16LE(p + 28), nExtra = dir.readUInt16LE(p + 30), nComent = dir.readUInt16LE(p + 32);
    let offset = dir.readUInt32LE(p + 42);
    const nome = dir.subarray(p + 46, p + 46 + nNome).toString("latin1").split("/").pop() ?? "";
    // campo extra ZIP64 (id 0x0001): só traz os valores que no registro comum estão como 0xFFFFFFFF, nesta ordem
    let e = p + 46 + nNome;
    const fimExtra = e + nExtra;
    while (e + 4 <= fimExtra) {
      const id = dir.readUInt16LE(e), n = dir.readUInt16LE(e + 2);
      if (id === 0x0001) {
        let q = e + 4;
        if (descomprimido === 0xffffffff) q += 8;
        if (comprimido === 0xffffffff) { comprimido = Number(dir.readBigUInt64LE(q)); q += 8; }
        if (offset === 0xffffffff) offset = Number(dir.readBigUInt64LE(q));
      }
      e += 4 + n;
    }
    mapa.set(nome.toUpperCase(), { nome, metodo, comprimido, offset });
    p = fimExtra + nComent;
  }
  return mapa;
}

/** Devolve o caminho da foto gravada em disco, ou null se o TSE não tem foto desse candidato. */
export async function fotoDoTse(destino: string, ano: number, uf: string, id: string): Promise<string | null> {
  const url = URL_ZIP(ano, uf);
  if (!diretorios.has(url)) {
    const p = leDiretorio(url).catch((e) => {
      console.warn(`fotos: não deu para ler ${url}: ${e.message}`);
      diretorios.delete(url); // tenta de novo no próximo pedido (pode ter sido a internet)
      return null;
    });
    diretorios.set(url, p);
  }
  const dir = await diretorios.get(url)!;
  if (!dir) return null;
  const ent = dir.get(`F${uf}${id}_DIV.JPG`) ?? dir.get(`F${uf}${id}_DIV.JPEG`) ?? dir.get(`F${uf}${id}_DIV.PNG`);
  if (!ent) return null;
  const cab = await pedaco(url, ent.offset, ent.offset + 29);
  const ini = ent.offset + 30 + cab.readUInt16LE(26) + cab.readUInt16LE(28);
  const bruto = await pedaco(url, ini, ini + ent.comprimido - 1);
  const img = ent.metodo === 8 ? zlib.inflateRawSync(bruto) : bruto;
  const alvo = path.join(destino, String(ano), uf, ent.nome);
  await fs.promises.mkdir(path.dirname(alvo), { recursive: true });
  await fs.promises.writeFile(alvo, img);
  return alvo;
}
