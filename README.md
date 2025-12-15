# Mapa Acapulco Interativo

Aplicação web interativa para visualização e gestão de lotes do Jardim Acapulco, desenvolvida com React, Vite e Firebase. Permite navegação intuitiva pelo mapa, administração de dados e busca avançada.

## Tecnologias

- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **Backend/Services**: Firebase (Firestore, Auth, Hosting), Node.js (Express server for serve)
- **Map Interaction**: Custom Canvas/SVG logic for lot management

## Configuração

1. Clone o repositório.
2. Instale as dependências:
   ```bash
   pnpm install
   ```
3. Configure as variáveis de ambiente:
   - Copie o arquivo `.env.example` para `.env`:
     ```bash
     cp .env.example .env
     ```
   - Preencha as chaves do Firebase no arquivo `.env`.

4. Inicie o servidor de desenvolvimento:
   ```bash
   pnpm dev
   ```

## Scripts

- `pnpm dev`: Inicia o servidor de desenvolvimento.
- `pnpm build`: Gera a build de produção.
- `pnpm start`: Inicia o servidor de produção localmente.
