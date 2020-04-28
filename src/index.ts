import { Codec, EitherAsync, GetInterface, Left, number, Right, string } from "purify-ts";
import ExtensibleCustomError from "extensible-custom-error";

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

class ValidationError extends ExtensibleCustomError {}

const validate = (requestParams: unknown): EitherAsync<ValidationError, UserCreationRequestParameter> => EitherAsync(async ({ liftEither }) =>
  liftEither(UserCreationRequestParameter.decode(requestParams)
    .mapLeft(reason => new ValidationError(reason))
    .chain(rp => {
      if (rp.age < 0) return Left(new ValidationError(`age must be bigger than 0. got=${rp.age}`));
      if (rp.name === "") return Left(new ValidationError(`name must be non empty.`));
      if (rp.name.length > 30) return Left(new ValidationError(`name length must be shorter than 30. got=${rp.name}`));
      return Right(rp);
    })));

class UserCreationError extends ExtensibleCustomError {}

const insertUser = (userCreationRequestParameter: UserCreationRequestParameter): EitherAsync<UserCreationError, User> => EitherAsync(async ({ fromPromise }) =>
  fromPromise(Promise.resolve(Math.random() > 0.5 ? Right({ id: (Math.random() * 10e8).toFixed(), ...userCreationRequestParameter }) : Left(new UserCreationError(`User insertion error`)))));

type Request = {
  params: unknown;
};

type Response = {
  sendBody: (body: any) => void;
  sendError: (code: number, message: any) => void;
};

const handleError = (res: Response) => (error: Error) => {
  if (error instanceof ValidationError) return res.sendError(400, error.message);
  if (error instanceof UserCreationError) return res.sendError(503, error.message);
  return res.sendError(500, "Internal server error");
}
export const handleRequest = (req: Request, res: Response): void => {
  EitherAsync<ValidationError | UserCreationError, UserResponse>(async ({ fromPromise }) => {
    const requestParameter = await fromPromise(validate(req.params).run());
    return fromPromise(insertUser(requestParameter).run());
  }).run().then(result => result.either(handleError(res), user => res.sendBody(user)));
};

const res: Response = { sendBody: console.log, sendError: console.error };
for (const _ of Array.from(Array(10))) {
  handleRequest({ params: {} }, res);
  handleRequest({ params: { name: "Alice" } }, res);
  handleRequest({ params: { name: "Bob", age: -10 } }, res);
  handleRequest({ params: { name: "Charlie", age: 20 } }, res);
}
