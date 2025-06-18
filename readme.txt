/node-api
├── /src
│   ├── /config
│   │   ├── database.ts        # Konfigurasi koneksi Prisma
│   │   ├── multer.ts          # Konfigurasi upload file
│   │   └── postMulter.ts      # Konfigurasi upload file untuk post
│   │
│   ├── /controllers
│   │   ├── adminController.ts  # Logika untuk admin
│   │   ├── authController.ts   # Logika untuk autentikasi (register, login, dll)
│   │   ├── categoryController.ts # Manajemen kategori
│   │   ├── exampleController.ts  # Contoh controller
│   │   └── postController.ts    # Manajemen post
│   │
│   ├── /middleware
│   │   ├── auth.ts            # Middleware autentikasi
│   │   ├── authMiddleware.ts   # Middleware autentikasi (alternatif)
│   │   └── postMiddleware.ts   # Middleware untuk post
│   │
│   ├── /routes
│   │   ├── adminRoutes.ts     # Rute untuk admin
│   │   ├── authRoutes.ts      # Rute untuk autentikasi
│   │   ├── categoryRoutes.ts  # Rute untuk kategori
│   │   ├── exampleRoutes.ts   # Contoh rute
│   │   └── postRoutes.ts      # Rute untuk post
│   │
│   ├── /types
│   │   └── /express
│   │       └── index.d.ts     # Type definitions untuk Express
│   │
│   ├── /utils
│   │   ├── errorHandler.ts    # Penanganan error
│   │   └── slugGenerator.ts   # Generate slug
│   │
│   └── index.ts            # File utama aplikasi
│
├── /prisma
│   └── schema.prisma          # Skema database Prisma
│
├── .env                     # Variabel lingkungan
├── .env.example              # Contoh konfigurasi environment
├── .gitignore                # File yang diabaikan oleh Git
├── package.json              # Dependensi dan konfigurasi proyek
├── tsconfig.json             # Konfigurasi TypeScript
└── README.md                 # Dokumentasi proyek



