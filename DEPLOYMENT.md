# Deploying AIFlash Backend API

This guide provides step-by-step instructions for deploying the AIFlash backend API to a cloud platform.

## Prerequisites

1. A cloud platform account (Heroku, Railway, Render, etc.)
2. MongoDB Atlas account for database hosting
3. Stripe account for payment processing
4. AWS account for S3 storage (optional)
5. OpenAI API key

## Deployment Options

### Option 1: Render

1. Create a new Web Service on Render
2. Connect your Git repository
3. Set the root directory to `backend`
4. Set the build command: `npm install`
5. Set the start command: `npm start`
6. Add all environment variables from your `.env` file
7. Deploy the service

### Option 2: Railway

1. Create a new project on Railway
2. Connect your Git repository
3. Set the root directory to `backend`
4. Add all environment variables from your `.env` file
5. Deploy the service

### Option 3: Heroku

1. Create a new app on Heroku
2. Connect your Git repository
3. Set the buildpack to Node.js
4. Add all environment variables from your `.env` file to Heroku Config Vars
5. Deploy the app

## Environment Variables

Ensure you set the following environment variables on your deployment platform:

```
PORT=5000
NODE_ENV=production
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://your-vercel-app-url.vercel.app
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=your_aws_region
S3_BUCKET_NAME=your_s3_bucket_name
OPENAI_API_KEY=your_openai_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

## Database Setup

1. Create a MongoDB Atlas cluster
2. Create a database user with read/write permissions
3. Whitelist all IP addresses (0.0.0.0/0) or specific IP addresses of your deployment platform
4. Get the connection string and add it to your environment variables

## Post-Deployment

1. Test API endpoints using Postman or another API testing tool
2. Verify database connections
3. Check authentication flows
4. Test Stripe integration

## Scaling Considerations

- Set up proper logging with a service like LogDNA or Papertrail
- Consider using a process manager like PM2 for production deployments
- Implement rate limiting for API endpoints
- Set up monitoring for your application

## Security Considerations

- Ensure all sensitive environment variables are properly secured
- Implement proper CORS settings
- Use HTTPS for all communications
- Regularly update dependencies
- Implement proper input validation and sanitization 