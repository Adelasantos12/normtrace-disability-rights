# NormTrace Application

**NormTrace** is a serious, repository-based, AI-assisted web application for multilevel normative analysis of domestic legal instruments against international standards.

This repository implements the pilot phase focusing on Disability Rights (CRPD) for Mexico and Switzerland.

## Project Structure (Monorepo)

- `apps/web`: Next.js App Router frontend application.
- `apps/api`: Node.js Express backend application for analysis orchestration.
- `packages/ui`: Reusable UI components.
- `packages/db`: Prisma schema and PostgreSQL database configuration.
- `packages/i18n`: Cautious, non-prescriptive translation dictionaries (EN, ES, FR).

## Local Development

### Prerequisites

- Node.js (v20+)
- npm (v10+)
- PostgreSQL database

### Setup

1. Clone the repository and install dependencies from the root:
   ```bash
   npm install
   ```

2. Configure environment variables. Create a `.env` file in the root:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/normtrace?schema=public"
   ```

3. Initialize the database:
   ```bash
   cd packages/db
   npx prisma db push
   npx prisma generate
   ```

4. Run the development server (runs both web and api):
   ```bash
   npm run dev
   ```
   The API will start on `http://localhost:4000` and the Web UI on `http://localhost:3000`.

## Railway Deployment

This application is designed for seamless deployment on Railway using a Monorepo strategy.

### Steps to Deploy

1. Connect your GitHub repository to a new Railway project.
2. Add a **PostgreSQL** add-on to the project.
3. Deploy two distinct services from the same repository:

#### API Service Configuration
- **Root Directory**: `/` (Leave empty to use monorepo context)
- **Build Command**: `npm run build`
- **Start Command**: `cd apps/api && npm run start`
- **Healthcheck Path**: `/health`
- **Environment Variables**:
  - `DATABASE_URL`: Ensure this links to the provisioned PostgreSQL add-on.

#### Web Service Configuration
- **Root Directory**: `/apps/web`
- **Build Command**: `npm run build`
- **Start Command**: `npm run start`

---
*Note: This pilot system must not be mistaken for an automated constitutional court. Outputs are analytical and require source verification.*
