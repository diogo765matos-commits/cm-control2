# Colocando o CM Control no ar

O sistema foi adaptado para guardar os dados no [Supabase](https://supabase.com)
(banco de dados compartilhado, gratuito) em vez do armazenamento local do
navegador. Assim, todo mundo que acessar vê os mesmos caminhões, viagens,
abastecimentos e despesas. O acesso exige login, e o próprio sistema tem
uma tela de "Criar conta" — qualquer pessoa com o link pode se cadastrar
e entrar. Veja a observação sobre isso no final deste guia.

Siga os passos na ordem.

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta (dá para
   usar a conta do GitHub).
2. Clique em **New Project**. Escolha um nome (ex: `cm-control`), uma senha
   de banco de dados (guarde em local seguro) e a região mais próxima
   (ex: São Paulo/`sa-east-1`).
3. Aguarde uns 2 minutos até o projeto ficar pronto.

## 2. Criar as tabelas

1. No painel do projeto, abra **SQL Editor** (menu lateral) → **New query**.
2. Abra o arquivo `supabase-schema.sql` (está na raiz do projeto), copie
   todo o conteúdo, cole no editor e clique em **Run**.
3. Isso cria as tabelas `caminhoes`, `viagens_semanas`,
   `abastecimento_semanas` e `despesas_semanas`, já com a regra de que só
   usuários logados podem ler/escrever.

## 3. Liberar o cadastro sem confirmação por e-mail

O sistema já tem uma aba "Criar conta" na tela de login, então você (e
quem mais precisar) pode criar o próprio acesso direto pelo site, sem
precisar entrar no Supabase. Para isso funcionar sem travar esperando
e-mail de confirmação:

1. Vá em **Authentication → Providers → Email**.
2. Desligue **"Confirm email"** (às vezes aparece como "Enable email
   confirmations"). Com isso desligado, a conta já entra logada assim que
   a pessoa clica em "Criar conta".
3. Deixe **"Allow new users to sign up"** ligado (é o padrão) — é o que
   permite a tela de cadastro do sistema funcionar.

Se preferir manter mais controle (só quem você aprovar entra), pule este
passo e crie as contas manualmente em **Authentication → Users → Add
user**, marcando "Auto Confirm User" — nesse caso a aba "Criar conta" do
sistema não vai funcionar (vai pedir confirmação por e-mail que nunca
chega), então avise as pessoas para usar só "Entrar".

## 4. Pegar as chaves do projeto

Em **Project Settings → API**, copie:

- **Project URL**
- **anon public key**

## 5. Testar localmente antes de publicar

1. Na pasta do projeto, copie `.env.local.example` para um novo arquivo
   chamado `.env.local` e preencha com os valores do passo 4:

   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon-public
   ```

2. Rode:

   ```
   npm install
   npm run dev
   ```

3. Abra o endereço mostrado no terminal, clique em "Criar conta" e
   cadastre seu e-mail e senha. Depois confira se consegue cadastrar um
   caminhão, uma semana de viagens etc. Se algo der erro, me avise com a
   mensagem exata que aparece.

## 6. Publicar no GitHub

O projeto já está conectado ao repositório
`github.com/diogo765matos-commits/cm-control2`. Suba as mudanças a partir
do seu computador (onde você tem acesso ao GitHub configurado):

```
git add .
git commit -m "Conecta o sistema ao Supabase e adiciona login"
git push
```

(O arquivo `.env.local` não vai subir — ele já está no `.gitignore` — e
isso é o correto, as chaves ficam só na Vercel.)

## 7. Publicar na Vercel

1. Acesse [vercel.com](https://vercel.com) e entre com sua conta do
   GitHub.
2. **Add New → Project**, selecione o repositório `cm-control2`.
3. A Vercel detecta automaticamente que é um projeto Vite — não precisa
   mudar nada em build/output.
4. Antes de clicar em **Deploy**, abra **Environment Variables** e
   adicione as duas mesmas variáveis do passo 4:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Clique em **Deploy**. Em ~1 minuto você recebe uma URL pública (algo
   como `cm-control2.vercel.app`).

## 8. Compartilhar

Envie a URL da Vercel para quem for usar o sistema — cada pessoa cria a
própria conta pela aba "Criar conta". Sempre que você der `git push` de
novo, a Vercel republica automaticamente.

---

### Observações

- **Importante — segurança:** como o cadastro é aberto, qualquer pessoa
  que tiver o link da Vercel consegue criar uma conta e ver os dados
  financeiros da frota (não é preciso convite ou aprovação sua). Para um
  sistema interno isso costuma ser aceitável se o link não for divulgado
  publicamente, mas se quiser mais controle depois, me avise — dá para
  fechar o cadastro e voltar a criar os acessos manualmente pelo painel
  do Supabase (passo 3, segunda opção).
- As sessões de login expiram por padrão em cerca de 1 hora (configurável
  em **Authentication → Settings → JWT expiry** no Supabase); depois disso
  a pessoa só precisa entrar de novo.
- Para remover o acesso de alguém, exclua o usuário em
  **Authentication → Users** no Supabase — não precisa mexer no código.
- Existem dois arquivos `__check.mjs` / `__check2.mjs` na raiz do projeto,
  criados durante verificações de sintaxe; pode apagar os dois com
  segurança.
