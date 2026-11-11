// Hata cevaplarının ortak biçimi: { code, message }.
// code: uygulamanın (mobil/web) tanıdığı sabit kod. message: kullanıcıya gösterilebilir Türkçe metin.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

export const badRequest = (code: string, message: string) => new BadRequestException({ code, message });

export const conflict = (code: string, message: string) => new ConflictException({ code, message });

export const forbidden = (code: string, message: string) => new ForbiddenException({ code, message });

export const unauthorized = (code: string, message: string) => new UnauthorizedException({ code, message });

export const notFound = (code: string, message: string) => new NotFoundException({ code, message });

export const gone = (code: string, message: string) => new GoneException({ code, message });

export const tooMany = (code: string, message: string, retryAfterSec?: number) =>
  new HttpException({ code, message, retryAfterSec }, 429);

export const tooLarge = (code: string, message: string) => new HttpException({ code, message }, 413);
