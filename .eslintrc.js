/*******************************************************************************
 * @author      : 程巍巍 (littocats@gmail.com)
 * @created     : 星期二 7月 13, 2021 15:16:22 CST
 *
 * @description : .eslintrc
 *
 ******************************************************************************/

module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  env: {
    node: true,
  },
  rules: {
    semi: ["error", "always"],
  },
};
