import { describe, expect, it } from "bun:test"
import { Option } from "@/option.js"

describe("README Examples - Option Type", () => {
  describe("Basic Option Type", () => {
    it("should create Some and None variants", () => {
      const opt1: Option<number> = Option.Some(5)
      expect(opt1.isSome()).toBe(true)
      expect(opt1.unwrap()).toBe(5)

      const opt2: Option<number> = Option.None
      expect(opt2.isNone()).toBe(true)
    })
  })

  describe("Without using fp library (comparison)", () => {
    it("should handle nested null checks with standard null pattern", () => {
      function getUserByEmail(user: { email?: string }): string | null {
        return user.email ? user.email : null
      }

      function getUserAdress(user: { email?: string }): string | null {
        return user.email ? "Some Address" : null
      }

      const email = getUserByEmail({ email: "test@test.com" })
      if (email) {
        const address = getUserAdress({ email })
        if (address) {
          expect(email).toBe("test@test.com")
          expect(address).toBe("Some Address")
        }
      }
    })
  })

  describe("With using fp library", () => {
    it("should handle nested null checks with Option and flatZip", () => {
      function getUserByEmail(user: { email?: string }): Option<string> {
        return user.email ? Option.Some(user.email) : Option.None
      }

      function getUserAddress(user: { email?: string }): Option<string> {
        return user.email ? Option.Some("Some Address") : Option.None
      }

      const res = getUserByEmail({ email: "test@test.com" }).flatZip((email) =>
        getUserAddress({ email }),
      )

      expect(res.isSome()).toBe(true)
      const [email, address] = res.unwrap()
      expect(email).toBe("test@test.com")
      expect(address).toBe("Some Address")
    })

    it("should return None when user has no email", () => {
      function getUserByEmail(user: { email?: string }): Option<string> {
        return user.email ? Option.Some(user.email) : Option.None
      }

      function getUserAddress(user: { email?: string }): Option<string> {
        return user.email ? Option.Some("Some Address") : Option.None
      }

      const res = getUserByEmail({ email: undefined }).flatZip((email) =>
        getUserAddress({ email }),
      )

      expect(res.isNone()).toBe(true)
    })
  })

  describe("map", () => {
    it("should apply bonus to balance using map", async () => {
      async function fetchUserBalanceFromDatabase(
        userId: string,
      ): Promise<Option<number>> {
        await Promise.resolve(userId)
        return Option.Some(100)
      }

      async function applyBonus() {
        const userId = "user123"
        const balanceOption = await Option.Some(userId)
          .flatMap(fetchUserBalanceFromDatabase)
          .map((balance) => balance * 1.1)
          .toPromise()
        return balanceOption
      }

      const result = await applyBonus()
      expect(result.isSome()).toBe(true)
      expect(result.unwrap()).toBeCloseTo(110)
    })

    it("should return None when user has no balance", async () => {
      async function fetchUserBalanceFromDatabase(
        userId: string,
      ): Promise<Option<number>> {
        await Promise.resolve(userId)
        return Option.None
      }

      const balanceOption = await Option.Some("user123")
        .flatMap(fetchUserBalanceFromDatabase)
        .map((balance) => balance * 1.1)
        .toPromise()

      expect(balanceOption.isNone()).toBe(true)
    })
  })

  describe("flatZip", () => {
    it("should combine price and stock using flatZip", async () => {
      async function fetchProductPrice(
        productId: string,
      ): Promise<Option<number>> {
        await Promise.resolve(productId)
        return Option.Some(100)
      }

      // Note: flatZip receives the price (number) from flatMap, not the original productId
      async function fetchProductStock(price: number): Promise<Option<number>> {
        await Promise.resolve(price)
        return Option.Some(50)
      }

      async function fetchProductDetails(
        productId: string,
      ): Promise<Option<[number, number]>> {
        const productDetails = await Option.Some(productId)
          .flatMap(fetchProductPrice)
          .flatZip(fetchProductStock)
          .toPromise()
        return productDetails
      }

      const result = await fetchProductDetails("123")
      expect(result.isSome()).toBe(true)
      expect(result.unwrap()).toEqual([100, 50])
    })

    it("should return None when price is not found", async () => {
      async function fetchProductPrice(
        productId: string,
      ): Promise<Option<number>> {
        await Promise.resolve(productId)
        return Option.None
      }

      // Note: README example has fetchProductStock(productId: string) but flatZip
      // receives the result of flatMap (the price number), not the original productId
      async function fetchProductStock(price: number): Promise<Option<number>> {
        await Promise.resolve(price)
        return Option.Some(50)
      }

      const result = await Option.Some("123")
        .flatMap(fetchProductPrice)
        .flatZip(fetchProductStock)
        .toPromise()

      expect(result.isNone()).toBe(true)
    })
  })

  describe("mapOr", () => {
    it("should return mapped value for Some", async () => {
      async function findUserById(id: number): Promise<Option<number>> {
        await Promise.resolve(id)
        if (id === 0) {
          return Option.None
        }
        return Option.Some(id)
      }

      async function safeFindUserById(id: number): Promise<string> {
        const res = (await findUserById(id)).mapOr(
          `User not found`,
          (res) => `User: ${res}`,
        )
        return res
      }

      const result = await safeFindUserById(10)
      expect(result).toBe("User: 10")
    })

    it("should return default for None", async () => {
      async function findUserById(id: number): Promise<Option<number>> {
        await Promise.resolve(id)
        if (id === 0) {
          return Option.None
        }
        return Option.Some(id)
      }

      async function safeFindUserById(id: number): Promise<string> {
        const res = (await findUserById(id)).mapOr(
          `User not found`,
          (res) => `User: ${res}`,
        )
        return res
      }

      const result = await safeFindUserById(0)
      expect(result).toBe("User not found")
    })
  })

  describe("Creating Values from Existing Data", () => {
    it("should create Option from nullable value with fromNullable", () => {
      function findUser(id: string): { name: string } | null {
        return id === "1" ? { name: "Alice" } : null
      }

      const user = Option.fromNullable(findUser("1"))
      expect(user.isSome()).toBe(true)
      expect(user.unwrap()).toEqual({ name: "Alice" })

      const missing = Option.fromNullable(findUser("999"))
      expect(missing.isNone()).toBe(true)
    })

    it("should create Option from falsy values with fromFalsy", () => {
      const valid = Option.fromFalsy("hello")
      expect(valid.isSome()).toBe(true)
      expect(valid.unwrap()).toBe("hello")

      const empty = Option.fromFalsy("")
      expect(empty.isNone()).toBe(true)

      const zero = Option.fromFalsy(0)
      expect(zero.isNone()).toBe(true)

      const falsy = Option.fromFalsy(false)
      expect(falsy.isNone()).toBe(true)

      const nil = Option.fromFalsy(null)
      expect(nil.isNone()).toBe(true)
    })

    it("should create Option from predicate with fromPredicate", () => {
      const age = 25
      const adult = Option.fromPredicate(age, (a) => a >= 18)
      expect(adult.isSome()).toBe(true)
      expect(adult.unwrap()).toBe(25)

      const minor = Option.fromPredicate(15, (a) => a >= 18)
      expect(minor.isNone()).toBe(true)
    })
  })

  describe("Transforming Inner Values", () => {
    it("should filter values with predicate", () => {
      const age = Option.Some(25)
      const adult = age.filter((a) => a >= 18)
      expect(adult.isSome()).toBe(true)
      expect(adult.unwrap()).toBe(25)

      const minor = Option.Some(15).filter((a) => a >= 18)
      expect(minor.isNone()).toBe(true)

      const noneFiltered = Option.None.filter((a: number) => a >= 18)
      expect(noneFiltered.isNone()).toBe(true)
    })

    it("should map inner array values", () => {
      const numbers = Option.Some([1, 2, 3, 4, 5])
      const doubled = numbers.innerMap((n) => n * 2)
      expect(doubled.isSome()).toBe(true)
      expect(doubled.unwrap()).toEqual([2, 4, 6, 8, 10])

      const noneInnerMap = Option.None.innerMap((n: number) => n * 2)
      expect(noneInnerMap.isNone()).toBe(true)
    })
  })

  describe("Combining & Converting", () => {
    it("should convert Some to Ok and None to Err with toResult", () => {
      const user = Option.Some({ name: "Alice" })
      const userResult = user.toResult("User not found")
      expect(userResult.isOk()).toBe(true)
      expect(userResult.unwrap()).toEqual({ name: "Alice" })

      const missing = Option.None.toResult("User not found")
      expect(missing.isErr()).toBe(true)
      expect(missing.unwrapErr()).toBe("User not found")
    })

    it("should wrap Promise in Option with fromPromise", async () => {
      async function fetchUser(id: string): Promise<Option<{ name: string }>> {
        await Promise.resolve(id)
        return id === "1" ? Option.Some({ name: "Alice" }) : Option.None
      }

      const userOpt = Option.fromPromise(fetchUser("1"))
      expect(userOpt.isSome()).toBe(true)

      const inner = await userOpt.unwrap()
      expect(inner).toEqual({ name: "Alice" })
    })

    it("should wrap failed Promise with fromPromise", async () => {
      async function fetchUser(id: string): Promise<Option<{ name: string }>> {
        await Promise.resolve(id)
        return Option.None
      }

      const userOpt = Option.fromPromise(fetchUser("999"))
      // fromPromise wraps the promise - the Option is Some containing the Promise
      expect(userOpt.isSome()).toBe(true)

      await expect(userOpt.unwrap()).rejects.toThrow()
      const resolved = await userOpt.toPromise()
      expect(resolved.isNone()).toBe(true)
    })
  })

  describe("Aggregation Helpers", () => {
    it("should return first Some with any", () => {
      const first = Option.any(
        Option.None,
        Option.Some("First value"),
        Option.Some("Second value"),
      )
      expect(first.isSome()).toBe(true)
      expect(first.unwrap()).toBe("First value")

      const allNone = Option.any(Option.None, Option.None, Option.None)
      expect(allNone.isNone()).toBe(true)
    })
  })
})
