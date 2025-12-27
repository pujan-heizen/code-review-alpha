# Prisma ORM Best Practices for NestJS

## Module Setup

### 1. Global Prisma Module
Create a single global Prisma module to avoid importing in every module:

```typescript
// prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### 2. Prisma Service
```typescript
// prisma.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

### 3. App Module Integration
```typescript
// app.module.ts
@Module({
  imports: [PrismaModule, /* other modules */],
})
export class AppModule {}
```

## Schema Design Rules

### 1. Naming Conventions

* **Models**: Use `PascalCase` (e.g., `User`, `ProductOrder`)
* **Fields**: Use `camelCase` (e.g., `firstName`, `orderDate`)
* **Enums**: Use `PascalCase` for enum name and `UPPER_CASE` for values (e.g., `enum Role { ADMIN, USER }`)

### 2. Data Modeling & Relationships (MongoDB)

* **Embedding vs. Referencing**: Use embedding for tightly coupled data queried together. Use references for standalone entities to avoid duplication
* **Relationships**: Define all relationships accurately using `@relation` attribute
* **ObjectId Format**: Always use `@db.ObjectId` for reference fields

```prisma
model User {
  id       String @id @default(auto()) @map("_id") @db.ObjectId
  email    String @unique
  profile  UserProfile? // Embedded one-to-one
  posts    Post[] // Referenced one-to-many
}

model Post {
  id       String @id @default(auto()) @map("_id") @db.ObjectId
  authorId String @db.ObjectId
  author   User   @relation(fields: [authorId], references: [id], onDelete: Cascade)
}
```

### 3. Security, Integrity & Referential Actions

* **Sensitive Data**: Model password fields as `passwordHash` to imply hashing requirement
* **Required Fields**: Fields are non-optional by default. Only use `?` when null is logically valid
* **Primary Keys**: Always use standard MongoDB primary key: `@id @default(auto()) @map("_id") @db.ObjectId`
* **Uniqueness**: Use `@unique` for fields requiring uniqueness (e.g., `email`, `username`)

### 4. Referential Actions (`onDelete`)

**MUST** define appropriate `onDelete` actions:

* **`Cascade`**: Child cannot exist without parent
```prisma
model User {
  profile UserProfile?
}

model UserProfile {
  userId String @unique @db.ObjectId
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

* **`SetNull`**: Child survives parent deletion (requires optional relation field)
```prisma
model Post {
  authorId String? @db.ObjectId // Must be optional for SetNull
  author   User?   @relation(fields: [authorId], references: [id], onDelete: SetNull)
}
```

### 5. Auditing & Governance

Include audit fields on core business models:

```prisma
model Post {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  title     String
  content   String
  
  // Audit fields
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  createdBy String   @db.ObjectId
  updatedBy String?  @db.ObjectId
  
  creator   User     @relation("PostCreator", fields: [createdBy], references: [id])
  updater   User?    @relation("PostUpdater", fields: [updatedBy], references: [id])
}
```

### 6. Performance Optimization

* **Single Field Index**: Use `@index()` for frequently filtered/sorted fields
```prisma
model User {
  email     String   @unique @index()
  createdAt DateTime @default(now()) @index()
}
```

* **Compound Index**: Use `@@index([...])` for multi-field queries
```prisma
model Post {
  status    PostStatus
  createdAt DateTime   @default(now())
  
  @@index([status, createdAt])
}
```

### 7. Enum Definitions

```prisma
enum UserRole {
  ADMIN
  MODERATOR
  USER
}

enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

### 8. Common Patterns

* **Soft Delete(when required)**: Add `deletedAt DateTime?` field with index
* **Timestamps**: Always include `createdAt` and `updatedAt` on business models
* **Status Fields**: Use enums instead of strings for status fields
* **JSON Fields**: Use `Json` type for flexible document storage when needed

```prisma
model User {
  id        String    @id @default(auto()) @map("_id") @db.ObjectId
  email     String    @unique @index()
  role      UserRole  @default(USER)
  metadata  Json?
  deletedAt DateTime? @index()
  createdAt DateTime  @default(now()) @index()
  updatedAt DateTime  @updatedAt
}
```


