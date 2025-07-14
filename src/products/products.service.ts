import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaClient } from '@prisma/client';
import { PaginationDto } from 'src/common';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class ProductsService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('ProductsService');

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  create(createProductDto: CreateProductDto) {
    return this.product.create({ data: createProductDto });
  }

  async findAll(paginationDto: PaginationDto) {
    const { page, limit } = paginationDto;

    const [total, data] = await Promise.all([
      this.product.count({ where: { available: true } }),
      this.product.findMany({
        where: { available: true },
        skip: (page! - 1) * limit!,
        take: limit,
      }),
    ]);

    const lastPage = Math.ceil(total / limit!);
    return {
      data: data,
      metadata: {
        total: total,
        page: page,
        lastPage: lastPage,
      },
    };
  }

  async findOne(id: number) {
    const product = await this.product.findFirst({
      where: { id: id, available: true },
    });

    if (!product)
      throw new RpcException({
        message: `Product with id #${id} not found.`,
        status: HttpStatus.NOT_FOUND,
      });

    return product;
  }

  async update(id: number, updateProductDto: UpdateProductDto) {
    const { id: __, ...data } = updateProductDto;

    await this.findOne(id);

    return await this.product.update({
      where: { id },
      data: data || {},
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    // return this.product.delete({ where: { id } });

    return await this.product.update({
      where: { id },
      data: {
        available: false,
      },
    });
  }

  async validateProducts(ids: number[]) {
    const uniqueIds = Array.from(new Set(ids));

    const products = await this.product.findMany({
      where: {
        id: {
          in: uniqueIds,
        },
      },
    });

    if (uniqueIds.length !== products.length)
      throw new RpcException({
        message: `Some products were not found.`,
        status: HttpStatus.BAD_REQUEST,
      });

    return products;
  }
}
