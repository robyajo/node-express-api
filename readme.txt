/express-api
├── /src
│   ├── /config
│   │   └── database.ts        # Konfigurasi koneksi Prisma
│   ├── /controllers
│   │   ├── authController.ts  # Logika untuk register, login, protect, dan logout
│   │   └── exampleController.ts  # Logika bisnis untuk rute contoh
│   ├── /middleware
│   │   └── authMiddleware.ts  # Middleware untuk autentikasi JWT
│   ├── /routes
│   │   ├── authRoutes.ts      # Rute untuk register, login, protect, dan logout
│   │   └── exampleRoutes.ts   # Rute untuk contoh
│   ├── /utils
│   │   └── errorHandler.ts    # Fungsi utilitas seperti penanganan error
│   └── index.ts               # File utama untuk menjalankan server
├── /prisma
│   └── schema.prisma          # Skema database Prisma
├── .env                       # Variabel lingkungan
├── .gitignore                 # File yang diabaikan oleh Git
├── package.json               # Dependensi dan konfigurasi proyek
├── tsconfig.json              # Konfigurasi TypeScript
└── README.md                  # Dokumentasi proyek