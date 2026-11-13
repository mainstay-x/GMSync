# WhatsApp do GMSync

O GMSync conversa pelo WhatsApp com um número próprio, ligado direto à Cloud API da Meta.
Nada é compartilhado com o COREX: número, conta do WhatsApp, app da Meta e projeto Supabase são separados.

## O que já está no repositório

| Arquivo | Para que serve |
|---|---|
| `sql/001-whatsapp.sql` | Tabelas de números autorizados, contatos e mensagens, e o bucket privado dos arquivos |
| `supabase/functions/gmsync-whatsapp-webhook` | Recebe mensagens e status da Meta, grava no banco e guarda fotos, áudios e documentos |
| `supabase/functions/gmsync-whatsapp-send` | Envia texto dentro da janela de 24 horas (uso interno) |
| `supabase/functions/_shared/process.ts` | Leitura por IA (Claude): transforma cada mensagem em lançamento |
| `supabase/functions/_shared/transcribe.ts` | Transcrição de áudio (OpenAI, único uso dela no GMSync) |
| `supabase/functions/gmsync-process` | Reprocessa uma mensagem já recebida (uso interno) |
| `sql/002-obras-lancamentos.sql` | Obras, categorias, equipes, lançamentos, itens de nota, mão de obra e permissões |
| `tools/create_admin.ts` | Cria um login de administrador |
| `supabase/config.toml` | Publica as funções sem exigir token do Supabase |

Ainda não existe: telas do GMSync ligadas ao banco (obras, financeiro, cadastros, revisão), tela de login e envio de modelos aprovados.

## Como uma mensagem vira lançamento

1. O webhook grava a mensagem e guarda o arquivo.
2. Se for áudio, a OpenAI (`gpt-transcribe`) transcreve e o texto fica em `transcript` da mensagem. Sem a chave da OpenAI, o áudio fica com `process_status = awaiting_transcription`.
3. O Claude (`claude-opus-5-5`) lê o texto, a foto ou o PDF, junto com os cadastros de obras, categorias e equipes e os últimos lançamentos do mesmo remetente.
4. O resultado vira um lançamento em `gmsync_entries`:

| Tipo | O que é gravado |
|---|---|
| `purchase` | Nota de compra: cabeçalho em `gmsync_purchases` e um item por linha em `gmsync_purchase_items`, cada um com a sua categoria |
| `labor` | Mão de obra: uma linha por equipe em `gmsync_labor` |
| `photo` | Foto da obra, com o arquivo |
| `diary` | Relato do que aconteceu na obra |
| `other` | Não identificado; fica para revisão |

5. O GMSync responde no WhatsApp confirmando o que lançou, ou perguntando o que faltou.
6. Se a obra não foi identificada, a pessoa responde com o nome dela e os lançamentos pendentes das últimas 12 horas são alocados.

Um lançamento fica marcado para revisão (`needs_review`, com os motivos em `review_reasons`) quando: a obra não foi identificada ou é incerta, um item ficou sem categoria ou com categoria incerta, a soma dos itens difere do total da nota, o total está ilegível, a equipe não está cadastrada ou o valor da mão de obra não foi dito.

O código só aceita obra, categoria e equipe que existam nos cadastros: um id que o Claude devolva fora da lista é descartado.

## Cadastros

Categorias (`gmsync_categories`), equipes (`gmsync_teams`) e obras (`gmsync_projects`) são tabelas editáveis. O texto de `guidance` de cada categoria é lido pelo Claude: é nele que se explica o que entra em "Requinte", por exemplo. Equipes e obras aceitam apelidos em `aliases`, para bater com o que é dito no dia a dia.

As cinco categorias iniciais já são criadas pelo SQL: Material bruto, Acabamentos, Gesso, Elétrica e Requinte.

## Telas

| Arquivo | Para que serve |
|---|---|
| `config.js` | Endereço e chave pública do Supabase. Vazio = modo demonstração, com dados de exemplo no navegador |
| `data.js` | Camada de dados: mesma interface para o modo demonstração e para o Supabase |
| `lancamentos.js`, `lancamentos.css` | Lançamentos (caixa de entrada, compras, mão de obra, fotos) e cadastros em Configurações |

Para ligar o site ao banco, preencher `supabaseUrl` e `supabaseAnonKey` em `config.js` (Supabase › Project Settings › API). A partir daí o login passa a ser o do Supabase.

As telas antigas do protótipo (Dashboard, Obras, Cronogramas, Curva S, Financeiro, Diário, Documentos, Relatórios) continuam com os dados de demonstração próprios e ainda não leem os lançamentos.

## Acesso

O administrador lê, edita e exclui tudo. Ninguém mais acessa os dados. O login usa o Supabase Auth; o nome de usuário vira `usuario@gmsync.mainstay-x.com.br` por baixo.

