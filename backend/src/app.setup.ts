import { BadRequestException, INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/errors/http-exception.filter';

function flattenErrors(errors: ValidationError[], parent = ''): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) out[field] = Object.values(error.constraints);
    Object.assign(out, flattenErrors(error.children ?? [], field));
  }
  return out;
}

// Shared by main.ts and the e2e tests so both run the same pipeline.
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed.',
          details: flattenErrors(errors),
        }),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Wolvo API')
    .setDescription('Australian online auction marketplace. Money is integer cents (AUD); times are UTC ISO-8601.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, config), {
    jsonDocumentUrl: 'api/docs-json',
  });
}
