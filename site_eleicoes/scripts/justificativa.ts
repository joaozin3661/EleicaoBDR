/** Converte ../JUSTIFICATIVA_DADOS.md em estatico/justificativa.html, página que acompanha a versão estática do site. */
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

const raiz = path.resolve(import.meta.dirname, "..");
const md = fs.readFileSync(path.resolve(raiz, "..", "JUSTIFICATIVA_DADOS.md"), "utf8");
const corpo = marked.parse(md, { gfm: true }) as string;

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Justificativa dos dados · Eleições em Dados</title>
<link rel="icon" href="data:," />
<style>
:root { --bg:#faf9f7; --surface:#fff; --text:#1c1b1a; --muted:#5f5d58; --border:#e2dfd8; --accent:#2a78d6; --code:#f0eeea; }
@media (prefers-color-scheme: dark) { :root { --bg:#161513; --surface:#1e1d1b; --text:#ece9e3; --muted:#a8a49c; --border:#34322e; --accent:#6aa7ee; --code:#2a2825; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font:16px/1.65 system-ui, "Segoe UI", sans-serif; }
main { max-width: 920px; margin: 0 auto; padding: 24px 16px 80px; }
.voltar { display:inline-block; margin-bottom:16px; color:var(--accent); text-decoration:none; font-size:14px; }
h1 { font-size: 30px; line-height:1.2; margin: 8px 0 16px; }
h2 { font-size: 22px; margin: 40px 0 8px; padding-top: 16px; border-top: 1px solid var(--border); }
h3 { font-size: 17px; margin: 24px 0 4px; }
p, li { color: var(--text); }
hr { border: 0; border-top: 1px solid var(--border); margin: 24px 0; }
code { background: var(--code); padding: 1px 5px; border-radius: 4px; font-size: 0.9em; }
pre { background: var(--code); padding: 12px; border-radius: 8px; overflow-x: auto; }
pre code { background: none; padding: 0; }
.tabela { overflow-x: auto; margin: 12px 0; }
table { border-collapse: collapse; font-size: 14px; min-width: 100%; }
th, td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; vertical-align: top; }
th { background: var(--surface); }
a { color: var(--accent); }
</style>
</head>
<body>
<main>
<a class="voltar" href="./">← Voltar ao site</a>
${corpo.replace(/<table>/g, '<div class="tabela"><table>').replace(/<\/table>/g, "</table></div>")}
</main>
</body>
</html>
`;

fs.mkdirSync(path.join(raiz, "estatico"), { recursive: true });
fs.writeFileSync(path.join(raiz, "estatico", "justificativa.html"), html);
console.log(`estatico/justificativa.html gerado (${(html.length / 1024).toFixed(0)} KB)`);
