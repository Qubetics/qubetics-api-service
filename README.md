# Qubetics API Service

Backend **blockchain indexer and explorer API** for the Qubetics network. The service listens to the Qubetics EVM/Tendermint nodes, indexes blocks, transactions, contracts, tokens and validators into PostgreSQL, and exposes a clean REST API that powers the Qubetics block explorer, dashboards and wallet tooling.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database & Prisma](#database--prisma)
- [API Reference](#api-reference)
- [Background Jobs & Queues](#background-jobs--queues)
- [Docker](#docker)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

---

## Overview

`qubetics-api-service` is responsible for two core responsibilities:

1. **Indexing** – reading blocks and receipts from the chain via Web3/Tendermint RPC and persisting normalized records (blocks, transactions, contracts, tokens, holders, validators, contract logs, price history) into PostgreSQL through Prisma.
2. **Serving** – exposing read APIs for an explorer frontend: latest blocks, transactions, addresses, tokens, contracts, validators, market data, and aggregated graph/statistics endpoints.

If a requested block or transaction is not yet present in the database, the service enqueues it (RabbitMQ) for the indexer to backfill, fetches it directly from the node, and returns the freshly indexed record — giving explorers a self-healing data path.

## Architecture

```
                        ┌────────────────────────┐
                        │  Qubetics Node (EVM/    │
                        │  Tendermint RPC + WS)   │
                        └───────────┬────────────┘
                                    │ Web3 / HTTP
                                    ▼
   ┌─────────────┐   enqueue   ┌──────────────┐   persist   ┌──────────────┐
   │  RabbitMQ   │◀───────────▶│  Indexer /   │────────────▶│  PostgreSQL  │
   │  (queues)   │             │  API Service │             │  (Prisma)    │
   └─────────────┘             └──────┬───────┘             └──────┬───────┘
                                      │                            │
                                      │ cache                      │ query
                                      ▼                            ▼
                                 ┌─────────┐                ┌──────────────┐
                                 │  Redis  │                │ Explorer API │
                                 └─────────┘                └──────────────┘
```

- **Express** HTTP server with Helmet, CORS, rate limiting and Swagger UI.
- **Prisma** ORM against PostgreSQL (read replica supported via `DATABASE_REPLICA_URL`).
- **Redis** for hot caches (counts, price, state-sync, faucet throttling).
- **RabbitMQ** queues for backfilling missing blocks/transactions and async indexing work.

## Tech Stack

| Layer        | Technology                                   |
| ------------ | -------------------------------------------- |
| Language     | TypeScript (Node.js 18)                      |
| HTTP         | Express, Helmet, CORS, express-rate-limit    |
| ORM / DB     | Prisma, PostgreSQL                           |
| Cache        | Redis                                        |
| Messaging    | RabbitMQ (`amqplib`)                         |
| Chain        | Web3.js (EVM RPC)                            |
| Docs         | Swagger / OpenAPI (`/api/docs`)              |
| Validation   | Joi                                          |
| Logging      | Winston                                      |

## Prerequisites

- **Node.js** >= 18
- **PostgreSQL** >= 13
- **Redis** >= 6
- **RabbitMQ** >= 3.9
- Access to a **Qubetics node** RPC/WS endpoint (EVM + Tendermint)

## Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/Qubetics/qubetics-api-service.git
   cd qubetics-api-service
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure the environment**

   Copy the sample file and fill in your values:

   ```bash
   cp .env.example .env
   ```

   See [Environment Variables](#environment-variables) for the full list. NODE_ENV selects which env file is loaded:
   `.env` (local), `.env.test` (test), `.env.stag` (staging), `.env.prod` (production).

4. **Generate the Prisma client and apply migrations**

   ```bash
   npm run generate:prisma
   npm run migrate:dev
   ```

5. **Run the service**

   ```bash
   npm run dev        # local development (nodemon + ts-node)
   npm run start:test # run compiled build (NODE_ENV=test)
   ```

   The API is exposed at `http://localhost:<PORT>/<PROJECT_NAME>` and Swagger UI at `http://localhost:<PORT>/api/docs`.

6. **Other useful scripts**

   ```bash
   npm run lint        # eslint
   npm run lint-fix    # eslint --fix
   npm run pretty      # prettier
   npm test            # jest with coverage
   npm run db:studio   # Prisma Studio
   ```

## Environment Variables

| Variable                     | Description                                                        |
| ---------------------------- | ------------------------------------------------------------------ |
| `NODE_ENV`                   | Runtime environment (`development`, `test`, `staging`, `production`) |
| `PORT`                       | HTTP port the service listens on                                   |
| `PROJECT_NAME`               | Base path prefix for all routes (e.g. `qubetics`)                  |
| `APPLY_ENCRYPTION`           | Enable request/response encryption                                 |
| `SECRET_KEY` / `SALT_VALUE`  | Secret and salt used for encryption/hashing                        |
| `DATABASE_URL`               | PostgreSQL connection string (primary)                             |
| `DATABASE_REPLICA_URL`       | PostgreSQL connection string (read replica, optional)              |
| `REDIS_HOST` / `REDIS_PORT`  | Redis connection details                                           |
| `API_REDIS_EXPIRY`           | Cache TTL in seconds (default `3600`)                              |
| `RABITMQ_URL`                | RabbitMQ connection URL                                            |
| `HTTP_HOST`                  | EVM/Tendermint HTTP RPC endpoint used by Web3                      |
| `SWAGGER_HTTP_HOST`          | EVM HTTP host exposed through Swagger                              |
| `EVM_TENDERMENT_HTTP_HOST`   | Tendermint HTTP endpoint                                           |
| `NODE_INFO_IP` / `NODE_INFO_URL` | Node info lookup host/URL                                      |
| `LOCATION_API_URL`           | Geo-IP lookup endpoint for peers                                   |
| `RPC_SERVERS`                | Comma-separated list of node RPC servers                           |
| `STATE_SYNC_URL`             | Tendermint state-sync endpoint                                     |
| `COIN_MARKET_API_PATH`       | CoinMarketCap quotes endpoint                                      |
| `COIN_MARKET_API_KEY`        | CoinMarketCap API key                                              |
| `TOKEN_SYMBOL` / `TOKEN_CURRENCY` | Native token symbol and fiat currency (e.g. `tics` / `USD`)   |
| `FAUCET_AMOUNT`              | Amount dispensed by the faucet                                     |
| `PUBLIC_KEY` / `PRIVATE_KEY` | Faucet account keys                                                |
| `RECAPTCHA_SECRET_KEY`       | Google reCAPTCHA secret for faucet protection                      |
| `GOOGLE_RECAPTCHA_URL`       | Google reCAPTCHA verification endpoint                             |
| `AVG_BLOCK_TIME`             | Average block time in seconds (used for stats, default `6.00`)     |
| `INTERVAL`                   | Polling interval in seconds (default `90`)                         |

> Never commit real secrets or production keys. Use environment-specific `.env.*` files or a secrets manager.

## Database & Prisma

The schema lives at [`prisma/schema.prisma`](prisma/schema.prisma) and models blocks, transactions, coin transfers, contracts, tokens, holders, contract logs, validators, decoded logs, contract verification and coin-market data.

```bash
npm run generate            # generate Prisma client + Nexus typings
npm run migrate:create      # create a migration without applying
npm run migrate:dev         # apply migrations in development
npm run db:studio           # open Prisma Studio
```

## API Reference

All routes are mounted under `/<PROJECT_NAME>` (default prefix `qubetics`). Interactive documentation is served at `/api/docs`.

> The tables below are a high-level summary; refer to Swagger UI for full request/response schemas.

### Status

| Method | Path       | Description          |
| ------ | ---------- | -------------------- |
| GET    | `/status`  | Health / liveness    |

### Blocks — `/blocks`

| Method | Path                     | Description                        |
| ------ | ------------------------ | ---------------------------------- |
| GET    | `/get-all-blocks`        | Paginated blocks list              |
| GET    | `/`                      | Cursor-paginated blocks            |
| GET    | `/hash/:blockHash`       | Block by hash                      |
| GET    | `/get-latest-block`      | Latest indexed block               |
| GET    | `/block-time`            | Block time statistics              |
| GET    | `/state-sync`            | Tendermint state-sync status       |

### Transactions — `/transactions`

| Method | Path                            | Description                     |
| ------ | ------------------------------- | ------------------------------- |
| GET    | `/get-all-transactions`         | Paginated transactions          |
| GET    | `/hash/:transactionHash`        | Transaction by hash             |
| GET    | `/get-transaction-by-address`   | Transactions for an address     |
| GET    | `/get-transaction-by-block`     | Transactions in a block         |
| GET    | `/erc-20`                       | ERC-20 transfers                |

### Tokens — `/tokens`

| Method | Path                                | Description                 |
| ------ | ----------------------------------- | --------------------------- |
| GET    | `/all-tokens`                       | All tokens                  |
| GET    | `/`                                 | Paginated tokens            |
| GET    | `/token-by-contractAddress/:addr`   | Token by contract address   |
| GET    | `/holders`                          | Token holders               |
| GET    | `/token-by-wallet-address`          | Tokens held by a wallet     |
| GET    | `/token-transfer`                   | Token transfer history      |

### Contracts — `/contracts`

| Method | Path                                        | Description                    |
| ------ | ------------------------------------------- | ------------------------------ |
| GET    | `/all-contracts`                            | Paginated contracts            |
| POST   | `/all-contracts-icon`                       | Batch contract icon URLs       |
| GET    | `/contract-detail-by-address/:addr`         | Contract detail                |
| GET    | `/all-transaction`                          | Contract transactions          |
| GET    | `/get-internal-tx`                          | Internal transactions          |
| GET    | `/popular`                                  | Popular contracts              |
| GET    | `/events` / `/transfer`                     | Contract events / transfers    |
| GET    | `/search/*` / `/search-get/*`               | Search contracts & tokens      |
| GET    | `/graph/:address`                           | Contract activity graph        |

### Validators — `/validators`

| Method | Path                 | Description            |
| ------ | -------------------- | ---------------------- |
| GET    | `/getAllValidators`  | Paginated validators   |

### Explorer — `/explorer`

| Method | Path                        | Description                     |
| ------ | --------------------------- | ------------------------------- |
| GET    | `/searching`                | Global search                   |
| GET    | `/peers`                    | Connected peers                 |
| GET    | `/summary` / `/dashboard`   | Network summary & dashboard     |
| GET    | `/top-validator`            | Top validators                  |
| GET    | `/address-detail/:address`  | Address detail                  |
| GET    | `/market-cap`               | Market cap history              |
| GET    | `/current-token-price`      | Current token price             |
| GET    | `/graph/tps`                | TPS history                     |
| GET    | `/graph/account`            | Account growth history          |
| GET    | `/graph/coin-transfer`      | Coin-transfer history           |
| GET    | `/graph/contract-deployed`  | Contract deployment history     |
| GET    | `/graph/tx-fee`             | Transaction fee history         |
| GET    | `/graph/coin-price`         | Coin price history              |

### Faucet — `/faucet`

| Method | Path         | Description                          |
| ------ | ------------ | ------------------------------------ |
| POST   | `/transfer`  | Fund an address (reCAPTCHA protected) |

## Background Jobs & Queues

RabbitMQ queues (declared at boot) drive asynchronous backfilling:

| Queue                   | Purpose                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `MISSING_BLOCK`         | Re-index a block/transaction requested but not yet in the DB |
| `VALIDATOR_DETAIL`      | Fetch and persist validator detail                          |
| `CONTRACT_DEPLOY_DETAIL`| Index newly deployed contract metadata                      |
| `BLOCK_TIME_QUE`        | Recompute block-time statistics                             |

A scheduler ([`src/cron`](src/cron/index.ts)) runs periodic aggregation tasks that populate Redis-cached statistics.

## Docker

Build and run the production image:

```bash
docker build -t qubetics-api-service .
docker run --env-file .env -p 7200:7200 qubetics-api-service
```

The container listens on port `7200` and runs `npm run start:prod`.

## Deployment

- CI/CD is defined under [`.github/workflows`](.github/workflows), building the image, pushing to Huawei SWR and updating the ArgoCD manifest.
- Kubernetes manifests are provided in [`kubernetes-manifests.yaml`](kubernetes-manifests.yaml) (Deployment + Service, health check `/status`).

## Project Structure

```
src/
├── App.ts                 # Express app, middleware, Swagger wiring
├── server.ts              # Service bootstrap
├── routes.ts              # Route registration
├── cron/                  # Scheduled aggregation jobs
├── environments/          # Env loading & constants
├── constant/              # Response messages, enums, queue/redis keys
├── helper/                # Web3, common, APR, limiter helpers
├── interfaces/            # Shared TypeScript interfaces
├── lib/                   # Prisma client, logger, utilities
├── service/               # RabbitMQ, Redis, response helpers
└── module/                # Feature modules (controller/service/validation)
    ├── block/  transaction/  contract/  Token/
    ├── validator/  explorer/  faucet/
prisma/
├── schema.prisma          # Data model
└── migrations/            # SQL migrations
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening issues or pull requests. Run `npm run lint` and `npm test` before submitting changes.

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md). Do not disclose security issues publicly before they are addressed.

## License

Released under the [MIT License](LICENSE).

```
MIT License

Copyright (c) 2026 Qubetics

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
