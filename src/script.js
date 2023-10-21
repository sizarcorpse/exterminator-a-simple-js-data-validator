class Exterminator {
  constructor(schema) {
    this.schema = schema;
    this.errors = [];
  }

  validate(obj) {
    const schemaKeys = Object.keys(this.schema);
    const objKeys = Object.keys(obj);

    if (!this.arraysEqual(schemaKeys.sort(), objKeys.sort())) {
      return {
        message: "Validation failed",
        errors: {
          keys: ["Schema keys and validator keys are not the same"],
        },
      };
    }

    const errors = {};
    for (let key in this.schema) {
      if (this.schema.hasOwnProperty(key)) {
        const validator = this.schema[key];
        let value = obj[key];
        let error = validator.validate(value, obj);
        if (error !== true) {
          errors[key] = validator.getErrors();
          this.errors.push({ [key]: error });
        }
      }
    }

    if (Object.keys(errors).length === 0) {
      return true;
    } else {
      return {
        message: "Validation failed",
        errors: errors,
      };
    }
  }

  arraysEqual(a, b) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((val, index) => val === b[index])
    );
  }
}

class StringValidator {
  constructor(options = {}) {
    this.options = options;
    this.validators = [];
    this.errors = [];
    this.preprocessors = [];
    this.isOptional = false;
    this.isNullable = false;

    this.validators.push({
      validate: (value) => typeof value === "string",
      error: "The value must be a string.",
    });
  }

  required({ message = "Value is required" } = {}) {
    this.validators.push({
      validate: (value) => value != null && value.trim() !== "",
      error: message,
    });
    return this;
  }

  alphaNumeric({ message = "Value must be alphanumeric" } = {}) {
    this.validators.push({
      validate: (value) => /^[a-zA-Z0-9]+$/i.test(value),
      error: message,
    });
    return this;
  }

  min(
    length,
    {
      message = (value) =>
        `Value must be at least ${length} characters long, but got ${value}`,
    } = {}
  ) {
    this.validators.push({
      validate: (value) => value.length >= length,
      error: message,
    });
    return this;
  }

  max(
    length,
    {
      message = (value) =>
        `Value must be at most ${length} characters long, but got ${value}`,
    } = {}
  ) {
    this.validators.push({
      validate: (value) => value.length <= length,
      error: message,
    });
    return this;
  }

  lowercase({ message = "Value must be lowercase" } = {}) {
    this.validators.push({
      validate: (value) => value === value.toLowerCase(),
      error: message,
    });
    return this;
  }

  uppercase({ message = "Value must be uppercase" } = {}) {
    this.validators.push({
      validate: (value) => value === value.toUpperCase(),
      error: message,
    });
    return this;
  }

  email({
    message = "Value must be a valid email",
    domains = [],
    excludeDomains = [],
  } = {}) {
    const commonDomains = domains.filter((domain) =>
      excludeDomains.includes(domain)
    );

    if (commonDomains.length > 0) {
      this.invalidSetup = `Domains ${commonDomains.join(
        ", "
      )} cannot be both allowed and excluded.`;
      return this;
    }

    this.validators.push({
      validate: (value) => {
        const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/i;

        if (!regex.test(value)) {
          return typeof message === "function" ? message(value) : message;
        }

        const domain = value.split("@")[1];
        if (domains.length > 0 && !domains.includes(domain)) {
          return `Email domain must be one of ${domains.join(", ")}`;
        }

        if (excludeDomains.length > 0 && excludeDomains.includes(domain)) {
          return `Email domain must not be one of ${excludeDomains.join(", ")}`;
        }

        return true;
      },
      error: (value, result) =>
        typeof result === "string"
          ? result
          : typeof message === "function"
          ? message(value)
          : message,
    });
    return this;
  }

  phone(
    region = "us",
    { pattern, message = "Value must be a valid phone number" } = {}
  ) {
    switch (region) {
      case "us":
        pattern = pattern || /^\(\d{3}\) \d{3}-\d{4}$/;
        break;
      case "eu":
        pattern = pattern || /^\+?\d{2,3}[-.\s]?\d{6,9}$/;
        break;
      default:
        throw new Error(`Unsupported region: ${region}`);
    }

    this.validators.push({
      validate: (value) => pattern.test(value),
      error: message,
    });
    return this;
  }

  password(
    pattern,
    { message = "Password does not meet the requirements" } = {}
  ) {
    // Minimum eight characters, at least one uppercase letter, one lowercase letter, one number and one special character
    const defaultPattern =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    pattern = pattern || defaultPattern;
    this.validators.push({
      validate: (value) => pattern.test(value),
      error: message,
    });
    return this;
  }

  regex(pattern, { message = "Value does not match the pattern" } = {}) {
    this.validators.push({
      validate: (value) => pattern.test(value),
      error: message,
    });
    return this;
  }