Criar o primeiro administrador (a senha é pedida na hora e não é gravada no repositório):

```bash
SUPABASE_URL=https://REFERENCIA.supabase.co SUPABASE_SERVICE_ROLE_KEY=... deno run --allow-net --allow-env tools/create_admin.ts gmarcola
```

## Números autorizados

Só números cadastrados em `gmsync_whatsapp_senders` e com `active = true` enviam dados ao sistema. Mensagem de outro número é descartada sem gravar o conteúdo.

Enquanto a tela de cadastro não existe, o cadastro é feito no SQL Editor:

```sql
insert into public.gmsync_whatsapp_senders (phone, name) values ('5521999998888', 'Nome');
update public.gmsync_whatsapp_senders set active = false where phone = '5521999998888';
```

O número vai com DDI e DDD, só dígitos. Pode ser cadastrado com ou sem o nono dígito: a comparação trata os dois como o mesmo número.

## Arquivos recebidos

Foto, áudio, vídeo e documento são baixados da Meta e guardados no bucket privado `gmsync-whatsapp`, em `número/ano-mês/id-da-mensagem.extensão`. O caminho fica em `media_path` da mensagem; se o download falhar, o motivo fica em `media_error`.

## Passo a passo

### 1. Projeto Supabase novo
1. Em supabase.com, criar um projeto só do GMSync (região São Paulo).
2. No SQL Editor, rodar `sql/001-whatsapp.sql` e depois `sql/002-obras-lancamentos.sql`, e cadastrar os números autorizados, as obras e as equipes.
3. Anotar a referência do projeto (o trecho antes de `.supabase.co`).

### 2. Publicar as funções
Com a CLI do Supabase instalada e logada:

```bash
supabase link --project-ref REFERENCIA_DO_PROJETO
supabase functions deploy gmsync-whatsapp-webhook
supabase functions deploy gmsync-whatsapp-send
supabase functions deploy gmsync-process
```

O endereço do webhook fica:
`https://REFERENCIA_DO_PROJETO.supabase.co/functions/v1/gmsync-whatsapp-webhook`

### 3. Número
- Um número que não esteja em nenhum WhatsApp (app comum ou Business). Se já estiver, apagar a conta no app antes.
- Precisa receber SMS ou ligação para o código de confirmação.

### 4. Meta
1. No Meta Business, usar o portfólio empresarial da Mainstay-X (criar se não existir) e concluir a verificação da empresa.
2. Em developers.facebook.com, criar um app novo do tipo Empresa e adicionar o produto WhatsApp.
3. Criar a conta do WhatsApp Business do GMSync e cadastrar o número, com o nome de exibição (a Meta analisa o nome).
4. Criar um usuário do sistema no portfólio, dar acesso ao app e à conta do WhatsApp, e gerar um token permanente com `whatsapp_business_messaging` e `whatsapp_business_management`.
5. Anotar: ID do número (Phone number ID), chave secreta do app (App Secret) e o token.

### 5. Secrets no Supabase
Criar um texto aleatório longo para o token de verificação e gravar os secrets. Nenhum deles vai para o repositório nem para o frontend.

```bash
supabase secrets set WHATSAPP_VERIFY_TOKEN=... WHATSAPP_APP_SECRET=... WHATSAPP_PHONE_NUMBER_ID=... WHATSAPP_ACCESS_TOKEN=... ANTHROPIC_API_KEY=... OPENAI_API_KEY=...
```

`ANTHROPIC_API_KEY` é a chave da API do Claude, criada em platform.claude.com em uma conta do GMSync. `OPENAI_API_KEY` é usada só para transcrever áudios; criar em uma conta separada da do COREX.

`WHATSAPP_GRAPH_VERSION` é opcional (padrão `v26.0`).

### 6. Ligar o webhook
1. No app da Meta, em WhatsApp > Configuração, informar o endereço do webhook e o mesmo token de verificação.
2. Assinar o campo `messages`.
3. Enviar uma mensagem para o número e conferir a linha em `gmsync_whatsapp_messages`.

### 7. Antes de atender clientes
- Publicar uma página de política de privacidade no site e informá-la no app da Meta.
- Colocar o app em modo ativo.
- Cadastrar forma de pagamento na conta do WhatsApp (mensagens fora da janela de 24 horas são cobradas).

## Regras que o código segue
- Só aceita eventos com a assinatura `X-Hub-Signature-256` válida para o App Secret.
- Ignora eventos de qualquer número que não seja o `WHATSAPP_PHONE_NUMBER_ID`.
- Descarta mensagens de quem não está em `gmsync_whatsapp_senders`.
- Mensagem repetida pela Meta não é gravada duas vezes.
- Texto livre só sai dentro de 24 horas da última mensagem recebida do contato.
- O número do contato é guardado como a Meta envia (`wa_id`); a resposta vai para esse mesmo valor.
