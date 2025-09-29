// Sample JavaScript file for testing grep functionality
function greetUser(name) {
  return `Hello, ${name}!`;
}

function calculateSum(a, b) {
  return a + b;
}

const user = {
  name: "John",
  age: 30,
  greet: function () {
    return greetUser(this.name);
  },
};

// Arrow function example
const multiply = (x, y) => x * y;

// Class definition
class Calculator {
  constructor() {
    this.history = [];
  }

  add(a, b) {
    const result = a + b;
    this.history.push(`${a} + ${b} = ${result}`);
    return result;
  }

  subtract(a, b) {
    const result = a - b;
    this.history.push(`${a} - ${b} = ${result}`);
    return result;
  }
}

// Export for module usage
// eslint-disable-next-line no-undef
module.exports = { greetUser, calculateSum, user, multiply, Calculator };
