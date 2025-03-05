# Deploying AIFlash Backend to Vercel

This guide provides step-by-step instructions for deploying the AIFlash backend to Vercel.

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. The Vercel CLI installed globally: `npm install -g vercel`
3. A MongoDB Atlas database (or other MongoDB provider)

## Preparation Steps

1. **Build the Application**

   Make sure your application builds successfully:
   ```
   npm run build
   ```

2. **Environment Variables**

   Ensure all required environment variables are ready to be added to Vercel:
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: Secret key for JWT token generation
   - `JWT_EXPIRES_IN`: JWT token expiration time
   - `FRONTEND_URL`: URL of your frontend application
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `AWS_ACCESS_KEY_ID`: AWS access key (if using S3)
   - `AWS_SECRET_ACCESS_KEY`: AWS secret key (if using S3)
   - `AWS_REGION`: AWS region (if using S3)
   - `S3_BUCKET_NAME`: S3 bucket name (if using S3)
   - `STRIPE_SECRET_KEY`: Stripe secret key (if using Stripe)
   - `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret (if using Stripe)

## Deployment Steps

1. **Login to Vercel**

   ```
   vercel login
   ```

2. **Initialize Vercel in Your Project**

   Navigate to your backend directory and run:
   ```
   vercel
   ```

   Follow the prompts:
   - Set up and deploy: `Y`
   - Which scope: Select your account or team
   - Link to existing project: `N`
   - Project name: `aiflash-backend` (or your preferred name)
   - Directory: `.` (current directory)
   - Override settings: `N`

3. **Configure Environment Variables**

   After initial deployment, go to the Vercel dashboard:
   - Select your project
   - Go to "Settings" > "Environment Variables"
   - Add all the required environment variables listed above

4. **Update Build Settings (if needed)**

   In the Vercel dashboard:
   - Go to "Settings" > "General"
   - Under "Build & Development Settings":
     - Build Command: `npm run build`
     - Output Directory: `dist`
     - Install Command: `npm install`

5. **Redeploy with Environment Variables**

   ```
   vercel --prod
   ```

## Important Considerations for Vercel Deployment

1. **Serverless Functions**

   Vercel deploys Node.js applications as serverless functions, which have some limitations:
   - Maximum execution time of 10 seconds (on free tier)
   - Limited file system access
   - Cold starts may affect performance

2. **File Uploads**

   The current implementation uses local file storage for uploads, which won't work on Vercel:
   - Update the file storage logic to use S3 or another cloud storage solution
   - Remove any code that creates local directories or writes to the local file system

3. **MongoDB Connection**

   Optimize your MongoDB connection for serverless environments:
   - Use connection pooling
   - Implement connection reuse
   - Consider using MongoDB Atlas which works well with serverless architectures

4. **CORS Configuration**

   Update the CORS configuration to allow requests from your deployed frontend:
   ```javascript
   const corsOptions = {
     origin: process.env.FRONTEND_URL || 'https://your-frontend-domain.vercel.app',
     // other options...
   };
   ```

5. **Webhook Endpoints**

   If you're using webhooks (e.g., for Stripe), ensure they're properly configured to work with Vercel's serverless functions.

## Troubleshooting

1. **Deployment Failures**
   - Check the build logs in the Vercel dashboard
   - Ensure all dependencies are properly listed in package.json
   - Verify that the build command is correctly set

2. **Runtime Errors**
   - Check the function logs in the Vercel dashboard
   - Ensure all environment variables are correctly set
   - Test API endpoints using tools like Postman

3. **Performance Issues**
   - Consider upgrading to a paid Vercel plan for better performance
   - Optimize database queries and connections
   - Implement caching where appropriate

## Alternative Deployment Options

If Vercel's serverless architecture doesn't meet your needs, consider these alternatives:
- **Render**: Offers more traditional Node.js hosting
- **DigitalOcean App Platform**: Good for Node.js applications
- **Heroku**: Easy deployment with good MongoDB integration
- **AWS Elastic Beanstalk**: More control but more complex setup 