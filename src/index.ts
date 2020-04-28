import { Codec, Either, EitherAsync, GetInterface, Left, number, Right, string } from "purify-ts";

type UserCreationRequestParameter = GetInterface<typeof UserCreationRequestParameter>;
const UserCreationRequestParameter = Codec.interface({
  name: string,
  age: number
});

type User = {
  id: string,
  name: string,
  age: number
}

type UserResponse = User;

type ErrorTypeOf<T extends (...arg: any[]) => Either<any, any>> = ReturnType<T> extends Either<infer L, any> ? L : never;

type ValidationError = ReturnType<typeof ValidationError>;
const ValidationError = (reason: string) => ({
  type: "ValidationError" as const,
  reason
});

const validate = (requestParams: unknown): Either<ValidationError, UserCreationRequestParameter> =>
  UserCreationRequestParameter.decode(requestParams)
    .mapLeft(ValidationError)
    .chain(rp => {
      if (rp.age < 0) return Left(ValidationError(`age must be bigger than 0. got=${rp.age}`));
      if (rp.name === "") return Left(ValidationError(`name must be non empty.`));
      if (rp.name.length > 30) return Left(ValidationError(`name length must be shorter than 30. got=${rp.name}`));
      return Right(rp);
    });

type UserCreationError = ErrorTypeOf<typeof UserCreationError>;
const UserCreationError = (error: Error) => Left({
  type: "UserCreationError" as const,
  error
});

const insertUser = async (userCreationRequestParameter: UserCreationRequestParameter): Promise<Either<UserCreationError, User>> =>
  Math.random() > 0.1 ? Right({ id: (Math.random() * 10e8).toFixed(), ...userCreationRequestParameter }) : UserCreationError(new Error(`User insertion error`));

type Request = {
  params: unknown;
};

type Response = {
  sendBody: (body: any) => void;
  sendError: (code: number, message: any) => void;
};

const handleError = (res: Response) => (error: ValidationError | UserCreationError) => {
  switch (error.type) {
    case "ValidationError": {
      return res.sendError(400, error.reason);
    }
    case "UserCreationError": {
      return res.sendError(400, error.error);
    }
    default: {
      return res.sendError(500, "Server Error");
    }
  }
}

export const handleRequest = (req: Request, res: Response): void => {
  EitherAsync<ValidationError | UserCreationError, UserResponse>(async ({ liftEither, fromPromise }) => {
    const requestParameter = await liftEither(validate(req.params));
    return fromPromise(insertUser(requestParameter));
  }).run().then(result => result.either(handleError(res), user => res.sendBody(user)));
};

const res: Response = { sendBody: console.log, sendError: console.error };
handleRequest({ params: {} }, res);
handleRequest({ params: { name: "Alice" } }, res);
handleRequest({ params: { name: "Bob", age: -10 } }, res);
handleRequest({ params: { name: "Charlie", age: 20 } }, res);
