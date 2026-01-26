/**
 * Shared domain models for workflow examples
 */

import { ExperimentalOption as Option } from "../../dist/option-experimental.mjs";

// ============================================================================
// DOMAIN MODELS
// ============================================================================

type UserId = string;
type ProductId = string;
type CartId = string;

// User Entity
export class UserEntity {
  constructor(
    readonly id: UserId,
    readonly name: string,
    readonly email: string,
    readonly isActive: boolean,
  ) {}

  serialize() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      isActive: this.isActive,
    };
  }

  ensureActive(): Option<this> {
    return this.isActive ? Option.Some(this) : Option.None;
  }
}

// Product Entity
export class ProductEntity {
  constructor(
    readonly id: ProductId,
    readonly name: string,
    readonly price: number,
    readonly inStock: boolean,
    readonly stockQuantity: number,
  ) {}

  serialize() {
    return {
      id: this.id,
      name: this.name,
      price: this.price,
      inStock: this.inStock,
      stockQuantity: this.stockQuantity,
    };
  }

  ensureInStock(): Option<this> {
    return this.inStock && this.stockQuantity > 0
      ? Option.Some(this)
      : Option.None;
  }

  ensureQuantityAvailable(quantity: number): Option<this> {
    return this.stockQuantity >= quantity ? Option.Some(this) : Option.None;
  }
}

// Cart Item Entity
export class CartItemEntity {
  constructor(
    readonly productId: ProductId,
    readonly quantity: number,
    readonly priceAtAdd: number,
  ) {}

  withQuantity(quantity: number): CartItemEntity {
    return new CartItemEntity(this.productId, quantity, this.priceAtAdd);
  }

  serialize() {
    return {
      productId: this.productId,
      quantity: this.quantity,
      priceAtAdd: this.priceAtAdd,
    };
  }
}

// Cart Entity
export class CartEntity {
  constructor(
    readonly id: CartId,
    readonly userId: UserId,
    readonly items: CartItemEntity[],
    readonly createdAt: Date,
  ) {}

  serialize() {
    return {
      id: this.id,
      userId: this.userId,
      items: this.items.map((item) => item.serialize()),
      createdAt: this.createdAt.toISOString(),
    };
  }

  ensureOwner(user: UserEntity): Option<this> {
    return this.userId === user.id ? Option.Some(this) : Option.None;
  }

  getTotal(): number {
    return this.items.reduce(
      (sum, item) => sum + item.priceAtAdd * item.quantity,
      0,
    );
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

// Checkout Summary
export interface CheckoutSummary {
  user: ReturnType<UserEntity["serialize"]>;
  cart: ReturnType<CartEntity["serialize"]>;
  products: ReturnType<ProductEntity["serialize"]>[];
  total: number;
  itemCount: number;
}

// ============================================================================
// MOCK DATA
// ============================================================================

export const mockUser = new UserEntity(
  "user-123",
  "Alice",
  "alice@example.com",
  true,
);

export const mockInactiveUser = new UserEntity(
  "user-999",
  "Bob",
  "bob@example.com",
  false,
);

export const mockProduct1 = new ProductEntity(
  "prod-1",
  "Laptop",
  999.99,
  true,
  10,
);
export const mockProduct2 = new ProductEntity(
  "prod-2",
  "Mouse",
  29.99,
  true,
  50,
);
export const mockProduct3 = new ProductEntity(
  "prod-3",
  "Keyboard",
  79.99,
  false,
  0,
); // Out of stock

export const mockCartItems = [
  new CartItemEntity("prod-1", 1, 999.99),
  new CartItemEntity("prod-2", 2, 29.99),
];

export const mockCart = new CartEntity(
  "cart-456",
  "user-123",
  mockCartItems,
  new Date("2024-01-15T10:00:00Z"),
);

export const mockEmptyCart = new CartEntity(
  "cart-789",
  "user-123",
  [],
  new Date("2024-01-15T10:00:00Z"),
);

// ============================================================================
// REPOSITORY/WORKFLOW METHODS
// ============================================================================

// SYNC methods returning Option
export function findUserById(id: UserId): Option<UserEntity> {
  if (id === "user-123") {
    return Option.Some(mockUser);
  }
  if (id === "user-999") {
    return Option.Some(mockInactiveUser);
  }
  return Option.None;
}

export function findProductById(id: ProductId): Option<ProductEntity> {
  if (id === "prod-1") return Option.Some(mockProduct1);
  if (id === "prod-2") return Option.Some(mockProduct2);
  if (id === "prod-3") return Option.Some(mockProduct3);
  return Option.None;
}

export function findCartById(id: CartId): Option<CartEntity> {
  if (id === "cart-456") return Option.Some(mockCart);
  if (id === "cart-789") return Option.Some(mockEmptyCart);
  return Option.None;
}

export function validateCartNotEmpty(cart: CartEntity): Option<CartEntity> {
  return !cart.isEmpty() ? Option.Some(cart) : Option.None;
}

export function getProductsForCart(cart: CartEntity): Option<ProductEntity[]> {
  const products: ProductEntity[] = [];

  for (const item of cart.items) {
    const product = findProductById(item.productId);
    if (product.isNone()) {
      return Option.None;
    }
    products.push(product.unwrap());
  }

  return products.length > 0 ? Option.Some(products) : Option.None;
}

export function validateStockAvailability(
  products: ProductEntity[],
  cartItems: CartItemEntity[],
): Option<ProductEntity[]> {
  for (let i = 0; i < products.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: example
    const product = products[i]!;
    // biome-ignore lint/style/noNonNullAssertion: example
    const cartItem = cartItems[i]!;

    const available = product
      .ensureInStock()
      .flatMap((p) => p.ensureQuantityAvailable(cartItem.quantity));

    if (available.isNone()) {
      return Option.None;
    }
  }

  return Option.Some(products);
}

export function calculateCheckoutSummary(
  user: UserEntity,
  cart: CartEntity,
  products: ProductEntity[],
): CheckoutSummary {
  return {
    user: user.serialize(),
    cart: cart.serialize(),
    products: products.map((p) => p.serialize()),
    total: cart.getTotal(),
    itemCount: cart.items.length,
  };
}

// ASYNC methods returning Promise<Option>
export async function findUserByIdAsync(
  id: UserId,
): Promise<Option<UserEntity>> {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return findUserById(id);
}

export async function findProductByIdAsync(
  id: ProductId,
): Promise<Option<ProductEntity>> {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return findProductById(id);
}

export async function findCartByIdAsync(
  id: CartId,
): Promise<Option<CartEntity>> {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return findCartById(id);
}

export async function validateCartNotEmptyAsync(
  cart: CartEntity,
): Promise<Option<CartEntity>> {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return validateCartNotEmpty(cart);
}

export async function getProductsForCartAsync(
  cart: CartEntity,
): Promise<Option<ProductEntity[]>> {
  await new Promise((resolve) => setTimeout(resolve, 15));
  return getProductsForCart(cart);
}

export async function validateStockAvailabilityAsync(
  products: ProductEntity[],
  cartItems: CartItemEntity[],
): Promise<Option<ProductEntity[]>> {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return validateStockAvailability(products, cartItems);
}

export async function calculateCheckoutSummaryAsync(
  user: UserEntity,
  cart: CartEntity,
  products: ProductEntity[],
): Promise<CheckoutSummary> {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return calculateCheckoutSummary(user, cart, products);
}
