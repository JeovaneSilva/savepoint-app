# SavePoint (app)

App mobile (Expo + React Native + TypeScript) para registrar os jogos que você zerou, está jogando ou quer jogar.
Backend: Supabase. Dados dos jogos: [RAWG](https://rawg.io).

## Rodando

```bash
npm install
cp .env.example .env   # preencha com a URL e a publishable key do seu projeto Supabase
npx expo start
```

Escaneie o QR code com o **Expo Go** ou use `npm run android` / `npm run ios` / `npm run web`.

## Backend (Supabase)

1. **Tabelas e funções:** rode no SQL Editor, em ordem:
   - `supabase/migrations/0000_init_user_games.sql` (biblioteca)
   - `supabase/migrations/0001_rawg_cache.sql` (cache da RAWG e contador mensal)
   - `supabase/migrations/0002_profiles_ranking.sql` (apelidos e ranking)
2. **Busca de jogos:** a chave da RAWG fica numa Edge Function, nunca no app.

```bash
npm i -g supabase            # ou use: npx supabase ...
supabase login
supabase link --project-ref <seu-project-ref>
supabase secrets set RAWG_API_KEY=<sua chave da RAWG>
supabase functions deploy rawg
```

Chave gratuita da RAWG: https://rawg.io/apidocs

## Estrutura

- `app/` — rotas (Expo Router): landing, login, abas (Buscar, Biblioteca, Estatísticas) e detalhe do jogo
- `src/components/` — UI (`ui/`), componentes de jogo (`game/`), gráficos
- `src/hooks/` — auth e biblioteca (React Query + Supabase)
- `src/lib/` — cliente Supabase, RAWG, regras de negócio (`games.ts`)
- `src/theme.ts` — tokens de design (tema escuro roxo neon/ciano do SavePoint)
- `supabase/` — migration SQL e Edge Function `rawg`
