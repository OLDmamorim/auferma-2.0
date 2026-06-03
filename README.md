# Auferma Commercial Intelligence

Plataforma B2B de Inteligência Comercial para empresas importadoras/distribuidoras.

## Stack Tecnológica

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Base de Dados**: Neon PostgreSQL via Prisma ORM
- **Autenticação**: NextAuth.js com roles (Admin, Diretor, Comercial)
- **Gráficos**: Recharts
- **Importação**: PapaParse (CSV) + XLSX (Excel)
- **Deploy**: Netlify + `@netlify/plugin-nextjs`

## Funcionalidades

| Módulo | Descrição |
|---|---|
| **Dashboard** | KPIs, evolução de vendas, ranking de clientes e comerciais |
| **Clientes** | Lista completa com filtros, criação, paginação |
| **Cliente 360°** | Vista completa: dados, scores, vendas, visitas, tarefas, notas, recomendações |
| **Vendas** | Histórico com filtros por data, marca, cliente |
| **Tarefas** | Criação, atribuição, estados, prioridades, prazos |
| **Visitas** | Registo de contactos (visita, chamada, email, WhatsApp) |
| **Importação** | Upload CSV/Excel de clientes, vendas e produtos |
| **Assistente IA** | Chat com motor de regras (pronto para integração OpenAI) |
| **Gamificação** | Ranking mensal de comerciais por vendas, visitas e tarefas |
| **Comerciais** | Gestão da equipa (Admin/Diretor) |

## Configuração Local

### 1. Clonar e instalar

```bash
git clone https://github.com/oldmamorim/auferma-2.0
cd auferma-2.0
npm install
```

### 2. Variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com:
```
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Base de dados

```bash
npm run db:push    # Criar tabelas
npm run db:seed    # Dados de demonstração
```

### 4. Correr

```bash
npm run dev
```

Aceda a [http://localhost:3000](http://localhost:3000)

## Contas de Demonstração

| Role | Email | Password |
|---|---|---|
| Admin | admin@auferma.pt | admin123 |
| Diretor Comercial | diretor@auferma.pt | diretor123 |
| Comercial 1 | comercial1@auferma.pt | comercial123 |

## Deploy Netlify

1. Conecte o repositório GitHub ao Netlify
2. Configure as variáveis de ambiente:
   - `DATABASE_URL` — URL da base Neon PostgreSQL
   - `NEXTAUTH_SECRET` — chave secreta (gere com `openssl rand -base64 32`)
   - `NEXTAUTH_URL` — URL do deploy (ex: `https://auferma.netlify.app`)
3. O build é automático — Netlify detecta o `netlify.toml`

## Dados de Demonstração

O seed cria:
- **4 marcas**: Beko, TimeRoad, Ariston, Samsung
- **40 produtos** distribuídos pelas marcas
- **50 clientes** com nomes portugueses, zonas, NIFs e scores
- **200 vendas** distribuídas pelos últimos 12 meses
- **30 tarefas** em vários estados
- **20 visitas** registadas
- **5 comerciais** com objetivos mensais

## Estrutura do Projeto

```
src/
├── app/
│   ├── (dashboard)/       # Páginas protegidas
│   │   ├── dashboard/     # Dashboard principal
│   │   ├── clientes/      # Lista + Cliente 360°
│   │   ├── vendas/        # Histórico de vendas
│   │   ├── tarefas/       # Gestão de tarefas
│   │   ├── visitas/       # Registo de contactos
│   │   ├── importacao/    # Upload CSV/Excel
│   │   ├── assistente/    # Chat IA
│   │   ├── gamificacao/   # Rankings
│   │   └── comerciais/    # Equipa comercial
│   ├── api/               # API Routes
│   └── login/             # Página de login
├── components/
│   ├── layout/            # Sidebar, PageHeader
│   └── ui/                # KpiCard, etc.
├── lib/
│   ├── prisma.ts          # Singleton Prisma
│   ├── auth.ts            # NextAuth config
│   └── utils.ts           # Helpers
└── types/                 # TypeScript declarations
prisma/
├── schema.prisma          # Schema completo
└── seed.ts                # Dados de demonstração
```

## Roles e Permissões

| Funcionalidade | Admin | Diretor | Comercial |
|---|:---:|:---:|:---:|
| Dashboard global | ✅ | ✅ | Filtrado |
| Ver todos os clientes | ✅ | ✅ | Só os seus |
| Importar dados | ✅ | ✅ | ❌ |
| Ver equipa comercial | ✅ | ✅ | ❌ |
| Criar tarefas | ✅ | ✅ | ✅ |
| Registar visitas | ✅ | ✅ | ✅ |

## Integração OpenAI (Futura)

O assistente já tem a camada de serviço preparada em `src/app/api/ai/chat/route.ts`. Para ativar IA generativa:

1. Adicione `OPENAI_API_KEY` nas variáveis de ambiente
2. Substitua a função `processQuery` por chamadas à API OpenAI
3. O frontend de chat já está funcional — não requer alterações
