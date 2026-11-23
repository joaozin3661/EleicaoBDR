/* Cria (ou recria) todas as views do banco eleicoes, na ordem certa: cada arquivo depende dos anteriores.
   Rode depois da carga (banco/carga/), a partir da raiz do projeto:

     psql -U postgres -d eleicoes -f banco/sql/aplicar_views.sql

   O 09_q9.sql é o mais lento (uns 40 minutos com as 27 UFs). */

\set ON_ERROR_STOP on
\ir views/01_base.sql
\ir views/02_q2.sql
\ir views/03_q3.sql
\ir views/04_q4.sql
\ir views/05_q5.sql
\ir views/06_q6.sql
\ir views/07_q7.sql
\ir views/08_q8.sql
\ir views/09_q9.sql
\ir views/10_site.sql
