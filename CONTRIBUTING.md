# Contributing to This Project

Thank you for considering contributing to this project! We welcome contributions of all kinds, including bug fixes, new features, and improvements to the documentation.

## Getting Started

1. **Fork the Repository:**
   - Click the "Fork" button at the top right of the repository page.
2. **Clone Your Fork:**
   ```bash
   git clone https://github.com/<your-username>/steem-load-balancer.git
   cd steem-load-balancer
   ```
3. **Install Dependencies:**
   ```bash
   npm install
   ```

## Making Changes

1. **Create a Branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Make Your Changes:**
   - Run the linter to ensure code quality:
     ```bash
     npm run lint
     ## Auto-fix lint issues where possible
     npm run lint:fix
     ```
   - Check formatting (and auto-fix) with Prettier:
     ```bash
     npm run format
     ## Fix the coding style automatically
     npm run format:fix
     ```
   - Add or update unit tests and make sure they pass:
     ```bash
     npm test
     ```
   - Or run everything at once (lint + format check + tests), exactly like CI:
     ```bash
     npm run check
     ```
3. **Commit Your Changes:**
   ```bash
   git add .
   git commit -m "Add your meaningful commit message"
   ```
4. **Push to Your Fork:**
   ```bash
   git push origin feature/your-feature-name
   ```

## Submitting Your Contribution

1. **Create a Pull Request:**
   - Go to the original repository and click the "New Pull Request" button.
   - Select your fork and branch as the source and submit the pull request.
2. **Review Process:**
   - The maintainers will review your changes and may request additional changes.

## Code of Conduct

By contributing, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Questions or Help?

If you have any questions or need help, feel free to open an issue or reach out in the discussions.

Happy coding! 🚀
