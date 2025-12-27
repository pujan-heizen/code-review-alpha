# 🐍 Python Code Review Guidelines

This document outlines the official coding standards and best practices for all Python projects. The goal is to produce code that is **readable**, **maintainable**, and **robust**. Adherence to these rules is mandatory and will be enforced during code reviews.

-----

## Ⅰ. Code Readability & Style

Code is read far more often than it is written. Prioritizing readability ensures that the codebase is easy to understand and modify in the future.

### 1\. Style Guide Adherence

  - **Rule:** All code **must** follow the [PEP 8](https://www.python.org/dev/peps/pep-0008/) style guide.
  - **Tooling:** Use automated formatters like **`black`** and **`isort`** to enforce consistency automatically. `black` handles formatting, and `isort` organizes imports.
  - **Line Length:** Maximum line length is **88 characters**, in line with `black`'s default.

### 2\. Naming Conventions

Descriptive names are crucial for understanding code context without extensive comments.

  - **`snake_case`:** For variables, functions, and methods (e.g., `user_profile`, `calculate_tax`).
  - **`PascalCase`:** For classes (e.g., `DatabaseConnection`, `RequestParser`).
  - **`UPPER_SNAKE_CASE`:** For constants (e.g., `MAX_RETRIES`, `API_ENDPOINT`).
  - **Clarity over Brevity:** Choose descriptive names.
      - ✅ **Good:** `customer_first_name`
      - ❌ **Bad:** `cfn`, `cust_fn`, `x`
  - **Unused Variables:** Prefix unused loop variables or function parameters with an underscore (e.g., `for _, value in items:`).

### 3\. Type Hinting

Type hints are mandatory for improving code clarity and enabling static analysis.

  - **Rule:** All function signatures (arguments and return types) and class variables **must** include type hints. Use the `typing` module for complex types.
  - **Example:**
    ```python
    from typing import List, Dict, Optional

    def process_user_data(
        users: List[Dict[str, str]],
        api_key: Optional[str] = None
    ) -> bool:
        """Processes a list of user dictionaries."""
        # ... function logic ...
        return True
    ```

-----

## Ⅱ. Software Design & Architecture

Well-designed software is easy to test, scale, and maintain.

### 1\. Modularity and Cohesion

  - **Rule:** Organize code into logical modules. Each file should represent a single, cohesive unit of functionality (e.g., `api_client.py`, `database_models.py`, `utils.py`).
  - **Structure:** Use Python packages (directories with an `__init__.py` file) to group related modules.

### 2\. The Single Responsibility Principle (SRP)

  - **Rule:** Every function and class should do **one thing** and do it well.
  - **Functions:** Keep functions small and focused. If a function's name contains "and" (e.g., `validate_and_process_data`), it's a sign it should be split.
  - **Classes:** A class should have only one reason to change. A class managing database connections should not also handle data serialization.

### 3\. DRY (Don't Repeat Yourself)

  - **Rule:** Avoid duplicating logic. Abstract repeated code into reusable functions, utilities, or classes.
  - **Example:** If you find yourself writing the same data validation logic in multiple places, extract it into a `validators.py` module.

### 4\. Composition Over Inheritance

  - **Rule:** Prefer composition (has-a relationship) over inheritance (is-a relationship) where possible. It leads to more flexible and decoupled designs.
  - **When to Inherit:** Use inheritance only when there is a clear "is-a" relationship and you need to conform to a specific interface or override behavior.

-----

## Ⅲ. Production Readiness

Code running in production must be exceptionally stable and transparent.

### 1\. Configuration & Secrets Management

  - **Rule:** **NEVER** hardcode secrets (API keys, passwords, tokens) in the source code.
  - **Method:** Use environment variables, a `.env` file (loaded with a library like `python-dotenv` for local development), or a dedicated secrets management service (like AWS Secrets Manager, HashiCorp Vault).
  - **Example (`settings.py`):**
    ```python
    import os
    from dotenv import load_dotenv

    load_dotenv() # Loads .env file for local dev

    API_KEY = os.getenv("THIRD_PARTY_API_KEY")
    DATABASE_URL = os.getenv("DATABASE_URL")
    ```

### 2\. Comprehensive Logging 📜

  - **Rule:** Use the `logging` module instead of `print()` for any diagnostic output.
  - **Setup:** Configure a logger at the application entry point. Use appropriate log levels:
      - `DEBUG`: Detailed info for diagnosing problems.
      - `INFO`: Confirmation that things are working as expected.
      - `WARNING`: An indication of a potential problem.
      - `ERROR`: A serious problem that prevented a function from completing.
      - `CRITICAL`: A critical error that may cause the application to terminate.
  - **Example:**
    ```python
    import logging

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    logger = logging.getLogger(__name__)

    def my_function():
        logger.info("Starting function execution.")
        try:
            # ...
        except Exception as e:
            logger.error("An error occurred", exc_info=True)
            raise
    ```

### 3\. Robust Error Handling

  - **Rule:** Catch specific exceptions rather than using a bare `except:`. This prevents catching system-level exceptions like `SystemExit` or `KeyboardInterrupt`.
  - **Example:**
      - ✅ **Good:** `try: ... except ValueError as e:`
      - ❌ **Bad:** `try: ... except:`
      - ❌ **Worse:** `try: ... except Exception as e: pass` (swallowing exceptions silently is forbidden)

### 4\. Resource Management

  - **Rule:** Always use context managers (`with` statement) for resources that need to be cleaned up, such as file handles, network connections, and database sessions. This guarantees `__exit__` is called, even if errors occur.
  - **Example:**
    ```python
    # Correct way to handle files
    with open("data.txt", "r") as f:
        content = f.read()

    # Correct way to handle DB connections (example with psycopg2)
    with psycopg2.connect(DSN) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1;")
    ```

-----

## Ⅳ. Concurrency & Performance

Write efficient code that handles I/O and CPU-bound tasks appropriately.

### 1\. Asynchronous I/O ⚡

  - **Rule:** For I/O-bound operations (e.g., network requests, database queries), **must** use `asyncio`. This allows the application to handle thousands of concurrent connections efficiently without blocking.
  - **Libraries:** Use `aiohttp` for HTTP clients/servers, `asyncpg` for PostgreSQL, etc.
  - **Example:**
    ```python
    import asyncio
    import aiohttp

    async def fetch_url(session: aiohttp.ClientSession, url: str) -> str:
        async with session.get(url) as response:
            return await response.text()

    async def main():
        async with aiohttp.ClientSession() as session:
            html = await fetch_url(session, 'https://www.python.org')
            print(html[:100])

    if __name__ == "__main__":
        asyncio.run(main())
    ```

### 2\. Threading and Multiprocessing

  - **Rule:** Use concurrency models correctly.
      - **`asyncio`**: The default for I/O-bound tasks.
      - **`threading`**: Use for I/O-bound tasks if an async library is not available, or for integrating with blocking libraries. Be mindful of Python's Global Interpreter Lock (GIL).
      - **`multiprocessing`**: Use for CPU-bound tasks (e.g., complex calculations, data processing) to leverage multiple CPU cores and bypass the GIL.

### 3\. Writing Pythonic Code

  - **Rule:** Use Python's built-in features and idioms for concise, readable, and often more performant code.
      - **Comprehensions:** Use list, dict, and set comprehensions over `for` loops for creating collections.
      - **`enumerate()`:** Use `enumerate()` in loops where you need both the index and the value.
      - **`with` statement:** As mentioned, always use for resource management.
      - **Unpacking:** Use tuple and dictionary unpacking for cleaner assignments.

-----

## Ⅴ. Development Workflow & Quality Assurance

A disciplined workflow ensures high-quality, reproducible builds.

### 1\. Version Control with Git

  - **Rule:** All code must be in Git. Follow a consistent branching model (e.g., GitFlow).
  - **Commits:** Write clear, descriptive commit messages. A good commit message summarizes the change and explains the "why."
  - **`.gitignore`:** Maintain a comprehensive `.gitignore` file to exclude virtual environments (`venv/`, `__pycache__/`), secrets (`.env`), and OS-specific files (`.DS_Store`).

### 2\. Dependency Management 📦

  - **Rule:** Use **`poetry`** or **`pdm`** for managing dependencies. This provides deterministic builds via a lock file. A `requirements.txt` file is acceptable only for very simple projects.
  - **Pinning:** All dependencies in the lock file (`poetry.lock` or `pdm.lock`) must be **pinned** to exact versions to ensure builds are reproducible.

### 3\. Testing 🧪

  - **Rule:** All new features or bug fixes must be accompanied by tests. Use the **`pytest`** framework.
  - **Structure:** Follow the Arrange-Act-Assert pattern.
  - **Mocks:** Use `unittest.mock` (or `pytest-mock`) to isolate code from external systems (APIs, databases).
  - **Coverage:** While 100% coverage is not the goal, coverage should be high and focused on critical business logic.

### 4\. Documentation

  - **Rule:** All modules, classes, and public functions must have a **docstring** following the [PEP 257](https://www.python.org/dev/peps/pep-0257/) conventions (e.g., Google style, NumPy style).
  - **`README.md`:** Every project must have a `README.md` file explaining what the project does, how to set it up, and how to run it.

-----

## Ⅵ. Security 🛡️

Security is not an afterthought; it is a core requirement.

### 1\. Input Validation

  - **Rule:** Never trust external input. Validate and sanitize all data from users, APIs, and other external sources. Use libraries like **`pydantic`** for robust data validation and parsing.

### 2\. Avoid Dangerous Patterns

  - **Rule:** The following are strictly forbidden:
      - **`eval()` and `exec()`:** Never use on unsanitized input.
      - **SQL Injection:** Always use parameterized queries or an ORM (like SQLAlchemy) instead of string formatting to build SQL queries.
      - **Command Injection:** Avoid using `os.system` or `subprocess.run` with `shell=True` and unvalidated input.

### 3\. Secure Libraries

  - **Rule:** Use standard, secure libraries for security-sensitive operations.
      - **Cryptography:** Use the `cryptography` library.
      - **Secrets Generation:** Use the `secrets` module for generating tokens, not `random`.


