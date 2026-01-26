/**
 * Shared domain models for workflow examples
 */

import { ExperimentalResult as Result } from "../../dist/result-experimental.mjs";

// ============================================================================
// DOMAIN MODELS
// ============================================================================

type UserId = string;
type GroceryListId = string;
type ItemId = string;

// User Entity
export class UserEntity {
  constructor(
    readonly id: UserId,
    readonly name: string,
    readonly email: string,
  ) {}

  serialize() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
    };
  }
}

// Item Entity
export class ItemEntity {
  constructor(
    readonly id: ItemId,
    readonly name: string,
    readonly quantity: number,
    readonly isBought: boolean,
  ) {}

  serialize() {
    return {
      id: this.id,
      name: this.name,
      quantity: this.quantity,
      isBought: this.isBought,
    };
  }
}

// Grocery List Entity
export class GroceryListEntity {
  constructor(
    readonly id: GroceryListId,
    readonly name: string,
    readonly description: string,
    readonly active: boolean,
    readonly ownerId: UserId,
  ) {}

  serialize() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      active: this.active,
      ownerId: this.ownerId,
    };
  }

  ensureIsOwner(user: UserEntity): Result<this, GroceryListOwnershipError> {
    if (this.ownerId !== user.id) {
      return Result.Err(new GroceryListOwnershipError(this.id));
    }
    return Result.Ok(this);
  }
}

// Stats
export interface GroceryListStats {
  totalItems: number;
  pendingItems: number;
  completedItems: number;
  completionPercentage: number;
}

// Details output
export interface GroceryListDetails {
  id: GroceryListId;
  name: string;
  description: string;
  active: boolean;
  owner: ReturnType<UserEntity["serialize"]>;
  items: ReturnType<ItemEntity["serialize"]>[];
  stats: GroceryListStats;
}

// Error types
export class GroceryListOwnershipError {
  readonly _tag = "GroceryListOwnershipError";
  constructor(readonly listId: GroceryListId) {}
}

export class ValidationError {
  readonly _tag = "ValidationError";
  constructor(readonly message: string) {}
}

export type GroceryListError = GroceryListOwnershipError | ValidationError;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function calculateDetailedStats(items: ItemEntity[]): GroceryListStats {
  const totalItems = items.length;
  const pendingItems = items.filter((item) => !item.isBought).length;
  const completedItems = items.filter((item) => item.isBought).length;

  const completionPercentage =
    totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  return {
    totalItems,
    pendingItems,
    completedItems,
    completionPercentage: Math.round(completionPercentage * 100) / 100,
  };
}

// ============================================================================
// MOCK DATA
// ============================================================================

export const mockUser = new UserEntity(
  "user-123",
  "Alice",
  "alice@example.com",
);

export const mockDifferentUser = new UserEntity(
  "user-999",
  "Bob",
  "bob@example.com",
);

export const mockGroceryList = new GroceryListEntity(
  "list-456",
  "Weekly Shopping",
  "Weekly grocery list",
  true,
  "user-123",
);

export const mockItems: ItemEntity[] = [
  new ItemEntity("item-1", "Milk", 2, true),
  new ItemEntity("item-2", "Eggs", 12, false),
  new ItemEntity("item-3", "Bread", 1, false),
];

// ============================================================================
// REPOSITORY/WORKFLOW METHODS
// ============================================================================

// SYNC methods returning Result
export function fetchUserById(id: UserId): Result<UserEntity, ValidationError> {
  if (id === "user-123") {
    return Result.Ok(mockUser);
  }
  return Result.Err(new ValidationError(`User not found: ${id}`));
}

export function ensureListIsActive(
  list: GroceryListEntity,
): Result<GroceryListEntity, ValidationError> {
  if (list.active) {
    return Result.Ok(list);
  }
  return Result.Err(new ValidationError("List is not active"));
}

export function validateItems(
  items: ItemEntity[],
): Result<ItemEntity[], ValidationError> {
  if (items.length === 0) {
    return Result.Err(new ValidationError("Items cannot be empty"));
  }
  const hasInvalidQuantity = items.some((item) => item.quantity <= 0);
  if (hasInvalidQuantity) {
    return Result.Err(
      new ValidationError("All items must have positive quantity"),
    );
  }
  return Result.Ok(items);
}

export function filterActiveItems(
  items: ItemEntity[],
): Result<ItemEntity[], ValidationError> {
  const filtered = items.filter((item) => !item.isBought);
  if (filtered.length === 0) {
    return Result.Err(new ValidationError("No active items found"));
  }
  return Result.Ok(filtered);
}

// ASYNC methods returning Promise<Result>
export async function fetchUserByIdAsync(
  id: UserId,
): Promise<Result<UserEntity, ValidationError>> {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return fetchUserById(id);
}

export async function fetchItemsForListAsync(
  listId: GroceryListId,
): Promise<Result<ItemEntity[], ValidationError>> {
  await new Promise((resolve) => setTimeout(resolve, 10));
  if (listId === "list-456") {
    return Result.Ok(mockItems);
  }
  return Result.Err(new ValidationError(`Items not found for list: ${listId}`));
}

// ASYNC methods returning Promise (for use as mappers)
export async function serializeItemsAsync(
  items: ItemEntity[],
): Promise<ReturnType<ItemEntity["serialize"]>[]> {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return items.map((item) => item.serialize());
}

export async function calculateDetailedStatsAsync(
  items: ItemEntity[],
): Promise<GroceryListStats> {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return calculateDetailedStats(items);
}

export async function validateUserPermissionsAsync(
  user: UserEntity,
  list: GroceryListEntity,
): Promise<Result<UserEntity, ValidationError>> {
  await new Promise((resolve) => setTimeout(resolve, 5));
  if (user.id === list.ownerId) {
    return Result.Ok(user);
  }
  return Result.Err(new ValidationError("User lacks permission"));
}

export async function fetchListWithOwnerAsync(
  listId: GroceryListId,
  userId: UserId,
): Promise<
  Result<{ list: GroceryListEntity; owner: UserEntity }, ValidationError>
> {
  const owner = await fetchUserByIdAsync(userId);
  if (owner.isErr()) {
    return Result.Err(owner.unwrapErr());
  }

  if (listId !== "list-456") {
    return Result.Err(new ValidationError(`List not found: ${listId}`));
  }

  return Result.Ok({ list: mockGroceryList, owner: owner.unwrap() });
}
