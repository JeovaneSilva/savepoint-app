# SavePoint (app)

App mobile (Expo + React Native + TypeScript) para registrar os jogos que você zerou, está jogando ou quer jogar.
Backend: Supabase. Dados dos jogos: [IGDB](https://www.igdb.com) (Twitch).

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
   - `supabase/migrations/0001_rawg_cache.sql` (cache de respostas da API de jogos; o nome `rawg_*` é histórico e hoje serve à IGDB)
   - `supabase/migrations/0002_profiles_ranking.sql` (apelidos e ranking)
   - `supabase/migrations/0003_hours_unknown_date.sql` (horas para zerar e "não lembro quando zerei")
   - `supabase/migrations/0004_badges_profiles.sql` (selos, foto de perfil e perfis públicos)
   - `supabase/migrations/0005_avatars_read_policy.sql` (permite substituir a foto de perfil)
   - `supabase/migrations/0006_harder_badges.sql` (quadro de selos mais difícil; recalcula todos os selos)
   - `supabase/migrations/0007_account_approval.sql` (aprovação manual de contas)
   - `supabase/migrations/0008_rawg_user_limit.sql` (limite de buscas por usuário)
   - `supabase/migrations/0009_igdb.sql` (coluna `igdb_id`)
   - `supabase/migrations/0010_fresh_start.sql` (**apaga todas as bibliotecas** e deixa os jogos identificados só pelo id da IGDB; as contas ficam)
   - `supabase/migrations/0011_cleanup_rawg.sql` (remove o contador mensal e o cache antigos da RAWG)
2. **Busca de jogos (IGDB):** as credenciais da Twitch ficam numa Edge Function, nunca no app.
   - Crie um aplicativo em https://dev.twitch.tv/console (a conta Twitch precisa de verificação em duas etapas) e copie o
     **Client ID** e o **Client Secret**.
   - Em *Edge Functions → Secrets* do Supabase, crie `TWITCH_CLIENT_ID` e `TWITCH_CLIENT_SECRET`.
   - Publique a função `igdb` com o conteúdo de `supabase/functions/igdb/index.ts` (*Edge Functions → Deploy a new function → Via Editor*).
   - Listas exportadas antes da troca (que só têm o id da RAWG) ainda podem ser importadas: o app procura cada jogo na IGDB pelo título.

## Aprovação de contas

Toda conta nova nasce **pendente**: o app mostra "aguardando aprovação" e o banco não entrega nenhum dado
(nem a busca de jogos responde) até um administrador aprovar.

1. Rode a migration `0007`. Quem já tinha conta é aprovado automaticamente.
2. Torne-se administrador (uma vez), trocando o email:
   ```sql
   INSERT INTO public.app_admins (user_id)
   SELECT id FROM auth.users WHERE email = 'SEU_EMAIL_AQUI' ON CONFLICT DO NOTHING;
   ```
3. Publique a Edge Function `igdb` (ela confere a aprovação de quem chama).
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

## Limites da busca de jogos (IGDB)

A Edge Function `igdb` protege a API (a IGDB aceita cerca de 4 requisições por segundo no uso gratuito, não comercial):
- cache compartilhado no Supabase (respostas do cache não consomem a API; em falha da IGDB, serve a cópia guardada);
- **limite por usuário**: 300 requisições reais à IGDB por hora (cache hit é grátis). Ajuste com o secret `IGDB_USER_HOURLY_LIMIT`;
- limite de 8 s por chamada e pausa de 1 minuto depois de 3 falhas seguidas, para o app responder rápido quando a IGDB cai;
- os parâmetros de busca são validados; entradas fora do padrão recebem erro 400.

As tabelas `rawg_cache` e `rawg_user_usage` e a função `rawg_bump_user` mantêm o nome antigo, mas são usadas pela IGDB.

## Estrutura

- `app/` — rotas (Expo Router): landing, login, abas (Buscar, Biblioteca, Estatísticas) e detalhe do jogo
- `src/components/` — UI (`ui/`), componentes de jogo (`game/`), gráficos
- `src/hooks/` — auth e biblioteca (React Query + Supabase)
- `src/lib/` — cliente Supabase, IGDB, regras de negócio (`games.ts`)
- `src/theme.ts` — tokens de design (tema escuro roxo neon/ciano do SavePoint)
- `supabase/` — migrations SQL e a Edge Function `igdb`
