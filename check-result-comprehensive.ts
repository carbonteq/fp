import { Result } from "./dist/result.mjs";

// ============================================================================
// DOMAIN MODELS
// ============================================================================

type UserId = string;
type GroceryListId = string;
type ItemId = string;

type SerializedUser = {
  id: UserId;
  name: string;
  email: string;
};

class UserEntity {
  constructor(
    readonly id: UserId,
    readonly name: string,
    readonly email: string,
  ) {}

  serialize(): SerializedUser {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
    };
  }
}

type SerializedItem = {
  id: ItemId;
  name: string;
  quantity: number;
  isBought: boolean;
};

class ItemEntity {
  constructor(
    readonly id: ItemId,
    readonly name: string,
    readonly quantity: number,
    readonly isBought: boolean,
  ) {}

  serialize(): SerializedItem {
    return {
      id: this.id,
      name: this.name,
      quantity: this.quantity,
      isBought: this.isBought,
    };
  }
}

type SerializedGroceryList = {
  id: GroceryListId;
  name: string;
  description: string;
  active: boolean;
  ownerId: UserId;
};

class GroceryListEntity {
  constructor(
    readonly id: GroceryListId,
    readonly name: string,
    readonly description: string,
    readonly active: boolean,
    readonly ownerId: UserId,
  ) {}

  serialize(): SerializedGroceryList {
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

interface GroceryListStats {
  totalItems: number;
  pendingItems: number;
  completedItems: number;
  completionPercentage: number;
}

interface GroceryListDetails {
  id: GroceryListId;
  name: string;
  description: string;
  active: boolean;
  owner: SerializedUser;
  items: SerializedItem[];
  stats: GroceryListStats;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

class GroceryListOwnershipError {
  readonly _tag = "GroceryListOwnershipError";
  constructor(readonly listId: GroceryListId) {}
}

class ValidationError {
  readonly _tag = "ValidationError";
  constructor(readonly message: string) {}
}

type GroceryListError = GroceryListOwnershipError | ValidationError;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateDetailedStats(items: ItemEntity[]): GroceryListStats {
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

const mockUser = new UserEntity("user-123", "Alice", "alice@example.com");

const mockDifferentUser = new UserEntity("user-999", "Bob", "bob@example.com");

const mockGroceryList = new GroceryListEntity(
  "list-456",
  "Weekly Shopping",
  "Weekly grocery list",
  true,
  "user-123",
);

const mockItems: ItemEntity[] = [
  new ItemEntity("item-1", "Milk", 2, true),
  new ItemEntity("item-2", "Eggs", 12, false),
  new ItemEntity("item-3", "Bread", 1, false),
];

// ============================================================================
// IMPLEMENTATION STYLES - Implement processListDetails here
// ============================================================================

// Style 1: flatMap chain
function processListDetailsUsingFlatMap(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
): Result<GroceryListDetails, GroceryListError> {
  const r = list
    .ensureIsOwner(owner)
    .map((_) => list.serialize())
    .zip((_) => owner.serialize())
    .map(([listEncoded, ownerEncoded]) => {
      const itemsEncoded = items.map((item) => item.serialize());

      return {
        owner: ownerEncoded,
        list: listEncoded,
        items: itemsEncoded,
      };
    })
    .map(({ list, owner, items: itemsSerialized }) => {
      const stats = calculateDetailedStats(items);

      return {
        ...list,
        items: itemsSerialized,
        owner,
        stats,
      };
    });

  return r;
}

const result1_ok = processListDetailsUsingFlatMap(
  mockGroceryList,
  mockUser,
  mockItems,
);
const result1_err = processListDetailsUsingFlatMap(
  mockGroceryList,
  mockDifferentUser,
  mockItems,
);

console.log("---------------------- Using normal composition ---------------");
console.log(result1_ok._tag, result1_ok.safeUnwrap());
console.log(result1_err._tag, result1_err.safeUnwrap());

// Style 2: Result.gen (simplified)
function processListDetailsUsingGen(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
): Result<GroceryListDetails, GroceryListError> {
  const r = Result.gen(function* () {
    yield* list.ensureIsOwner(owner);

    const listEncoded = list.serialize();
    const ownerEncoded = owner.serialize();
    const itemsEncoded = items.map((item) => item.serialize());

    const stats = calculateDetailedStats(items);

    return {
      ...listEncoded,
      owner: ownerEncoded,
      items: itemsEncoded,
      stats,
    };
  });

  return r;
}

const result2_ok = processListDetailsUsingGen(
  mockGroceryList,
  mockUser,
  mockItems,
);
const result2_err = processListDetailsUsingGen(
  mockGroceryList,
  mockDifferentUser,
  mockItems,
);

console.log("---------------------- Using Result.gen ---------------");
console.log(result2_ok._tag, result2_ok.safeUnwrap());
console.log(result2_err._tag, result2_err.safeUnwrap());

// Style 3: Result.genAdapter
function processListDetailsUsingGenAdapter(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
): Result<GroceryListDetails, GroceryListError> {
  const r = Result.genAdapter(function* ($) {
    yield* $(list.ensureIsOwner(owner));

    const listEncoded = list.serialize();
    const ownerEncoded = owner.serialize();
    const itemsEncoded = items.map((item) => item.serialize());

    const stats = calculateDetailedStats(items);

    return {
      ...listEncoded,
      owner: ownerEncoded,
      items: itemsEncoded,
      stats,
    };
  });

  return r;
}
const result3_ok = processListDetailsUsingGenAdapter(
  mockGroceryList,
  mockUser,
  mockItems,
);
const result3_err = processListDetailsUsingGenAdapter(
  mockGroceryList,
  mockDifferentUser,
  mockItems,
);
console.log("---------------------- Using Result.genAdapter ---------------");
console.log(result3_ok._tag, result3_ok.safeUnwrap());
console.log(result3_err._tag, result3_err.safeUnwrap());

// Style 4: Result.asyncGen
async function processListDetailsAsync(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
): Promise<Result<GroceryListDetails, GroceryListError>> {
  // TODO: Implement
  throw new Error("Not implemented");
}

// Style 5: Result.asyncGenAdapter
async function processListDetailsAsyncAdapter(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
): Promise<Result<GroceryListDetails, GroceryListError>> {
  // TODO: Implement
  throw new Error("Not implemented");
}
