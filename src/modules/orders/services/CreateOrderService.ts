import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) { }

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    // TODO
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('User does not exists', 400);
    }

    const storageProducts = await this.productsRepository.findAllById(products);

    if (storageProducts.length !== products.length) {
      throw new AppError('One of the products id does not exists', 400);
    }

    const productsWithStockData = storageProducts.map(storageProduct => {
      const selectedProduct = products.find(
        product => product.id === storageProduct.id,
      );

      return {
        ...storageProduct,
        quantity: selectedProduct && selectedProduct.quantity,
        stock:
          selectedProduct && storageProduct.quantity - selectedProduct.quantity,
        outOfStock:
          selectedProduct &&
          storageProduct.quantity - selectedProduct.quantity < 0,
      };
    });

    productsWithStockData.forEach(productWithStock => {
      if (productWithStock.outOfStock) {
        throw new AppError(
          `The product ${productWithStock.name} is out of stock`,
          400,
        );
      }
    });

    const formatedProducts = productsWithStockData.map(product => ({
      product_id: product.id,
      price: product.price,
      quantity: Number(product.quantity),
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: formatedProducts,
    });

    const updateProductQuantityFormated = productsWithStockData.map(product => {
      return {
        id: product.id,
        quantity: Number(product.stock),
      };
    });

    await this.productsRepository.updateQuantity(updateProductQuantityFormated);

    return order;
  }
}

export default CreateOrderService;
