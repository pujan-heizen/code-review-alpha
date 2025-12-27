# NestJS Swagger Documentation Best Practices
## Configuration
### 1. nest-cli.json Setup
```json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "plugins": ["@nestjs/swagger"]
  }
}
```
### 2. Main.ts Configuration
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Global validation pipe with transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
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
    .setTitle('API Documentation')
    .setDescription('API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(3000);
}

void bootstrap();
```

## DTOs and Entities

### 1. Request DTO Pattern
```typescript
// create-user.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail({}, { message: 'Please provide valid email' })
  @Transform(({ value }) => value.toLowerCase().trim())
  email: string;

  @ApiProperty({ example: 'John Doe', minLength: 2 })
  @IsNotEmpty({ message: 'Name is required' })
  @Transform(({ value }) => value.trim())
  name: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @ApiProperty({ example: 30, required: false })
  @IsOptional()
  age?: number;
}
```

### 2. Response DTO Pattern
```typescript
// user-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

export class UserResponseDto {
  // @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' }) - No need to add this if you have configured swagger in nest-cli it will auto pick
  @Expose() // use this when needed no need to use in every Dto
  id: string;

  @Expose()
  email: string;

  @Expose()
  name: string;

  @Expose()
  age?: number;

  @Expose()
  createdAt: Date;

  @Exclude()
  password: string;
}
```

### 3. Entity Pattern
```typescript
// user.entity.ts
import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

export class User {
  id: string;
  email: string;
  name: string;
  age?: number;
  createdAt: Date;
  updatedAt: Date;
  password: string;
}
```

## Controller Implementation

### 1. Basic Controller with Swagger Decorators
```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('users')
@Controller('api/users')
export class UsersController {
  @Post()
  @ApiOperation({ summary: 'Create new user' })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request',
  })
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // Implementation
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({
    status: 200,
    description: 'User found',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    // Implementation
  }
}
```

## Validation Best Practices

### Nested Object Validation
```typescript
// address.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsPostalCode } from 'class-validator';

export class AddressDto {
  @ApiProperty({ example: '123 Main St' })
  @IsNotEmpty()
  street: string;

  @ApiProperty({ example: 'New York' })
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: '10001' })
  @IsPostalCode('US')
  zipCode: string;
}

// user.dto.ts
import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;
}
```

## File Naming Conventions

- **DTOs**: `*.dto.ts` (auto-detected by Swagger plugin)
- **Entities**: `*.entity.ts` (auto-detected by Swagger plugin)
- **Controllers**: `*.controller.ts`
- **Services**: `*.service.ts`


