import mongoose from 'mongoose';
import Admin from '../models/Admin';
import dotenv from 'dotenv';

dotenv.config();

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if any admin already exists
    const existingAdmin = await Admin.findOne();
    if (existingAdmin) {
      console.log('Admin user already exists. Skipping seed.');
      process.exit(0);
    }

    // Create super admin
    const superAdmin = new Admin({
      email: 'admin@flashcardapp.com',
      password: 'Admin123!@#',
      name: 'Super Administrator',
      role: 'super_admin',
      permissions: [] // Super admin has all permissions by role, not by explicit permissions
    });

    await superAdmin.save();
    console.log('✅ Super admin created successfully:');
    console.log('📧 Email: admin@flashcardapp.com');
    console.log('🔑 Password: Admin123!@#');
    console.log('👑 Role: superadmin');
    console.log('\n⚠️  IMPORTANT: Change this default password in production!');

  } catch (error) {
    console.error('Error seeding admin users:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

// Run if called directly
if (require.main === module) {
  seedAdmin();
}

export { seedAdmin };
