# AIFlash Backend

This is the backend server for the AIFlash application, providing API endpoints for flashcard generation, user authentication, and other features.

## Setup and Installation

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file based on the `.env.example` file and fill in the required environment variables.

3. Build the application:
   ```
   npm run build
   ```

4. Start the server:
   ```
   npm start
   ```

## Development

For development, you can use the following command to start the server with hot-reloading:
```
npm run dev
```

## Build Process

The build process compiles TypeScript files from the `src` directory into JavaScript files in the `dist` directory. The build is configured in `tsconfig.json` with the following key settings:

- `rootDir`: Set to `./src` to specify the source directory
- `outDir`: Set to `./dist` to specify the output directory
- `sourceMap`: Enabled to generate source maps for debugging
- `resolveJsonModule`: Enabled to allow importing JSON files

To build the application, simply run:
```
npm run build
```

## API Documentation

The API endpoints are organized in the following route files:

- `routes/ai.routes.ts`: AI-related endpoints for flashcard generation
- `routes/auth.routes.ts`: Authentication endpoints
- `routes/deck.routes.ts`: Flashcard deck management
- `routes/subscription.routes.ts`: Subscription management

## Deployment

### Vercel Deployment

The backend is configured for deployment on Vercel. For detailed instructions, see [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md).

Key files for Vercel deployment:
- `vercel.json`: Configuration for Vercel deployment
- `package.json`: Includes a `vercel-build` script

Important considerations for Vercel deployment:
1. The backend uses serverless functions, which have execution time limits
2. File uploads are handled differently in production (using cloud storage)
3. Database connections are optimized for serverless environments

### Other Deployment Options

For other deployment options, please refer to the `DEPLOYMENT.md` file in this directory. 