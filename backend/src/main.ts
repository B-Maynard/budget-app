import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = [
    'http://localhost:4200', 
    'https://bailey-budget.glitch.me',
    'https://bailey-budget.netlify.app'
  ];

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // If you want to allow cookies and credentials to be passed
  };

  app.enableCors(corsOptions);
  app.useGlobalPipes(new ValidationPipe()); // Enable global validation

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
