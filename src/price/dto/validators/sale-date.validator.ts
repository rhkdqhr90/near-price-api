import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsSaleEndDateAfterStart(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSaleEndDateAfterStart',
      target: object.constructor,
      propertyName,
      options: {
        message: 'saleEndDate must be equal to or after saleStartDate',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const obj = args.object as { saleStartDate?: Date };
          if (!obj.saleStartDate || !(value instanceof Date)) {
            return true;
          }
          return value.getTime() >= obj.saleStartDate.getTime();
        },
      },
    });
  };
}
