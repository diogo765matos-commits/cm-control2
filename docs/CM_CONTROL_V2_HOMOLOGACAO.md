# C&M Control V2 — roteiro de homologação sem produção

Este roteiro não autoriza alterações no site oficial, na branch remota, no Vercel ou no banco oficial. Deve-se avaliar código, dados e Auth exclusivamente no destino de teste aprovado. Não incluir relatórios reais, chaves nem dados pessoais em pacotes de código.

## Escolher o cenário com evidência

Distinguir o esquema do aplicativo atual do pacote beta Jarvis em outro checkout. Ter o código da beta não prova que esteja instalado em produção. No destino escolhido para a futura homologação, confirmar, em consulta somente de leitura e sem contar ou copiar registros:

```sql
begin read only;
select to_regprocedure('public.cm_viagens_read(jsonb)') is not null as beta_leitura_encontrada,
       to_regprocedure('public.cm_viagens_mutate(jsonb)') is not null as beta_mutacao_encontrada,
       to_regprocedure('public.cm_is_integration_principal()') is not null as regra_identidade_integracao,
       to_regclass('public.cm_viagens_legacy_candidates') is not null as indice_beta_encontrado,
       has_table_privilege('authenticated', 'public.viagens_semanas', 'INSERT') as insert_legado,
       has_table_privilege('authenticated', 'public.viagens_semanas', 'UPDATE') as update_legado;
select policyname, permissive, roles, cmd
  from pg_catalog.pg_policies
 where schemaname='public' and tablename='viagens_semanas'
 order by policyname;
rollback;
```

Na vistoria independente e somente de catálogo em 23/11/2026, não foram encontrados os marcadores do pacote beta conhecido no banco oficial. Isso não confirma o estado de outras integrações, não elimina a necessidade de conferir novamente no destino escolhido e não autoriza publicação.

As permissões acima não substituem testes com sessões reais de teste. Um grant pode existir e o RLS negar. A V2 não deve ser publicada se o destino executar o cenário incompatível da beta. Não remova RLS, não exponha chaves de serviço e não force a RPC com privilégios amplos para fazê-la funcionar.

## Cenário beta Jarvis observado localmente

Veja [evidências e comandos do ensaio da beta](CM_CONTROL_V2_COMPATIBILIDADE_JARVIS.md).

- A função real de leitura da beta, ensaiada somente com registros fictícios, continua lendo as semanas antigas e os campos fiscais do JSON canônico V2 (placa, NF, CT-e, datas, volumes e taxa).
- A beta revoga a escrita direta de `authenticated` nas viagens legadas. Nesse cenário, a RPC V2 não consegue gravar (erro 42501 esperado no ensaio de incompatibilidade) e os guardas da integração não foram removidos. Se for mesmo o destino de publicação, resolver o fluxo humano preservando os guardas do Jarvis em nova revisão e revalidar a coexistência antes de prosseguir.
- O índice de candidatos antigos da beta não incluiu a nova viagem V2 na prova de leitura. No cenário beta, não confiar nele para concluir inexistência de duplicata sem consultar as viagens canônicas e validar a sincronia. Qualquer adaptação ao índice é uma etapa separada.
- O login humano e o OAuth não devem compartilhar o escopo V2. Sessões com claim `client_id`, anônimas, sem identidade válida ou reconhecidas como principais de integração pela beta não recebem os direitos da equipe humana nas tabelas e RPCs novas. A leitura antiga da beta permanece sob suas permissões originais.

## Evidência local

PostgreSQL nativo 17.12 e PostgREST 14.18 responderam via HTTP local, com backup nativo e duas restaurações verificadas antes de aplicar a migração. O ensaio viu três requisições bloqueadas em conexões distintas e comprovou ausência de perda/duplicação, rejeição do CAS legado desatualizado, manutenção da viagem após troca de motorista e de comissão, reembolso parcial/quitado, escopos das despesas e recusa de acesso nas funções novas para sujeitos não autorizados. As chaves eram descartáveis e os JWTs de teste foram emitidos no próprio harness; o login do Supabase hospedado e autenticação das integrações reais não foram ensaiados.

