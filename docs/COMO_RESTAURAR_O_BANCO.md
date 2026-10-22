# Como ter o banco eleicoes_v2 na sua máquina

O banco não fica no git (tem 1,4 GB). Ele vai como uma cópia compactada (`pg_dump`, 135 MB) anexada a uma
**Release** deste repositório. Você baixa o arquivo e restaura no seu PostgreSQL: fica com o banco inteiro, com as
14 tabelas, as views e as views materializadas que respondem às perguntas. Cada um tem a sua cópia; nada do que você
fizer muda o banco de outra pessoa.

> O banco tem dados pessoais dos candidatos que o TSE publica (CPF, título de eleitor, data de nascimento). Por isso
> o repositório é privado. Não publique o arquivo nem o banco em lugar aberto.

## 1. O que precisa ter

- **PostgreSQL 18** (a cópia foi feita no 18.4; o `pg_restore` de versões anteriores não abre o arquivo).
  No Windows, o instalador do site do PostgreSQL já traz as extensões que o banco usa (`unaccent` e `pg_trgm`).
- Uns **3 GB livres** em disco.
- Acesso a este repositório no GitHub (o dono adiciona você como colaborador).

## 2. Baixar a cópia

Pelo site: na página do repositório, abra **Releases** (coluna da direita), entre na release mais recente com nome
`banco-...` e baixe `eleicoes_v2.dump`.

Ou pelo terminal, com o [GitHub CLI](https://cli.github.com) logado na sua conta:

```bash
gh release download --repo joaozin3661/EleicaoBDR --pattern "eleicoes_v2.dump"
```

(sem `banco-...` no comando, ele pega a release mais recente).

## 3. Restaurar

### Windows (PowerShell)

Troque o caminho do arquivo pelo lugar onde você salvou. Os comandos pedem a senha do usuário `postgres` que você
escolheu ao instalar o PostgreSQL.

```powershell
cd "C:\Program Files\PostgreSQL\18\bin"
.\createdb.exe -U postgres eleicoes_v2
.\pg_restore.exe -U postgres -d eleicoes_v2 --no-owner --no-privileges -j 4 "C:\Users\SEU_USUARIO\Downloads\eleicoes_v2.dump"
```

### Linux ou macOS

```bash
createdb -U postgres eleicoes_v2
pg_restore -U postgres -d eleicoes_v2 --no-owner --no-privileges -j 4 ~/Downloads/eleicoes_v2.dump
```

A restauração leva uns 5 minutos (`-j 4` usa quatro processos em paralelo). Não deve aparecer nenhum erro.

## 4. Conferir

```powershell
.\psql.exe -U postgres -d eleicoes_v2 -c "SELECT (SELECT count(*) FROM candidatura) AS candidaturas, (SELECT count(*) FROM pessoa) AS pessoas, (SELECT count(*) FROM votacao) AS votacao, (SELECT count(*) FROM mv_q5_eleito) AS eleitos_q5"
```

O resultado tem que ser:

| candidaturas | pessoas | votacao | eleitos_q5 |
| --- | --- | --- | --- |
| 569184 | 359408 | 2286514 | 25895 |

Pronto. A partir daqui, qualquer consulta das perguntas funciona, por exemplo
`SELECT * FROM mv_q1_custo_cadeira WHERE ano = 2022 AND cargo = 'DEPUTADO FEDERAL';`

## 5. Rodar o site de consulta (site_eleicoes)

```bash
cd site_eleicoes
cp .env.example .env        # no Windows: copy .env.example .env
```

Abra o `.env` e troque `COLOQUE_SUA_SENHA_AQUI` pela **sua** senha do `postgres`. Depois:

```bash
npm install
npm run dev
```

O `.env` fica fora do git (está no `.gitignore`): cada um usa a própria senha.

## 6. Quando o banco for atualizado

O dono gera uma nova cópia e cria outra release (`banco-<data>`). Para trocar a sua:

```powershell
.\dropdb.exe -U postgres eleicoes_v2
```

e repita os passos 2 a 4 com o arquivo novo.

## Se der problema

| Mensagem | O que fazer |
| --- | --- |
| `unsupported version (1.16) in file header` | O seu PostgreSQL é anterior ao 18. Instale o 18. |
| `database "eleicoes_v2" already exists` | Já existe um banco com esse nome. Apague com `dropdb` (passo 6) ou restaure com outro nome em `-d`. |
| `extension "unaccent" is not available` | Faltam as extensões do PostgreSQL. No Linux, instale o pacote `postgresql-contrib`. |
| `password authentication failed` | A senha é a do `postgres` da sua instalação, não a de outra pessoa. |

## Como a cópia é gerada (para o dono do repositório)

```powershell
cd "C:\Program Files\PostgreSQL\18\bin"
.\pg_dump.exe -U postgres -d eleicoes_v2 -Fc -Z 9 --no-owner --no-privileges -f "...\crawler\dados\_dump\eleicoes_v2.dump"
gh release create banco-AAAA-MM-DD "...\crawler\dados\_dump\eleicoes_v2.dump" --repo joaozin3661/EleicaoBDR --title "Banco eleicoes_v2 (AAAA-MM-DD)" --notes "Cópia do banco. Veja docs/COMO_RESTAURAR_O_BANCO.md."
```

A pasta `dados/_dump/` está no `.gitignore`: o arquivo nunca entra num commit, só na release.
