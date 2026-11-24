# Homologação isolada: C&M Control V2 e Jarvis

O checkout candidato ac1b46f do Jarvis foi usado **apenas como fonte local de referência**. Isso não identifica a versão em produção, nem autoriza publicar o código, aplicar migrações ou reutilizar credenciais reais.

- Os 211 testes sintéticos do Jarvis candidato passam sem credenciais ou tráfego de produção.
- O script de compatibilidade aplica as duas migrações da beta e a V2 em PostgreSQL local em memória, com dois backups sintéticos e restauração conferida antes das respectivas migrações. A leitura oficial do código beta mantém as viagens anteriores idênticas e enxerga o formato V2 aditivo, incluindo NF e CT-e literais, as duas datas, volumes e frete. Nesse ensaio específico da beta, a camada SQL foi chamada diretamente, sem rede. O ensaio HTTP do cenário sem beta está documentado no roteiro de homologação.
- O acesso às tabelas/RPCs da V2 exclui usuários anônimos, sessões OAuth (presença de `client_id`) e contas dedicadas reconhecidas pelo classificador da beta quando ele existe. A V2 não concede acesso novo ao Jarvis. O uso de `client_id` segue a [documentação do Supabase sobre tokens e RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security).
- Os testes de relatório reabrem os arquivos gerados em ExcelJS 4.4.0. Validam layout histórico, datas, identificadores fiscais, valores, percentuais mistos/zero, exportação por placa e formato separado do Bagaço.

## Dois bloqueios se o destino usar a beta testada

1. A beta 20261015 retirou escrita direta na tabela de semanas e impôs políticas restritivas. Sob essa configuração, a RPC `SECURITY INVOKER` da V2 recusa um lançamento mesmo para a sessão comum com ACL beta. Em uma base isolada que usa apenas o esquema do aplicativo atual, sem essas políticas beta, o ensaio V2 de lançamento passa. Não remover guardas, ampliar privilégios ou contornar esse bloqueio. Se a coexistência for necessária, revisar a arquitetura da escrita em conjunto e testar a rota restrita escolhida separadamente.
2. O caminho `duplicates` da beta usa candidatos indexados durante a migração e um catálogo próprio de operações/documentos. Uma viagem inserida no JSON canônico pela V2 pode aparecer em `trips` sem entrar no índice de candidatos. Não interpretar `CLEAR` como verificação integral desse banco misto. Para avaliar em homologação, use uma nota sintética cadastrada pela UI, confira sua presença em `trips` e na consulta de candidatos, e confirme que os candidatos permanecem limitados ao ACL. Nenhuma alteração do Jarvis faz parte da V2.

Antes de qualquer rollout, validar a presença das funções/políticas beta no inventário de destino, usar homologação com Auth/PostgREST e concorrência real isolados, e confirmar backup real com restauração separada. A ausência de falha em simulação não permite presumir a configuração oficial.

## Reprodução local

Com pacotes locais, dados sintéticos e acesso remoto desativado:

```sh
PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js \
JARVIS_SOURCE=/absolute/path/to/local/jarvis/candidate \
node docs/test-v2-compatibilidade-jarvis.mjs

node scripts/test-v2-fechamento-excel.mjs /absolute/path/to/exceljs
node scripts/test-consulta-excel.mjs /absolute/path/to/exceljs
node --test scripts/test-v2-taxas.mjs
```

O teste de compatibilidade comprova a rejeição no caso beta: sua saída explicita o bloqueio de coexistência. A execução exit 0 não significa que a coexistência passou.
