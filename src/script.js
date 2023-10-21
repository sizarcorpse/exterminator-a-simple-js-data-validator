class Exterminator {
  constructor(schema) {
    this.schema = schema;
    this.errors = [];
  }

  validate(obj) {
    const schemaKeys = Object.keys(this.schema);
    const objKeys = Object.keys(obj);

    // Make sure the keys in the schema and the obj are the same.
    if (!this.arraysEqual(schemaKeys.sort(), objKeys.sort())) {
      return {
        message: "Validation failed",
        errors: {
          keys: ["Schema keys and validator keys are not the same"],
        },
      };
    }

    const errors = {};
    // Loop through all the keys in the schema.
    for (let key in this.schema) {
      // Make sure the key is a property of the schema, not the prototype.
      if (this.schema.hasOwnProperty(key)) {
        // Get the validator for the key.
        const validator = this.schema[key];
        // Get the value from the object.
        let value = obj[key];
        // Validate the value.
        let error = validator.validate(value, obj);
        // If the value is invalid, store the error.
        if (error !== true) {
          errors[key] = validator.getErrors();
          this.errors.push({ [key]: error });
        }
      }
    }
    // If there are no errors, return true.
    if (Object.keys(errors).length === 0) {
      return true;
      // Otherwise, return the errors.
    } else {
      return {
        message: "Validation failed",
        errors: errors,
      };
    }
  }

  // Check if two arrays are equal.
  arraysEqual(a, b) {
    return a.length === b.length && a.every((val, index) => val === b[index]);
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
  }

  /**
   * Required validator
   *
   * @param {Object} [options]
   * @param {string} [options.message="Value is required"]
   */

  // Add a validator to ensure that the value is not null and not empty
  required({ message = "Value is required" } = {}) {
    this.validators.push({
      validate: (value) => value != null && value.trim() !== "",
      error: message,
    });
    return this;
  }

  /**
   * Alphanumeric validator
   *
   * @param {Object} [options]
   * @param {string} [options.message="Value must be alphanumeric"]
   */

  alphaNumeric({ message = "Value must be alphanumeric" } = {}) {
    this.validators.push({
      validate: (value) => /^[a-zA-Z0-9]+$/i.test(value),
      error: message,
    });
    return this;
  }

  /**
   * Min length validator
   *
   * @param {Object} [options]
   * @param {number} [options.length]
   * @param {string} [options.message="Value must be at least ${length} characters long, but got ${value}"]
   */

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

  /**
   * Max length validator
   *
   * @param {Object} [options]
   * @param {number} [options.length]
   * @param {string} [options.message="Value must be at most ${length} characters long, but got ${value}"]
   */

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

  /**
   * Lowercase validator
   *
   * @param {Object} [options]
   * @param {string} [options.message="Value must be lowercase"]
   */

  lowercase({ message = "Value must be lowercase" } = {}) {
    this.validators.push({
      validate: (value) => value === value.toLowerCase(),
      error: message,
    });
    return this;
  }

  /**
   * Uppercase validator
   *
   * @param {Object} [options]
   * @param {string} [options.message="Value must be uppercase"]
   */
  uppercase({ message = "Value must be uppercase" } = {}) {
    this.validators.push({
      validate: (value) => value === value.toUpperCase(),
      error: message,
    });
    return this;
  }

  /**
   * Email validator
   *
   * @param {Object} [options]
   * @param {string} [options.message="Value must be a valid email"]
   * @param {string[]} [options.domains=[]] - Allowed domains
   * @param {string[]} [options.excludeDomains=[]] - Excluded domains
   * @param {string} [options.message="Value must be a valid email"]
   */

  email({
    message = "Value must be a valid email",
    domains = [],
    excludeDomains = [],
  } = {}) {
    // If both domains and excludeDomains are provided, the validator is invalid.
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
        // Validate that the value matches the email regex.
        const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/i;
        if (!regex.test(value)) {
          return typeof message === "function" ? message(value) : message;
        }

        // Validate that the domain is allowed.
        const domain = value.split("@")[1];
        if (domains.length > 0 && !domains.includes(domain)) {
          return `Email domain must be one of ${domains.join(", ")}`;
        }

        // Validate that the domain is not excluded.
        if (excludeDomains.length > 0 && excludeDomains.includes(domain)) {
          return `Email domain must not be one of ${excludeDomains.join(", ")}`;
        }

        // If the value is valid, return true.
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

  /**
   * Phone validator
   *
   * @param {string} region - Region of the phone number
   * @param {Object} [options]
   * @param {string} [options.pattern] - Custom pattern to match
   * @param {string} [options.message="Value must be a valid phone number"]
   */

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

  /**
   * Password validator
   *
   * @param {Object} [options]
   * @param {string} [options.pattern] - Custom pattern to match
   * @param {string} [options.message="Password does not meet the requirements"]
   */

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

  /**
   * Regex validator
   *
   * @param {Object} [options]
   * @param {string} [options.pattern] - Custom pattern to match
   * @param {string} [options.message="Value does not match the pattern"]
   */

  regex(pattern, { message = "Value does not match the pattern" } = {}) {
    this.validators.push({
      validate: (value) => pattern.test(value),
      error: message,
    });
    return this;
  }

  /**
   * One of validator
   *
   * @param {Object} [options]
   * @param {string[]} [options.allowedValues=[]] - Allowed values
   * @param {string} [options.message="Invalid value"]
   */

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

  /**
   * Trim validator
   *
   * @param {Object} [options]
   * @param {string} [options.message="Value must be trimmed"]
   */

  trim() {
    this.preprocessors.push((value) => value.trim());
    return this;
  }

  /**
   * Optional validator
   *
   * @param {Object} [options]
   */

  optional() {
    this.isOptional = true;
    return this;
  }

  /**
   * Nullable validator
   *
   * @param {Object} [options]
   */

  nullable() {
    this.isNullable = true;
    return this;
  }

  /**
   * Equals validator
   *
   * @param {string} field - Field to compare to
   * @param {Object} [options]
   * @param {string} [options.message="Value must be equal to ${field}"]
   */

  equals(field, { message = `Value must be equal to ${field}` } = {}) {
    this.validators.push({
      validate: (value, obj) => value === obj[field],
      error: message,
    });
    return this;
  }

  /**
   * Validate the value
   *
   * @param {string} value - Value to validate
   * @param {Object} obj - Object to validate against
   */

  validate(value, obj) {
    // Clear out all errors before running validation
    this.errors = [];

    // If this field's setup is invalid, then we can't validate it.
    if (this.invalidSetup) {
      this.errors.push(this.invalidSetup);
      return false;
    }

    // If this field is optional, then we can skip all the other validation
    // if the value is empty.
    if (this.isOptional && value === "") {
      return true;
    }

    // If this field is nullable, then we can skip all the other validation
    // if the value is null.
    if (value === null) {
      if (this.isNullable) {
        return true;
      } else {
        this.errors.push("Value cannot be null");
        return false;
      }
    }

    // Run the value through all the preprocessor functions, in order.
    for (let preprocessor of this.preprocessors) {
      value = preprocessor(value);
    }

    // Run the value through all the validator functions, in order.
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

    // If there are any errors, the value is invalid. Otherwise, it's valid.
    return this.errors.length === 0;
  }

  /**
   * Get the errors
   *
   * @returns {string[]} - Array of errors
   */

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
  }

  required({ message = "This field is required." } = {}) {
    this.validators.push({
      validate: (value) => value !== null && value !== undefined,
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

console.log("---------------------------------------------------");

const person = {
  balance: 100,
  dew: 500,
};
const schema = {
  balance: number()
    .required()
    .greater("dew", {
      message: (cv) => {
        return `Balance must be greater than dew ${cv}`;
      },
    }),
  dew: number().required(),
};

const validator = new Exterminator(schema);
const result = validator.validate(person);
console.log(result);

/* 


*/
