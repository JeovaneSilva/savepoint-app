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
   - `supabase/migrations/0003_hours_unknown_date.sql` (horas para zerar e "não lembro quando zerei")
   - `supabase/migrations/0004_badges_profiles.sql` (selos, foto de perfil e perfis públicos)
   - `supabase/migrations/0005_avatars_read_policy.sql` (permite substituir a foto de perfil)
   - `supabase/migrations/0006_harder_badges.sql` (quadro de selos mais difícil; recalcula todos os selos)
   - `supabase/migrations/0007_account_approval.sql` (aprovação manual de contas)
2. **Busca de jogos:** a chave da RAWG fica numa Edge Function, nunca no app.

```bash
npm i -g supabase            # ou use: npx supabase ...
supabase login
supabase link --project-ref <seu-project-ref>
supabase secrets set RAWG_API_KEY=<sua chave da RAWG>
supabase functions deploy rawg
```

Chave gratuita da RAWG: https://rawg.io/apidocs

## Aprovação de contas

Toda conta nova nasce **pendente**: o app mostra "aguardando aprovação" e o banco não entrega nenhum dado
(nem a busca da RAWG responde) até um administrador aprovar.

1. Rode a migration `0007`. Quem já tinha conta é aprovado automaticamente.
2. Torne-se administrador (uma vez), trocando o email:
   ```sql
   INSERT INTO public.app_admins (user_id)
   SELECT id FROM auth.users WHERE email = 'SEU_EMAIL_AQUI' ON CONFLICT DO NOTHING;
   ```
3. Publique de novo a Edge Function `rawg` (ela agora confere a aprovação).
4. No app: **Meu perfil → Aprovar contas** (um ponto vermelho no seu avatar avisa quando há pendências).

Sem o app, também dá para aprovar no painel: **Table Editor → `account_approvals` → coluna `status`** (`approved`, `pending`, `blocked`).

## Gerar o APK (Android)

O APK é o instalador que você manda para os amigos. Usa o EAS Build (Expo), que compila na nuvem; não precisa de Android Studio.

1. Crie uma conta gratuita em https://expo.dev e, na pasta do projeto, entre nela:
   ```bash
   npx eas-cli login
   ```
2. Vincule o projeto à sua conta (uma vez; grava o `projectId` no `app.json`):
   ```bash
   npx eas-cli init
   ```
3. Envie as chaves do Supabase para o ambiente `preview` do EAS. O `.env` não vai para o build (está no `.gitignore`), e sem estas
   variáveis o app abriria com erro. São a URL e a chave **pública** do projeto:
   ```bash
   npx eas-cli env:push preview --path .env
   ```
4. Gere o APK (leva uns 10 a 20 minutos; na primeira vez ele oferece criar a chave de assinatura: aceite):
   ```bash
   npx eas-cli build --platform android --profile preview
   ```
5. Ao terminar, o EAS mostra um link e um QR code. Quem abrir o link no celular Android baixa o `.apk`; é preciso permitir a instalação de
   apps de fontes desconhecidas. **Guarde a chave de assinatura** (o EAS a mantém na sua conta): atualizações só instalam por cima se
   forem assinadas com a mesma chave.

Cada mudança no app exige um novo build (o plano gratuito tem limite mensal de builds). Os perfis estão em `eas.json`:
`preview` gera APK para instalar direto; `production` gera AAB, que é o formato da Play Store.

## Estrutura

- `app/` — rotas (Expo Router): landing, login, abas (Buscar, Biblioteca, Estatísticas) e detalhe do jogo
- `src/components/` — UI (`ui/`), componentes de jogo (`game/`), gráficos
- `src/hooks/` — auth e biblioteca (React Query + Supabase)
- `src/lib/` — cliente Supabase, RAWG, regras de negócio (`games.ts`)
- `src/theme.ts` — tokens de design (tema escuro roxo neon/ciano do SavePoint)
- `supabase/` — migration SQL e Edge Function `rawg`
