import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Hapus data yang ada untuk menghindari duplikasi
  await prisma.token.deleteMany({});
  await prisma.user.deleteMany({});

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('admin123', salt);
  const userPassword = await bcrypt.hash('user1234', salt);

  // Buat user admin
  const adminData = {
    name: 'Admin',
    email: 'admin@example.com',
    password: adminPassword,
    role: 'ADMIN' as const,
    avatar: 'https://ui-avatars.com/api/?name=Admin&background=random'
  };
  const admin = await prisma.user.create({
    data: adminData
  });

  // Buat user biasa
  const userData = {
    name: 'User Biasa',
    email: 'user@example.com',
    password: userPassword,
    role: 'USER' as const,
    avatar: 'https://ui-avatars.com/api/?name=User+Biasa&background=random'
  };
  const user = await prisma.user.create({
    data: userData
  });

  console.log('✅ Seeded database with 2 users');
  console.log('👤 Admin:', { email: 'admin@example.com', password: 'admin123' });
  console.log('👤 User:', { email: 'user@example.com', password: 'user1234' });
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
