import { describe, expect, it } from "bun:test"
import { Result } from "@/result.js"

describe("README Examples - Result Type", () => {
  describe("Basic Result Type", () => {
    it("should create Ok and Result variants", () => {
      const res1: Result<number, string> = Result.Ok(5)
      expect(res1.isOk()).toBe(true)
      expect(res1.unwrap()).toBe(5)

      const res2: Result<number, string> = Result.Err("Some Error")
      expect(res2.isErr()).toBe(true)
      expect(res2.unwrapErr()).toBe("Some Error")
    })
  })

  describe("flatMap", () => {
    it("should chain validation and async save operations", async () => {
      const validateUserData = (
        name: string,
        age: number,
      ): Result<{ name: string; age: number }, Error> => {
        if (name.trim() === "") {
          return Result.Err(new Error("Name cannot be empty"))
        }
        if (age < 0 || age > 120) {
          return Result.Err(new Error("Age must be between 0 and 120"))
        }
        return Result.Ok({ name, age })
      }

      const saveUserData = async (user: {
        name: string
        age: number
      }): Promise<Result<string, Error>> => {
        await Promise.resolve(user)
        return Result.Ok(`User ${user.name} saved successfully!`)
      }

      const processUser = async (
        name: string,
        age: number,
      ): Promise<Result<string, Error>> => {
        const validationResult = await validateUserData(name, age)
          .flatMap(saveUserData)
          .toPromise()
        return validationResult
      }

      const result = await processUser("Alice", 30)
      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toBe("User Alice saved successfully!")

      const invalidResult = await processUser("", 30)
      expect(invalidResult.isErr()).toBe(true)
      expect(invalidResult.unwrapErr().message).toBe("Name cannot be empty")
    })
  })

  describe("zip", () => {
    it("should pair original price with discounted price", async () => {
      async function fetchProductPrice(
        productId: string,
      ): Promise<Result<number, Error>> {
        await Promise.resolve(productId)
        return Result.Ok(100)
      }

      async function applyDiscount(
        productId: string,
      ): Promise<Result<[number, number], Error>> {
        const originalPrice = await Result.Ok(productId)
          .flatMap(fetchProductPrice)
          .zip((price) => price * 0.9)
          .toPromise()
        return originalPrice
      }

      const result = await applyDiscount("123")
      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toEqual([100, 90])
    })
  })

  describe("mapErr", () => {
    it("should transform error to string message", () => {
      function divideNumbers(a: number, b: number): Result<number, Error> {
        if (b === 0) {
          return Result.Err(new Error("Division by zero"))
        }
        return Result.Ok(a / b)
      }

      function safeDivide(a: number, b: number): Result<number, string> {
        const res = divideNumbers(a, b).mapErr(
          (err) => `Operation failed: ${err.message}`,
        )
        return res
      }

      const success = safeDivide(10, 2)
      expect(success.isOk()).toBe(true)
      expect(success.unwrap()).toBe(5)

      const failure = safeDivide(10, 0)
      expect(failure.isErr()).toBe(true)
      expect(failure.unwrapErr()).toBe("Operation failed: Division by zero")
    })
  })

  describe("all", () => {
    it("should aggregate multiple Results successfully", async () => {
      type User = {
        userId: string
        userName: string
        createdAt: Date | string
      }

      type Post = {
        postId: string
        likes: number
        replies: number
        createdAt: Date | string
        author: string
      }

      async function fetchUser(userId: string): Promise<Result<User, unknown>> {
        return Result.Ok({
          userId,
          userName: "Functional Programmer",
          createdAt: "2025-01-01",
        })
      }

      async function fetchPosts(
        userId: string,
      ): Promise<Result<Post[], string>> {
        return Result.Ok([
          {
            postId: "1",
            likes: 12,
            replies: 3,
            createdAt: "2025-01-01",
            author: userId,
          },
        ])
      }

      async function fetchLikes(
        _userId: string,
      ): Promise<
        Result<
          Array<{ likeId: string; postId: string; createdAt: string }>,
          unknown
        >
      > {
        return Result.Ok([
          { likeId: "3", postId: "2", createdAt: "2025-01-01" },
        ])
      }

      async function fetchReplies(
        _userId: string,
      ): Promise<Result<Array<{ replyId: string; postId: string }>, string>> {
        return Result.Ok([
          {
            replyId: "1",
            postId: "2",
          },
        ])
      }

      function generateHash(userId: string): Result<string, Error> {
        return Result.Ok(`${userId}_HASH_VALUE`)
      }

      async function getUserData(userId: string) {
        const userIdRes = Result.Ok(userId)

        const user = userIdRes.flatMap(fetchUser)
        const posts = userIdRes.flatMap(fetchPosts)
        const likes = userIdRes.flatMap(fetchLikes)
        const replies = userIdRes.flatMap(fetchReplies)
        const hash = userIdRes.flatMap(generateHash)

        return await Result.all(user, posts, likes, replies, hash).toPromise()
      }

      const result = await getUserData("USER_ID")
      expect(result.isOk()).toBe(true)

      const [user, posts, _likes, _replies, hash] = result.unwrap()
      expect(user.userName).toBe("Functional Programmer")
      expect(posts).toHaveLength(1)
      expect(posts[0].postId).toBe("1")
      expect(hash).toBe("USER_ID_HASH_VALUE")
    })

    it("should accumulate errors from multiple Results", async () => {
      type Post = { postId: string }
      type Reply = { replyId: string }

      async function fetchPosts(): Promise<Result<Post[], string>> {
        return Result.Err("User has no posts!")
      }

      async function fetchReplies(): Promise<Result<Reply[], string>> {
        return Result.Err("User has no replies!")
      }

      // Match the pattern from README - use flatMap to get Result<Promise<T>, E>
      const user = Result.Ok("user")
      const posts = user.flatMap(() => fetchPosts())
      const replies = user.flatMap(() => fetchReplies())

      const result = await Result.all(user, posts, replies).toPromise()

      expect(result.isErr()).toBe(true)
      expect(result.unwrapErr()).toEqual([
        "User has no posts!",
        "User has no replies!",
      ])
    })
  })

  describe("validate", () => {
    it("should validate password with sync validators", () => {
      function hasMinimumLength(password: string): Result<boolean, Error> {
        return password.length < 8
          ? Result.Err(new Error("Password must be at least 8 characters"))
          : Result.Ok(true)
      }

      function hasSpecialCharacters(password: string): Result<boolean, Error> {
        const specialCharsRegex = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/
        return !specialCharsRegex.test(password)
          ? Result.Err(
              new Error("Password must contain at least one special character"),
            )
          : Result.Ok(true)
      }

      const validatedOk = Result.Ok("password321!").validate([
        hasMinimumLength,
        hasSpecialCharacters,
      ])
      expect(validatedOk.isOk()).toBe(true)
      expect(validatedOk.unwrap()).toBe("password321!")
    })

    it("should accumulate validation errors", () => {
      function hasMinimumLength(password: string): Result<boolean, Error> {
        return password.length < 8
          ? Result.Err(new Error("Password must be at least 8 characters"))
          : Result.Ok(true)
      }

      function hasSpecialCharacters(password: string): Result<boolean, Error> {
        const specialCharsRegex = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/
        return !specialCharsRegex.test(password)
          ? Result.Err(
              new Error("Password must contain at least one special character"),
            )
          : Result.Ok(true)
      }

      const validatedErr = Result.Ok("pword").validate([
        hasMinimumLength,
        hasSpecialCharacters,
      ])
      expect(validatedErr.isErr()).toBe(true)
      const errors = validatedErr.unwrapErr()
      expect(errors).toHaveLength(2)
      expect(errors[0].message).toBe("Password must be at least 8 characters")
    })

    it("should validate with async validators", async () => {
      function hasMinimumLength(password: string): Result<boolean, Error> {
        return password.length < 8
          ? Result.Err(new Error("Password must be at least 8 characters"))
          : Result.Ok(true)
      }

      function hasSpecialCharacters(password: string): Result<boolean, Error> {
        const specialCharsRegex = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/
        return !specialCharsRegex.test(password)
          ? Result.Err(
              new Error("Password must contain at least one special character"),
            )
          : Result.Ok(true)
      }

      async function isNotSameAsPrevious(
        password: string,
      ): Promise<Result<boolean, Error>> {
        await Promise.resolve()
        if (password === "password123!") {
          return Result.Err(
            new Error("New password cannot be the same as previous password"),
          )
        }
        return Result.Ok(true)
      }

      const validatedErrs = await Result.Ok("password123!")
        .validate([hasMinimumLength, hasSpecialCharacters, isNotSameAsPrevious])
        .toPromise()
      expect(validatedErrs.isErr()).toBe(true)
      const errors = validatedErrs.unwrapErr()
      expect(errors[errors.length - 1].message).toBe(
        "New password cannot be the same as previous password",
      )
    })
  })

  describe("unwrap functions", () => {
    it("should unwrap value from Ok", () => {
      function divideNumbers(a: number, b: number): Result<number, Error> {
        if (b === 0) {
          return Result.Err(new Error("Division by zero"))
        }
        return Result.Ok(a / b)
      }

      const result = divideNumbers(10, 2)
      expect(result.unwrap()).toBe(5)
    })

    it("should safely unwrap returning null for Err", () => {
      function divideNumbers(a: number, b: number): Result<number, Error> {
        if (b === 0) {
          return Result.Err(new Error("Division by zero"))
        }
        return Result.Ok(a / b)
      }

      const result = divideNumbers(10, 0)
      expect(result.safeUnwrap()).toBeNull()
    })

    it("should unwrap error from Err", () => {
      const errorResult = Result.Err(new Error("Something went wrong"))
      const error = errorResult.unwrapErr()
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe("Something went wrong")
    })

    it("should throw when unwrapping Err", () => {
      const errorResult = Result.Err(new Error("Something went wrong"))
      expect(() => errorResult.unwrap()).toThrow()
    })
  })

  describe("Creating Values from Existing Data", () => {
    it("should create Result from nullable value", () => {
      function getConfig(_key: string): string | undefined {
        return undefined
      }

      const config = Result.fromNullable(
        getConfig("API_KEY"),
        "API_KEY not set",
      )
      expect(config.isErr()).toBe(true)
      expect(config.unwrapErr()).toBe("API_KEY not set")
    })

    it("should create Result from predicate", () => {
      const passed = Result.fromPredicate(85, (s) => s >= 60, "Score too low")
      expect(passed.isOk()).toBe(true)
      expect(passed.unwrap()).toBe(85)

      const failed = Result.fromPredicate(45, (s) => s >= 60, "Score too low")
      expect(failed.isErr()).toBe(true)
      expect(failed.unwrapErr()).toBe("Score too low")
    })
  })

  describe("Exception Handling", () => {
    it("should wrap sync operation in tryCatch", () => {
      function parseJson(json: string): Result<unknown, Error> {
        return Result.tryCatch(
          () => JSON.parse(json),
          (e) => (e instanceof Error ? e : new Error(String(e))),
        )
      }

      const valid = parseJson('{"name":"Alice"}')
      expect(valid.isOk()).toBe(true)
      expect(valid.unwrap()).toEqual({ name: "Alice" })

      const invalid = parseJson("invalid json")
      expect(invalid.isErr()).toBe(true)
      expect(invalid.unwrapErr()).toBeInstanceOf(SyntaxError)
    })

    it("should wrap async operation in tryAsyncCatch", async () => {
      function fetchUserData(
        _id: string,
      ): Result<Promise<{ name: string }>, Error> {
        return Result.tryAsyncCatch(
          async () => {
            return { name: "Test User" }
          },
          (e) => (e instanceof Error ? e : new Error(String(e))),
        )
      }

      const result = await fetchUserData("123").unwrap()
      expect(result.name).toBe("Test User")
    })
  })

  describe("Transforming Inner Values", () => {
    it("should map inner array values", () => {
      const numbers = Result.Ok([1, 2, 3, 4, 5])
      const squared = numbers.innerMap((n) => n * n)
      expect(squared.isOk()).toBe(true)
      expect(squared.unwrap()).toEqual([1, 4, 9, 16, 25])
    })

    it("should map both Ok and Err values", () => {
      const result = Result.Ok(42)
      const decorated = result.mapBoth(
        (val) => `Success: ${val}`,
        () => "Error",
      )
      expect(decorated.isOk()).toBe(true)
      expect(decorated.unwrap()).toBe("Success: 42")

      const error = Result.Err("Something failed")
      const decoratedError = error.mapBoth(
        () => "Success",
        (err) => `Error: ${err}`,
      )
      expect(decoratedError.isErr()).toBe(true)
      expect(decoratedError.unwrapErr()).toBe("Error: Something failed")
    })
  })

  describe("Combining & Converting", () => {
    it("should convert Ok to Some, Err to None", () => {
      const success = Result.Ok(42)
      const opt = success.toOption()
      expect(opt.isSome()).toBe(true)
      expect(opt.unwrap()).toBe(42)

      const failure = Result.Err("Failed")
      const optFromErr = failure.toOption()
      expect(optFromErr.isNone()).toBe(true)
    })

    it("should wrap Promise in Result", async () => {
      async function fetchData(id: string): Promise<Result<string, Error>> {
        return id === "1"
          ? Result.Ok("Data")
          : Result.Err(new Error("Not found"))
      }

      const dataRes = Result.fromPromise(fetchData("1"))
      expect(dataRes.isOk()).toBe(true)

      const inner = await dataRes.unwrap()
      expect(inner).toBe("Data")
    })

    it("should zipErr - validate permissions", () => {
      const checkPermissions = (userId: string) =>
        Result.Ok(userId).zipErr((id) =>
          id === "guest"
            ? Result.Err("Guest users have limited access")
            : Result.Ok(undefined),
        )

      const admin = checkPermissions("admin-123")
      expect(admin.isOk()).toBe(true)
      expect(admin.unwrap()).toBe("admin-123")

      const guest = checkPermissions("guest")
      expect(guest.isErr()).toBe(true)
      expect(guest.unwrapErr()).toBe("Guest users have limited access")

      const okNoChange = Result.Ok("42").zipErr((id) => Result.Ok(id.length))
      expect(okNoChange.isOk()).toBe(true)
      expect(okNoChange.unwrap()).toBe("42")

      const alreadyFailed = Result.Err<string, string>("Network error").zipErr(
        () => Result.Err("Validation error"),
      )
      expect(alreadyFailed.isErr()).toBe(true)
      expect(alreadyFailed.unwrapErr()).toBe("Network error")
    })

    it("should demonstrate mapErr vs zipErr difference", () => {
      // Note: README has Result.Err<number, Error> but correct type is Result.Err<Error, number>
      // since Err<E, T> signature has E (error) first, T (success) second
      const res = Result.Err<Error, number>(new Error("boom")).mapErr(
        (e) => e.message,
      )
      expect(res.isErr()).toBe(true)
      expect(res.unwrapErr()).toBe("boom")

      const ok = Result.Ok("42").zipErr((value) =>
        value === "0" ? Result.Err("invalid") : Result.Ok(value.length),
      )
      expect(ok.isOk()).toBe(true)
      expect(ok.unwrap()).toBe("42")

      const err = Result.Ok("0").zipErr((value) =>
        value === "0" ? Result.Err("invalid") : Result.Ok(value.length),
      )
      expect(err.isErr()).toBe(true)
      expect(err.unwrapErr()).toBe("invalid")
    })

    it("should flip Ok to Err and vice versa", () => {
      const success = Result.Ok("Success value")
      const flipped = success.flip()
      expect(flipped.isErr()).toBe(true)
      expect(flipped.unwrapErr()).toBe("Success value")

      const failure = Result.Err("Error value")
      const flippedError = failure.flip()
      expect(flippedError.isOk()).toBe(true)
      expect(flippedError.unwrap()).toBe("Error value")
    })
  })

  describe("Error Recovery & Side Effects", () => {
    it("should tap for side effects on Ok", async () => {
      const logs: string[] = []

      function findUserById(
        userId: number,
      ): Result<Promise<Record<string, number>>, string> {
        const p = Promise.resolve({ id: userId, balance: 100 })
        return Result.Ok(p)
      }

      function updateBalance(
        user: Record<string, number>,
        amount: number,
      ): Result<Record<string, number>, string> {
        return Result.Ok({ ...user, balance: user.balance - amount })
      }

      const res = await findUserById(1)
        .tap((user) => logs.push(`[Audit] User found: ${user.id}`))
        .flatMap((user) => updateBalance(user, 10))
        .tap((updated) =>
          logs.push(`[Transaction] New balance: $${updated.balance}`),
        )
        .toPromise()

      expect(res.isOk()).toBe(true)
      expect(res.unwrap()).toEqual({ id: 1, balance: 90 })
      expect(logs).toEqual([
        "[Audit] User found: 1",
        "[Transaction] New balance: $90",
      ])
    })

    it("should tapErr for side effects on Err", () => {
      const logs: string[] = []
      const result = Result.Err("Connection failed")
      const logged = result.tapErr((err) => {
        logs.push(`[Error Log]: ${err}`)
      })

      expect(logged.isErr()).toBe(true)
      expect(logged.unwrapErr()).toBe("Connection failed")
      expect(logs).toEqual(["[Error Log]: Connection failed"])
    })

    it("should orElse fallback to alternative Result", () => {
      function fetchFromCache(id: string): Result<string, Error> {
        return id === "cached"
          ? Result.Ok("Cached data")
          : Result.Err(new Error("Not in cache"))
      }

      function fetchFromAPI(id: string): Result<string, Error> {
        return id === "1"
          ? Result.Ok("API data")
          : Result.Err(new Error("Not found"))
      }

      const cached = fetchFromCache("cached").orElse((_err) =>
        fetchFromAPI("1"),
      )
      expect(cached.isOk()).toBe(true)
      expect(cached.unwrap()).toBe("Cached data")

      const fromAPI = fetchFromCache("123").orElse((_err) => fetchFromAPI("1"))
      expect(fromAPI.isOk()).toBe(true)
      expect(fromAPI.unwrap()).toBe("API data")

      const failed = fetchFromCache("123").orElse((_err) => fetchFromAPI("999"))
      expect(failed.isErr()).toBe(true)
    })
  })

  describe("Aggregation Helpers", () => {
    it("should return first success with any", () => {
      const firstSuccess = Result.any(
        Result.Err("Error 1"),
        Result.Ok("First success"),
        Result.Ok("Second success"),
      )
      expect(firstSuccess.isOk()).toBe(true)
      expect(firstSuccess.unwrap()).toBe("First success")

      const allErrors = Result.any(
        Result.Err("Error 1"),
        Result.Err("Error 2"),
        Result.Err("Error 3"),
      )
      expect(allErrors.isErr()).toBe(true)
      expect(allErrors.unwrapErr()).toEqual(["Error 1", "Error 2", "Error 3"])
    })
  })

  describe("Synchronous Pipeline", () => {
    it("should process order through validation and calculation", () => {
      interface Order {
        productId: string
        quantity: number
        userId: string
      }

      interface ProcessedOrder {
        orderId: string
        total: number
        status: "confirmed" | "failed"
        order: Order
      }

      function guardOrder(order: Order): Result<Order, string> {
        if (!order.productId) return Result.Err("Product ID is required")
        if (order.quantity <= 0) return Result.Err("Quantity must be positive")
        if (!order.userId) return Result.Err("User ID is required")
        return Result.Ok(order)
      }

      function guardInventoryCheck(order: Order): Result<Order, string> {
        const availableStock = 100
        return order.quantity <= availableStock
          ? Result.Ok(order)
          : Result.Err(`Insufficient stock. Available: ${availableStock}`)
      }

      function calculateTotal(order: Order): Result<number, string> {
        const price = 29.99
        return Result.Ok(order.quantity * price)
      }

      function processOrder(order: Order): Result<ProcessedOrder, string> {
        return Result.Ok(order)
          .validate([guardOrder, guardInventoryCheck])
          .flatZip(calculateTotal)
          .map(([order, total]) => ({
            orderId: `ORD-${Date.now()}`,
            total: total,
            status: "confirmed" as const,
            order: order,
          }))
          .mapErr(
            (error) =>
              `Order processing failed: ${Array.isArray(error) ? error.join(", ") : error}`,
          )
      }

      const order: Order = {
        productId: "PROD-123",
        quantity: 2,
        userId: "USER-456",
      }

      const result = processOrder(order)
      expect(result.isOk()).toBe(true)
      const processed = result.unwrap()
      expect(processed.status).toBe("confirmed")
      expect(processed.total).toBe(59.98)
      expect(processed.order.productId).toBe("PROD-123")
    })

    it("should fail validation for invalid order", () => {
      interface Order {
        productId: string
        quantity: number
        userId: string
      }

      function guardOrder(order: Order): Result<Order, string> {
        if (!order.productId) return Result.Err("Product ID is required")
        if (order.quantity <= 0) return Result.Err("Quantity must be positive")
        if (!order.userId) return Result.Err("User ID is required")
        return Result.Ok(order)
      }

      function guardInventoryCheck(order: Order): Result<Order, string> {
        const availableStock = 100
        return order.quantity <= availableStock
          ? Result.Ok(order)
          : Result.Err(`Insufficient stock. Available: ${availableStock}`)
      }

      const invalidOrder = {
        productId: "",
        quantity: 0,
        userId: "",
      }

      const result = Result.Ok(invalidOrder).validate([
        guardOrder,
        guardInventoryCheck,
      ])

      expect(result.isErr()).toBe(true)
      // validate wraps errors in array even when there's just one
      expect(result.unwrapErr()).toEqual(["Product ID is required"])
    })
  })

  describe("Asynchronous Pipeline", () => {
    it("should register user through async validation pipeline", async () => {
      interface UserInput {
        email: string
        password: string
        name: string
      }

      interface UserProfile {
        userId: string
        email: string
        name: string
        verificationStatus: "pending" | "verified"
      }

      function guardEmail(email: string): Result<string, string> {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
          ? Result.Ok(email)
          : Result.Err("Invalid email format")
      }

      async function guardEmailAvailability(
        email: string,
      ): Promise<Result<string, string>> {
        await Promise.resolve(email)
        const registeredEmails = ["existing@example.com"]
        return !registeredEmails.includes(email)
          ? Result.Ok(email)
          : Result.Err("Email already registered")
      }

      function guardPassword(password: string): Result<string, string> {
        return password.length >= 8
          ? Result.Ok(password)
          : Result.Err("Password must be at least 8 characters")
      }

      async function createUserProfile(
        input: UserInput,
      ): Promise<Result<UserProfile, string>> {
        await Promise.resolve()
        const userProfile: UserProfile = {
          userId: `USER-${Date.now()}`,
          email: input.email,
          name: input.name,
          verificationStatus: "pending",
        }
        return Result.Ok(userProfile)
      }

      async function sendVerificationEmail(
        profile: UserProfile,
      ): Promise<Result<UserProfile, string>> {
        await Promise.resolve(profile)
        return Result.Ok(profile)
      }

      async function registerUser(
        input: UserInput,
      ): Promise<Result<UserProfile, string | string[]>> {
        const res = await Result.Ok(input)
          .validate([
            ({ email }) => guardEmail(email),
            ({ email }) => guardEmailAvailability(email),
            ({ password }) => guardPassword(password),
          ])
          .flatMap(createUserProfile)
          .flatMap(sendVerificationEmail)
          .mapErr((error) => (Array.isArray(error) ? error.join(", ") : error))
          .toPromise()

        return res
      }

      const userInput: UserInput = {
        email: "newuser@example.com",
        password: "securepass123",
        name: "John Doe",
      }

      const result = await registerUser(userInput)
      expect(result.isOk()).toBe(true)
      const profile = result.unwrap()
      expect(profile.email).toBe("newuser@example.com")
      expect(profile.name).toBe("John Doe")
      expect(profile.verificationStatus).toBe("pending")
      expect(profile.userId).toMatch(/^USER-/)
    })

    it("should fail registration for invalid email", async () => {
      function guardEmail(email: string): Result<string, string> {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
          ? Result.Ok(email)
          : Result.Err("Invalid email format")
      }

      function guardPassword(password: string): Result<string, string> {
        return password.length >= 8
          ? Result.Ok(password)
          : Result.Err("Password must be at least 8 characters")
      }

      const invalidInput = {
        email: "invalid-email",
        password: "securepass123",
        name: "John Doe",
      }

      const res = await Result.Ok(invalidInput)
        .validate([
          ({ email }) => guardEmail(email),
          ({ password }) => guardPassword(password),
        ])
        .toPromise()

      expect(res.isErr()).toBe(true)
      expect(res.unwrapErr()).toEqual(["Invalid email format"])
    })
  })
})
