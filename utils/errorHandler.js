class CustomError extends Error {
  constructor(message, hint) {
    super(message);
    this.hint = hint;
  }
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const handleCustomError = async (err) => {
  let retries = 0;
  if (err instanceof CustomError) {
    console.error(`Error: ${err.message}`);
    if (err.hint) {
      console.error(`Hint: ${err.hint}`);
    }
  } else {
    console.error(`Unexpected error: ${err.message}`);
  }
  console.error(err.stack);
  process.exit(1);
};

export { CustomError, handleCustomError };