Referência do provedor sobre separação de OAuth no RLS: [Supabase: Token Security and Row Level Security](https://supabase.com/docs/guides/auth/oauth-server/token-security).

## Vínculos históricos: conferência humana

O ensaio usa frota própria, terceirizados com nomes únicos, marcadores vazios/repetidos e Bagaço. Somente a relação candidata de placa e nome terceirizado inequivocamente único é projetada; não é feita ligação histórica da frota própria nem cópia de viagens. Um caso ambíguo fica sem vínculo. Antes de liberar históricos, a pessoa responsável deve conferir se o condutor atual realmente se aplica a todas as viagens antigas daquela placa; nome único sozinho não prova continuidade. Compare placa, condutor e período com a fonte interna autorizada. Playbook sem acesso a dados reais: identificar os casos, registrar quantidades, pedir confirmação sobre divergências e não criar vínculo por inferência.

## Comparar sem expor dados

1. No destino isolado aprovado, gerar os relatórios de referência com o código anterior e a V2 sobre a mesma massa permitida e congelada. Conferir, por período e frota, contagens, soma de volumes, bruto, comissão/repasse, documentos fiscais e datas. Conferir relatórios visuais, Excel/formatos e consulta do Jarvis sob limites de leitura. Nenhum relatório real foi exportado nesta homologação local.
2. Antes de discutir publicação, confirmar origem do deploy/branch e isolamento dos previews e variáveis no Vercel. Confirmar a versão do PostgREST e o funcionamento do login Supabase na homologação, sem colocar tokens no repositório.
3. Backup de produção, recuperação testada em destino permitido e autorização expressa continuam pré-requisitos separados. Não restaurar backup por cima do banco ativo. Consulte o roteiro da migração aditiva em `CM_CONTROL_V2_MIGRACAO.md`.

## Preview hospedado: navegação direta e conta sintética

A [documentação oficial do Vercel para Vite](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas) explica que uma SPA precisa servir o documento inicial para URLs navegadas diretamente. O `vercel.json` reescreve somente as rotas do React Router, incluindo `/caminhao/:id`, para `/index.html` sem alterar a URL. Arquivos e caminhos de API não são alvos dessas regras; mantenha o padrão de URL com `cleanUrls` desabilitado. Não considere o comportamento do Vite dev prova da hospedagem.

Antes de qualquer Preview autorizado, no projeto **de teste separado**, desative o cadastro público e anônimo no Supabase Auth e não configure SMTP personalizado nem redirecionamento para produção. Use exclusivamente uma conta sintética provisionada pelo administrador e já confirmada no painel, sem e-mail a enviar. Nenhum segredo deve ser enviado em chat ou registrado na branch. Não reutilize credenciais, projeto, usuários ou URLs de produção. A permissão do servidor é obrigatória: esconder o botão não protege a API de Auth.

No Vercel configure `VITE_CM_PREVIEW=1` exclusivamente para Preview antes de construir. Uma build marcada explicitamente ou identificada por `VERCEL_ENV=preview` só passa com valor `1`, com a URL HTTPS exata do projeto de teste e com a chave pública JWT `anon` desse mesmo projeto (nunca chave administrativa). Valide as três variáveis da branch e o artefato instalado. O cadastro fica desabilitado no cliente do Preview, inclusive no modo de ensaio estritamente local `vite build --mode preview`. O comportamento de builds normais permanece. Isso não substitui fechar o cadastro no servidor.

No aceite hospedado aprovado, abra diretamente a URL de um caminhão de teste e confirme resposta HTML 200 sem redirect. Sem sessão deve aparecer só **Entrar**, sem opção **Criar conta**. Entre por e-mail e senha com a conta sintética, confira que a mesma URL agora mostra a placa correta, abra em nova aba e recarregue. Verifique JS, CSS e ícone estáticos com conteúdo correto; caminhos sem rota não devem ser engolidos pelo fallback. Confirme no painel de rede ausência de chamadas a signup. Estado hospedado não foi alterado nem testado na preparação local.

Para reproduzir o ensaio local, gere builds estáticas descartáveis com `VITE_SUPABASE_URL=http://127.0.0.1:4781` e chave fictícia, uma com `vite build --mode preview` e outra em modo normal, ambas sem `VITE_CM_PREVIEW` e sem `VERCEL_ENV`. O modo local permite o endereço loopback; não use esse caminho para hospedagem. Execute `node docs/test-v2-preview.mjs` com `PREVIEW_DIST` e, opcionalmente, `NORMAL_DIST` apontando para as pastas de build, mais `PLAYWRIGHT_MODULE` e `CHROMIUM_EXECUTABLE` locais. O script lê as regras do repositório, serve os assets reais e intercepta as chamadas de autenticação; não é um teste do serviço hospedado.
