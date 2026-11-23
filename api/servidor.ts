/** npm start: o site (frontend/) e a API na mesma porta, lendo o banco ao vivo. */
import { inicia } from "./rotas";

const { porta, banco } = await inicia(Number(process.env.PORT ?? 3001));
console.log(`Site e API (banco ${banco}) em http://localhost:${porta}`);
