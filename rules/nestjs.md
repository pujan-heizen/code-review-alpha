# NestJS Best Practices & Rules

## Project Structure

### Module Organization
```
src/
├── common/
│   ├── constants/
│   ├── decorators/
│   ├── dtos/
│   ├── entities/
│   ├── enums/
│   ├── guards/
│   ├── interfaces/
│   ├── pipes/
│   └── utils/
├── modules/
│   └── user/
│       ├── user.controller.ts
│       ├── user.service.ts
│       ├── user.module.ts
│       ├── dto/
│       │   ├── create-user.dto.ts
│       │   └── update-user.dto.ts
│       └── entities/
│           └── user.entity.ts
└── app.module.ts
```

## File Naming Conventions

- **DTOs**: `create-user.dto.ts`, `update-user.dto.ts`
- **Entities**: `user.entity.ts`
- **Services**: `user.service.ts`
- **Controllers**: `user.controller.ts`
- **Modules**: `user.module.ts`

## Controller Rules

### ✅ Controllers Should Only
```typescript
@Controller('api/users')
@ApiTags('Users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Create user' })
  // response type is automatically fetched by swagger from return type
  async create(@Body() createUserDto: CreateUserDto): Promise<UserEntity> {
    return this.userService.create(createUserDto);
  }
}
```

- Handle HTTP requests/responses
- Call service methods
- Apply decorators (validation, swagger, guards)
- Transform data if needed
- **NO business logic**

## Service Rules

### ✅ Services Should Contain
```typescript
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<UserEntity> {
    // Business logic here
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    return this.prisma.user.create({
      data: { ...createUserDto, password: hashedPassword }
    });
  }
}
```

- All business logic
- Database operations
- External API calls
- Data transformation
- Validation logic

## DTOs & Entities

### DTOs (Data Transfer Objects)
```typescript
// create-user.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ minimum: 8 })
  @MinLength(8)
  password: string;
}
```

### Entities (Response Types)
```typescript
// user.entity.ts
import { ApiProperty } from '@nestjs/swagger';

export class UserEntity {
  // @ApiProperty() no need to add this on Entities swagger automatically mark it as ApiProperty if Entity is defined in .entity.ts file.
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
    delete this.password; // Never expose password
  }
}
```

## Module Configuration

### Feature Modules
```typescript
// user.module.ts
@Module({
  imports: [], // Global modules like PrismaModule will be there by default no need to import it
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService], // Export services for other modules
})
export class UserModule {}
```

### Global Modules
```typescript
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### App Module
```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UserModule,
    AuthModule,
  ],
})
export class AppModule {}
```

## Swagger Documentation

### Required on Every Route
```typescript
@Controller('users')
@ApiTags('Users')
@ApiBearerAuth() // If authentication required
export class UserController {
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string): Promise<UserEntity> {
    return this.userService.findOne(id);
  }
}
```

## Common Folder Structure

### Decorators
```typescript
// common/decorators/current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

### Guards
```typescript
// common/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

## Error Handling

### Use Built-in Exceptions
```typescript
@Injectable()
export class UserService {
  async findOne(id: string): Promise<UserEntity> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return new UserEntity(user);
  }
}
```

## Validation

### Use Class Validators
```typescript
// Always use validation pipes globally
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
}
```

## Environment Configuration

### Use ConfigModule
```typescript
// common/config/database.config.ts
export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10) || 5432,
}));
```

## Bootstrap Setup (main.ts)

### Complete Bootstrap Configuration
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { config } from './common/config';
import { GlobalExceptionFilter } from './common/filters/global-exception-handler';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS Configuration
  app.enableCors({
    origin: '*',
  });
  
  // Request size limits
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));
  
  // Logger setup
  app.useLogger(app.get(Logger));
  
  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) => {
        return new BadRequestException({
          message: 'Cannot process request',
          data: errors,
        });
      },
    }),
  );

  // Swagger configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle('NestJS API')
    .setDescription('API for NestJS')
    .setVersion('1.0')
    .addTag('API')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(config.port);
}

void bootstrap();
```

## Logging Configuration

### Logger Module Setup in App Module
```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          targets: [
            {
              target: 'pino-pretty',
              options: {
                colorize: true,
                singleLine: false,
                translateTime: 'yyyy-mm-dd HH:MM:ss.l',
                hideObject: true,
                ignore: 'pid,hostname',
                messageFormat: '[{req.id}] {req.method} {req.url} - {msg}  {res.statusCode} {responseTime}',
              },
            },
          ],
        },
        redact: ['req.headers', 'res.headers'],
        level: 'debug',
      },
    }),
    PrismaModule,
    UserModule,
    AuthModule,
  ],
})
export class AppModule {}
```

### Using Logger in Services
```typescript
import { Logger } from '@nestjs/common';
@Injectable()
export class UserService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserEntity> {
    this.logger.log('Creating new user', { email: createUserDto.email });
    
    try {
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
      const user = await this.prisma.user.create({
        data: { ...createUserDto, password: hashedPassword }
      });
      
      this.logger.log('User created successfully', { userId: user.id });
      return new UserEntity(user);
    } catch (error) {
      this.logger.error('Failed to create user', error);
      throw error;
    }
  }
}
```

## Key Rules Summary

1. **One responsibility per file** - Controllers route, Services contain logic
2. **Always use Swagger decorators** on routes
3. **DTOs for input, Entities for output**
4. **Export services from modules** for reusability
5. **Global modules** for shared resources (DB, Config)
6. **Common folder** for shared utilities, constants, types
7. **Validation pipes** on all inputs
8. **Proper error handling** with built-in exceptions
9. **Environment-based configuration**
10. **Consistent file naming** with TypeScript extensions


