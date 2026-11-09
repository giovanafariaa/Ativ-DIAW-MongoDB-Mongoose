# Laboratório NoSQL — API de produtos (MongoDB Atlas)

O objetivo nesse projeto é montar um relatório de vendas a partir dos produtos estruturados em um banco de dados MongoDB.

## Preparação antes da aula

1. Instale Node.js 20 ou superior e tenha acesso à internet.
2. No MongoDB Atlas, crie uma conta e um cluster compatível com seu plano (gratuito, se disponível).
3. Em **Database Access**, crie um usuário de banco com permissões apropriadas ao banco de laboratório.
4. Em **Network Access**, autorize o IP público usado no laboratório; evite liberar todas as origens permanentemente.
5. Em **Connect → Drivers**, copie a URI de conexão, substitua usuário e senha (codifique caracteres especiais da senha na URI).
6. Copie `.env.example` para `.env` e substitua `MONGODB_URI` pela sua URI. Não publique `.env`.

## Executar

```bash
npm install
npm run seed
npm run dev
```

Teste `GET http://localhost:3000/api/health` e `GET http://localhost:3000/api/produtos`. Use `requests.http` no Postman.

## Endpoints prontos

- `GET /api/health` — status da conexão
- `GET /api/produtos` — lista
- `GET /api/produtos/:id` — detalhe
- `POST /api/produtos` — criação
- `PUT /api/produtos/:id` — atualização
- `DELETE /api/produtos/:id` — exclusão

## Vendas e relatório consolidado

### Modelagem (`src/models/Venda.js`)

Cada **venda** é um documento com `cliente` (nome, e-mail), `data`, `total` e `itens` **incorporados** (embedded). Cada item referencia o produto por **`ObjectId` (`ref: 'Produto'`)** e guarda um *snapshot* do momento da venda:

```json
{
  "cliente": { "nome": "Maria Silva", "email": "maria@email.com" },
  "data": "2025-06-01T12:00:00.000Z",
  "itens": [
    { "produto": "<ObjectId>", "nomeProduto": "Mouse sem fio", "quantidade": 2, "precoUnitario": 80 }
  ],
  "total": 160
}
```

**Por que esse desenho?** Itens são sempre lidos junto com a venda, então ficam incorporados (uma leitura só). O produto tem ciclo de vida próprio e é compartilhado entre várias vendas, então é **referenciado**. O `precoUnitario` (e o `nomeProduto`) é copiado para a venda: se o preço do produto mudar depois, o histórico e o faturamento das vendas antigas não são alterados.

### Regras do `POST /api/vendas`

- O servidor busca os produtos no banco e **copia o preço atual do catálogo**; qualquer preço enviado pelo cliente é ignorado.
- Valida cliente, lista de itens não vazia, IDs válidos, quantidade inteira ≥ 1 e existência dos produtos (404 se algum não existir).
- Itens repetidos do mesmo produto são somados. O `total` é calculado pelo servidor.
- Estoque e transações multi-documento estão fora do escopo.

### Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | status da conexão |
| GET/POST | `/api/produtos` | listar / criar produto |
| GET/PUT/DELETE | `/api/produtos/:id` | detalhe / atualizar / excluir |
| POST | `/api/vendas` | registrar venda |
| GET | `/api/vendas` | listar vendas com `populate('itens.produto')`. Filtros opcionais: `cliente`, `de`, `ate` (AAAA-MM-DD) |
| GET | `/api/vendas/:id` | detalhe de uma venda (com populate) |
| GET | `/api/relatorios/vendas` | relatório consolidado. Opcionais: `limite` (padrão 5), `de`, `ate` |

Exemplo de corpo para `POST /api/vendas`:

```json
{
  "cliente": { "nome": "Maria Silva", "email": "maria@email.com" },
  "itens": [
    { "produto": "ID_DO_PRODUTO_1", "quantidade": 2 },
    { "produto": "ID_DO_PRODUTO_2", "quantidade": 1 }
  ]
}
```

Exemplo de resposta de `GET /api/relatorios/vendas`:

```json
{
  "totalVendas": 3,
  "faturamentoTotal": 4570,
  "unidadesVendidas": 7,
  "ticketMedio": 1523.33,
  "produtosMaisVendidos": [
    { "produtoId": "...", "nome": "Mouse sem fio", "categoria": "Acessórios", "quantidadeVendida": 4, "faturamento": 320 }
  ]
}
```

O relatório é consolidado em JavaScript usando sempre o **`precoUnitario` gravado na venda**, nunca o preço atual do produto.

### Como demonstrar o histórico de preços

1. `POST /api/vendas` com um produto de R$ 80.
2. `PUT /api/produtos/:id` alterando o preço para outro valor.
3. `GET /api/vendas` e `GET /api/relatorios/vendas`: a venda antiga continua com `precoUnitario: 80` e o faturamento não muda (o `populate` mostra o preço novo em `produto.preco`, mas o valor da venda é `precoUnitario`).

### Observações

- Se um produto for excluído depois de vendido, `populate` retorna `null` para ele, mas a venda e o relatório continuam funcionando graças ao `nomeProduto` gravado. Em produção, prefira inativar o produto a excluí-lo.
- Em produção também seria necessário tratar autenticação, concorrência e controle de estoque.