  oneOf(allowedValues = [], { message = "Invalid value" } = {}) {
    if (allowedValues.length === 0) {
      this.invalidSetup = `You must provide at least one allowed value.`;
      return this;
    }
    this.validators.push({
      validate: (value) => allowedValues.includes(value),
      error: message,
    });
    return this;
  }

  trim() {
    this.preprocessors.push((value) => value.trim());
    return this;
  }

  optional() {
    this.isOptional = true;
    return this;
  }

  nullable() {
    this.isNullable = true;
    return this;
  }

  equals(field, { message = `Value must be equal to ${field}` } = {}) {
    this.validators.push({
      validate: (value, obj) => value === obj[field],
      error: message,
    });
    return this;
  }

  validate(value, obj) {
    this.errors = [];

    if (this.invalidSetup) {
      this.errors.push(this.invalidSetup);
      return false;
    }

    if (this.isOptional && value === "") {
      return true;
    }

    if (value === null) {
      if (this.isNullable) {
        return true;
      } else {
        this.errors.push("Value cannot be null");
        return false;
      }
    }

    for (let preprocessor of this.preprocessors) {
      value = preprocessor(value);
    }

    for (let validator of this.validators) {
      const result = validator.validate(value, obj);
      if (result !== true) {
        this.errors.push(
          typeof validator.error === "function"
            ? validator.error(value, result)
            : validator.error
        );
      }
    }

    return this.errors.length === 0;
  }
  getErrors() {
    return this.errors;
  }
}

class NumberValidator {
  constructor(options) {
    this.options = options;
    this.preprocessors = [];
    this.isOptional = false;
    this.isNullable = false;
    this.validators = [];

    this.validators.push({
      validate: (value) => typeof value === "number",
      error: "The value must be a number.",
    });
  }

  required({ message = "This field is required." } = {}) {
    this.validators.push({
      validate: (value) =>
        value !== null && value !== undefined && value !== "",
      error: message,
    });
    return this;
  }

  min(
    minValue,
    {
      message = `The number must be greater than or equal to ${minValue}.`,
    } = {}
  ) {
    this.validators.push({
      validate: (value) => value >= minValue,
      error: message,
    });
    return this;
  }

  max(
    maxValue,
    { message = `The number must be less than or equal to ${maxValue}.` } = {}
  ) {
    this.validators.push({
      validate: (value) => value <= maxValue,
      error: message,
    });
    return this;
  }

  integer({ message = "The number must be an integer." } = {}) {
    this.validators.push({
      validate: (value) => Number.isInteger(value),
      error: message,
    });
    return this;
  }

  positive({ message = "The number must be positive." } = {}) {
    this.validators.push({
      validate: (value) => value > 0,
      error: message,
    });
    return this;
  }

  negative({ message = "The number must be negative." } = {}) {
    this.validators.push({
      validate: (value) => value < 0,
      error: message,
    });
    return this;
  }

  greater(
    field,
    { message = `The number must be greater than ${field}.` } = {}
  ) {
    this.validators.push({
      validate: (value, obj) => value > obj[field],
      error: message,
    });
    return this;
  }

  less(field, { message = `The number must be less than ${field}.` } = {}) {
    this.validators.push({
      validate: (value, obj) => value < obj[field],
      error: message,
    });
    return this;
  }

  greaterEqual(
    field,
    { message = `The number must be greater than or equal to ${field}.` } = {}
  ) {
    this.validators.push({
      validate: (value, obj) => value >= obj[field],
      error: message,
    });
    return this;
  }

  lessEqual(
    field,
    { message = `The number must be less than or equal to ${field}.` } = {}
  ) {
    this.validators.push({
      validate: (value, obj) => value <= obj[field],
      error: message,
    });
    return this;
  }

  optional() {
    this.isOptional = true;
    return this;
  }

  nullable() {
    this.isNullable = true;
    return this;
  }

  validate(value, obj) {
    this.errors = [];

    if (this.invalidSetup) {
      this.errors.push(this.invalidSetup);
      return false;
    }

    if (this.isOptional && value === "") {
      return true;
    }

    if (value === null) {
      if (this.isNullable) {
        return true;
      } else {
        this.errors.push("Value cannot be null");
        return false;
      }
    }

    if (this.preprocessors) {
      for (let preprocessor of this.preprocessors) {
        value = preprocessor(value);
      }
    }

    if (this.validators) {
      for (let validator of this.validators) {
        const result = validator.validate(value, obj);
        if (result !== true) {
          this.errors.push(
            typeof validator.error === "function"
              ? validator.error(value, result)
              : validator.error
          );
        }
      }
    }

    return this.errors.length === 0;
  }

  getErrors() {
    return this.errors;
  }
}

function string(options) {
  return new StringValidator(options);
}

function number(options) {
  return new NumberValidator(options);
}

// USAGE EXAMPLE :

console.log("-----------------------------------------------------");

const person = {
  name: 0,
};
const schema = {
  name: string(),
};

const validator = new Exterminator(schema);
const result = validator.validate(person);
console.log(result);

/* 

*/
