# Local Development Setup Guide

This guide will help you run the application on localhost.

## Prerequisites

### 1. Install Node.js
You need Node.js (version 18 or higher recommended) to run this project.

**Option A: Download from official website**
- Visit [nodejs.org](https://nodejs.org/)
- Download and install the LTS (Long Term Support) version
- Restart your terminal after installation

**Option B: Install using nvm (Node Version Manager) - Recommended**
- Windows: Download nvm-windows from [github.com/coreybutler/nvm-windows/releases](https://github.com/coreybutler/nvm-windows/releases)
- Install nvm-windows
- Open a new terminal and run:
  ```powershell
  nvm install lts
  nvm use lts
  ```

### 2. Verify Installation
After installing Node.js, verify it's working:
```powershell
node --version
npm --version
```

## Setup Steps

### Step 1: Install Dependencies
Navigate to the project directory and install all required packages:
```powershell
npm install
```

This will install all dependencies listed in `package.json`.

### Step 2: Set Up Environment Variables
Create a `.env` file in the root directory with your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

**Where to find these values:**
1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the **Project URL** → use as `VITE_SUPABASE_URL`
4. Copy the **anon/public key** → use as `VITE_SUPABASE_PUBLISHABLE_KEY`

**Note:** If you're using a local Supabase instance, you'll need to:
- Install Supabase CLI: `npm install -g supabase`
- Start local Supabase: `supabase start`
- Use the local URLs provided by the CLI

### Step 3: Start the Development Server
Run the development server:
```powershell
npm run dev
```

The application will start on **http://localhost:8080** (as configured in `vite.config.ts`).

You should see output like:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:8080/
  ➜  Network: use --host to expose
```

### Step 4: Open in Browser
Open your browser and navigate to:
```
http://localhost:8080
```

## Available Scripts

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Build for production
- `npm run build:dev` - Build in development mode
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint to check code quality

## Troubleshooting

### Port 8080 Already in Use
If port 8080 is already in use, you can change it in `vite.config.ts`:
```typescript
server: {
  port: 3000, // or any other available port
}
```

### Supabase Connection Issues
- Verify your `.env` file has the correct values
- Make sure there are no extra spaces or quotes around the values
- Check that your Supabase project is active and accessible
- For local Supabase, ensure `supabase start` is running

### Module Not Found Errors
If you see module not found errors:
```powershell
# Delete node_modules and package-lock.json, then reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### TypeScript Errors
If you see TypeScript errors, try:
```powershell
npm run build
```
This will show you any type errors that need to be fixed.

## Next Steps

Once the app is running:
1. You'll need to authenticate (sign up/sign in)
2. If you're using a fresh Supabase instance, you may need to run migrations
3. Check the `TESTING_INSTRUCTIONS.md` for specific testing scenarios

## Need Help?

- Check the main `README.md` for project overview
- Review `AUTH_FLOW_IMPLEMENTATION.md` for authentication details
- Check `MULTI_TENANT_SETUP.md` for organization setup



